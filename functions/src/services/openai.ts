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

/**
 * Etapa RENDER — `images.generate`, uma passada só.
 *
 * **Nunca `images.edit`**, e por dois motivos distintos, ambos aprendidos caro:
 *
 * 1. Mandando só a logo, o modelo a trata como *tela* e ancora a composição
 *    inteira numa imagem de 200 pixels. A qualidade desaba.
 * 2. Mandando `[arte, logo]` — que é o uso correto do endpoint — ele regenera a
 *    imagem **inteira**, texto incluído. Ou seja, uma segunda chance de
 *    embaralhar o português numa arte que já tinha saído certa. Erro de grafia
 *    é o defeito nº 1 deste produto; não vale trocá-lo por logo com luz.
 *
 * A logo entra por composição no `sharp`, chapada — que é, aliás, o que a peça
 * de referência do próprio cliente faz no canto superior. Aqui ela nem chega:
 * quem avisa o prompt para reservar o canto é `input.logoPath`.
 */
export async function renderImage(
  input: GenerationInput,
  brief: CreativeBrief,
): Promise<RenderResult> {
  const model = imageModel.value()
  const size = FORMATS[input.format].renderSize
  const prompt = buildImagePrompt(brief, input)
  const quality = 'high' as const

  let art: Buffer
  let revisedPrompt: string | null
  let costUsd = estimateImageCost(size, quality, model)

  try {
    const response = await openai().images.generate({
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
   * A 2ª passada de integração da logo foi **removida**, e o motivo é caro de
   * reaprender: `images.edit` regenera a imagem **inteira**, texto incluído.
   * Ela dava uma segunda chance de embaralhar o português numa arte que já
   * tinha saído correta — e erro de grafia é o defeito nº 1 relatado.
   *
   * A troca é consciente: perde-se a logo recebendo a luz da cena, ganha-se
   * texto estável e metade do custo. A logo entra chapada, por composição no
   * `sharp` — que, aliás, é o que a própria peça de referência faz no canto.
   *
   * Se voltar algum dia, que seja atrás de um tier pago e só em formatos sem
   * texto pesado.
   */
  return { png: art, promptUsed: prompt, revisedPrompt, costUsd, model, logoIntegrated: false }
}

