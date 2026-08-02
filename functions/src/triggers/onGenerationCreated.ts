import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { GENERATION_LIMITS } from '../../../shared/constants'
import type { GenerationDoc, GenerationMeta } from '../../../shared/types/generation'
import { REGION, openaiApiKey } from '../lib/env'
import { advance, completeJob, failJob } from '../services/job'
import { ProviderError, createBrief, renderImage } from '../services/openai'
import { processImage } from '../services/image'
import { downloadLogo, uploadGenerationFiles } from '../services/storage'

/**
 * O worker (§7.1).
 *
 * Roda como função de background e não dentro da API porque o caminho
 * Hosting → Cloud Function morre em 60s, e uma geração leva de 20s a 90s
 * (§0.3). Aqui temos até 9 minutos e memória alta — que o `sharp` precisa e a
 * API não deveria pagar.
 */

/** Espera com backoff exponencial: 2s, 4s, 8s. */
function wait(attempt: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 2 ** attempt * 1000))
}

export const onGenerationCreated = onDocumentCreated(
  {
    document: 'generations/{generationId}',
    region: REGION,
    memory: '2GiB',
    timeoutSeconds: 540,
    // Uma geração por instância: `sharp` em três formatos come memória, e
    // duas execuções concorrentes no mesmo container derrubam as duas.
    concurrency: 1,
    retry: false,
    secrets: [openaiApiKey],
  },
  async (event) => {
    const snapshot = event.data
    if (!snapshot) return

    const generationId = event.params.generationId
    const generation = snapshot.data() as GenerationDoc

    /**
     * Guarda de idempotência (§7.5): o Eventarc reentrega eventos, e um job já
     * processado não pode rodar de novo — seria uma segunda imagem paga pelo
     * mesmo crédito.
     */
    if (generation.status !== 'queued') {
      console.info(`[worker] ${generationId} já está em "${generation.status}", ignorando reentrega.`)
      return
    }

    const startedAt = Date.now()
    const { input, ownerId } = generation

    let costUsd = 0
    let partialMeta: Partial<GenerationMeta> = {}

    try {
      // --- BRIEF ---
      await advance(generationId, 'briefing')
      const brief = await withRetry(() => createBrief(input), 'brief')

      costUsd += brief.costUsd
      partialMeta = {
        briefModel: brief.model,
        tokensIn: brief.tokensIn,
        tokensOut: brief.tokensOut,
      }

      // --- RENDER ---
      await advance(generationId, 'rendering')
      const logo = input.logoPath ? await downloadLogo(input.logoPath) : null
      const render = await withRetry(() => renderImage(input, brief.brief, logo), 'render')

      costUsd += render.costUsd

      // --- PROCESS + UPLOAD ---
      await advance(generationId, 'finishing')
      const image = await processImage(render.png, input.format)
      const paths = await uploadGenerationFiles(ownerId, generationId, image)

      // --- COMMIT ---
      await completeJob({
        generationId,
        ownerId,
        output: {
          imagePath: paths.imagePath,
          jpgPath: paths.jpgPath,
          thumbPath: paths.thumbPath,
          width: image.width,
          height: image.height,
          caption: brief.brief.caption,
          hashtags: brief.brief.hashtags,
          altText: brief.brief.altText,
        },
        meta: {
          briefModel: brief.model,
          imageModel: render.model,
          promptUsed: render.promptUsed,
          revisedPrompt: render.revisedPrompt,
          tokensIn: brief.tokensIn,
          tokensOut: brief.tokensOut,
          costUsd,
          durationMs: Date.now() - startedAt,
          attempt: 1,
        },
      })

      console.info(`[worker] ${generationId} concluído em ${Date.now() - startedAt}ms (US$ ${costUsd.toFixed(4)})`)
    } catch (error) {
      const provider = error instanceof ProviderError ? error : null

      console.error(`[worker] ${generationId} falhou:`, error)

      await failJob({
        generationId,
        ownerId,
        code: provider?.code ?? 'internal',
        message: provider
          ? messageFor(provider.code)
          : 'Não conseguimos gerar sua arte desta vez. Seus créditos foram devolvidos.',
        meta: {
          ...partialMeta,
          costUsd,
          durationMs: Date.now() - startedAt,
        } as Partial<GenerationMeta>,
        costUsd,
      })
    }
  },
)

/**
 * Retry só do que adianta repetir.
 *
 * Erro de moderação e parâmetro inválido são determinísticos: repetir três
 * vezes só atrasa o estorno em vinte segundos e gasta cota à toa.
 */
async function withRetry<T>(action: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown

  for (let attempt = 1; attempt <= GENERATION_LIMITS.maxAttempts; attempt += 1) {
    try {
      return await action()
    } catch (error) {
      lastError = error
      const retryable = error instanceof ProviderError && error.retryable

      if (!retryable || attempt === GENERATION_LIMITS.maxAttempts) break

      console.warn(`[worker] ${label}: tentativa ${attempt} falhou, repetindo`, error)
      await wait(attempt)
    }
  }

  throw lastError
}

/** Mensagem que o usuário lê — em português, sem jargão de provedor. */
function messageFor(code: ProviderError['code']): string {
  switch (code) {
    case 'content_policy':
      return 'O conteúdo pedido não passou na moderação. Ajuste a descrição e tente de novo — seus créditos foram devolvidos.'
    case 'rate_limited':
      return 'Estamos com muitos pedidos agora. Tente de novo em alguns minutos — seus créditos foram devolvidos.'
    /**
     * Sem "tente de novo": o problema é do nosso lado e nenhuma tentativa dele
     * resolve. Mandar o usuário insistir aqui só o faria repetir o mesmo erro
     * até desistir do produto.
     */
    case 'quota_exhausted':
      return 'Estamos com um problema no nosso provedor de imagens e não foi possível gerar agora. Seus créditos foram devolvidos e já estamos sabendo.'
    case 'timeout':
      return 'A geração demorou mais que o esperado e foi interrompida. Seus créditos foram devolvidos.'
    default:
      return 'Não conseguimos gerar sua arte desta vez. Seus créditos foram devolvidos.'
  }
}
