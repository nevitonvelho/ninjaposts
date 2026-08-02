import OpenAI from 'openai'
import { FORMATS } from '../../../shared/constants'
import type { CreativeBrief, GenerationInput } from '../../../shared/types/generation'
import { briefModel, imageModel, openaiApiKey } from '../lib/env'
import { BRIEF_SCHEMA, buildBriefInstructions, buildImagePrompt } from './prompt'
import { estimateImageCost, estimateTextCost } from './cost'

/**
 * Cliente da OpenAI e as duas chamadas do worker.
 *
 * Duas chamadas, e não uma (§7.2): um modelo de texto transforma campos de
 * formulário em direção de arte — composição, luz, hierarquia — e ainda entrega
 * legenda e hashtags. A chamada de texto custa ordens de grandeza menos que a
 * de imagem, então o ganho de qualidade sai praticamente de graça.
 */

let client: OpenAI | null = null

function openai(): OpenAI {
  // Instanciar sob demanda: no cold start o valor do secret ainda não existe.
  return (client ??= new OpenAI({ apiKey: openaiApiKey.value(), maxRetries: 0 }))
}

/**
 * Erro que o worker sabe classificar.
 *
 * `retryable` decide entre tentar de novo e desistir com estorno;
 * `code` vira `GenerationError.code` no documento e define a mensagem que o
 * usuário lê.
 */
export class ProviderError extends Error {
  constructor(
    readonly code: 'content_policy' | 'rate_limited' | 'provider_error' | 'timeout',
    message: string,
    readonly retryable: boolean,
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}

/** Traduz o erro da OpenAI para o nosso vocabulário. */
function classify(error: unknown): ProviderError {
  const status = (error as { status?: number }).status
  const type = (error as { error?: { code?: string } }).error?.code ?? ''
  const message = (error as Error).message ?? 'erro desconhecido'

  if (status === 400 && /content_policy|safety|moderation/i.test(`${type} ${message}`)) {
    return new ProviderError(
      'content_policy',
      'O conteúdo pedido não passou na moderação do provedor.',
      false,
    )
  }
  if (status === 429) {
    return new ProviderError('rate_limited', 'Limite de requisições atingido.', true)
  }
  if (status === 408 || /timeout|ETIMEDOUT|ECONNRESET/i.test(message)) {
    return new ProviderError('timeout', 'O provedor demorou demais para responder.', true)
  }
  if (status && status >= 500) {
    return new ProviderError('provider_error', 'O provedor está instável.', true)
  }
  // 4xx que não conhecemos é bug nosso (prompt malformado, parâmetro inválido):
  // repetir só queimaria as três tentativas contra o mesmo erro.
  return new ProviderError('provider_error', message, false)
}

export interface BriefResult {
  brief: CreativeBrief
  tokensIn: number
  tokensOut: number
  costUsd: number
  model: string
}

/** Etapa BRIEF — Responses API com Structured Outputs. */
export async function createBrief(input: GenerationInput): Promise<BriefResult> {
  const model = briefModel.value()

  try {
    const response = await openai().responses.create({
      model,
      input: buildBriefInstructions(input),
      text: {
        format: {
          type: 'json_schema',
          name: 'creative_brief',
          schema: BRIEF_SCHEMA as unknown as Record<string, unknown>,
          strict: true,
        },
      },
    })

    const text = response.output_text
    if (!text) {
      throw new ProviderError('provider_error', 'O briefing voltou vazio.', true)
    }

    const brief = JSON.parse(text) as CreativeBrief
    const tokensIn = response.usage?.input_tokens ?? 0
    const tokensOut = response.usage?.output_tokens ?? 0

    return {
      brief,
      tokensIn,
      tokensOut,
      costUsd: estimateTextCost(tokensIn, tokensOut),
      model,
    }
  } catch (error) {
    if (error instanceof ProviderError) throw error
    if (error instanceof SyntaxError) {
      // Structured Outputs devolvendo JSON inválido é transitório na prática.
      throw new ProviderError('provider_error', 'O briefing voltou em formato inválido.', true)
    }
    throw classify(error)
  }
}

export interface RenderResult {
  png: Buffer
  promptUsed: string
  revisedPrompt: string | null
  costUsd: number
  model: string
}

/**
 * Etapa RENDER — Images API.
 *
 * Com logo, usamos `images.edit` em vez de `images.generate`: é o caminho que
 * aceita imagem de referência, e é o que faz a marca sair reconhecível em vez
 * de "algo parecido com um logo".
 */
export async function renderImage(
  input: GenerationInput,
  brief: CreativeBrief,
  logo: Buffer | null,
): Promise<RenderResult> {
  const model = imageModel.value()
  const size = FORMATS[input.format].renderSize
  const prompt = buildImagePrompt(brief, input)
  const quality = 'high' as const

  try {
    const response = logo
      ? await openai().images.edit({
          model,
          image: [await toFile(logo, 'logo.png', 'image/png')],
          prompt,
          size,
          quality,
        })
      : await openai().images.generate({
          model,
          prompt,
          size,
          quality,
          n: 1,
          output_format: 'png',
        })

    const first = response.data?.[0]
    if (!first?.b64_json) {
      throw new ProviderError('provider_error', 'O provedor não devolveu imagem.', true)
    }

    return {
      png: Buffer.from(first.b64_json, 'base64'),
      promptUsed: prompt,
      revisedPrompt: first.revised_prompt ?? null,
      costUsd: estimateImageCost(size, quality),
      model,
    }
  } catch (error) {
    if (error instanceof ProviderError) throw error
    throw classify(error)
  }
}

/** `toFile` da própria SDK — evita montar `FormData` na mão. */
async function toFile(buffer: Buffer, name: string, type: string) {
  const { toFile: openaiToFile } = await import('openai')
  return openaiToFile(buffer, name, { type })
}
