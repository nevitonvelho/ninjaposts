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
    readonly code:
      | 'content_policy'
      | 'rate_limited'
      | 'quota_exhausted'
      | 'provider_error'
      | 'timeout',
    message: string,
    readonly retryable: boolean,
    /**
     * O código cru da OpenAI (`insufficient_quota`, `rate_limit_exceeded`…).
     *
     * Existe só para o log: é campo próprio da instância, então aparece
     * sozinho no `console.error` do worker junto de `code` e `retryable`. Sem
     * ele, dois 429 de causas opostas deixam exatamente o mesmo rastro — e a
     * investigação começa adivinhando.
     */
    readonly providerCode?: string,
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
      type,
    )
  }

  /**
   * 429 é ambíguo na OpenAI, e é o ponto onde mais se perde tempo.
   *
   * O mesmo status cobre throttling — que passa sozinho, e onde repetir é
   * exatamente a coisa certa — e conta sem saldo, onde repetir não resolve em
   * tentativa nenhuma. Só o `code` do corpo separa os dois.
   *
   * Tratar saldo zerado como repetível custa três chamadas e 14s de backoff
   * por geração, e faz o usuário ler "tente de novo em alguns minutos" para um
   * problema que só o dono da conta resolve.
   */
  if (status === 429) {
    const semSaldo = /insufficient_quota|billing_hard_limit_reached|exceeded your current quota/i
      .test(`${type} ${message}`)

    return semSaldo
      ? new ProviderError(
          'quota_exhausted',
          'A conta do provedor de IA está sem saldo.',
          false,
          type,
        )
      : new ProviderError('rate_limited', 'Limite de requisições atingido.', true, type)
  }

  if (status === 408 || /timeout|ETIMEDOUT|ECONNRESET/i.test(message)) {
    return new ProviderError('timeout', 'O provedor demorou demais para responder.', true, type)
  }
  if (status && status >= 500) {
    return new ProviderError('provider_error', 'O provedor está instável.', true, type)
  }
  // 4xx que não conhecemos é bug nosso (prompt malformado, parâmetro inválido):
  // repetir só queimaria as três tentativas contra o mesmo erro.
  return new ProviderError('provider_error', message, false, type)
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
  /**
   * A logo já está **dentro** da imagem.
   *
   * Decide se o pós-processamento ainda precisa colá-la: sem esta bandeira, uma
   * segunda passada bem-sucedida levaria a logo duas vezes na mesma arte.
   */
  logoIntegrated: boolean
}

/** `toFile` da própria SDK — evita montar `FormData` na mão. */
async function toFile(buffer: Buffer, name: string, type: string) {
  const { toFile: openaiToFile } = await import('openai')
  return openaiToFile(buffer, name, { type })
}

/**
 * Modelos que aceitam `input_fidelity` em `images.edit`.
 *
 * Não é preciosismo: mandar o parâmetro para um modelo que não o conhece é
 * **400 na hora**, e derruba toda geração com logo. Foi o que aconteceu ao
 * trocar para `gpt-image-2` — `The model 'gpt-image-2' does not support the
 * 'input_fidelity' parameter`.
 *
 * Lista de permissão, e não de bloqueio: modelo novo entra sem o parâmetro e
 * gera arte com fidelidade padrão. O oposto — assumir que aceita — quebra a
 * geração inteira até alguém ler o log.
 */
const SUPPORTS_INPUT_FIDELITY = new Set(['gpt-image-1', 'gpt-image-1.5', 'gpt-image-1-mini'])

/**
 * Etapa RENDER — uma passada só, sempre.
 *
 * Sem logo, `images.generate`. Com logo, `images.edit` levando a marca como
 * **referência** — não como tela.
 *
 * Essa distinção é o aprendizado caro deste arquivo. `images.edit` recebendo só
 * uma logo já ancorou a composição inteira num arquivo de 200 pixels e derrubou
 * a qualidade. O que mudou desde então: o modelo passou a ser `gpt-image-2`, e
 * `input_fidelity: 'high'` — que nunca havia sido enviado — instrui o endpoint a
 * preservar a referência em vez de reinterpretá-la. O prompt reforça em texto
 * que a imagem anexa é a logo, e não o fundo.
 *
 * Duas passadas foram descartadas de propósito: com `gpt-image-2` a ~228s por
 * chamada, duas encostariam nos 540s de timeout da função — e job que estoura o
 * timeout morre preso, esperando o estorno do reconciliador.
 */
export async function renderImage(
  input: GenerationInput,
  brief: CreativeBrief,
  logo: Buffer | null,
): Promise<RenderResult> {
  const model = imageModel.value()
  const size = FORMATS[input.format].renderSize
  const prompt = buildImagePrompt(brief, input, Boolean(logo))
  const quality = 'high' as const

  let art: Buffer
  let revisedPrompt: string | null
  const costUsd = estimateImageCost(size, quality, model)

  try {
    const response = logo
      ? await openai().images.edit({
          model,
          image: [await toFile(logo, 'logo.png', 'image/png')],
          prompt,
          size,
          quality,
          ...(SUPPORTS_INPUT_FIDELITY.has(model) ? { input_fidelity: 'high' as const } : {}),
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

    art = Buffer.from(first.b64_json, 'base64')
    revisedPrompt = first.revised_prompt ?? null
  } catch (error) {
    if (error instanceof ProviderError) throw error
    throw classify(error)
  }

  /**
   * Com logo, ela já saiu desenhada pelo modelo — `logoIntegrated` impede o
   * `sharp` de colar uma segunda por cima.
   */
  return { png: art, promptUsed: prompt, revisedPrompt, costUsd, model, logoIntegrated: Boolean(logo) }
}

