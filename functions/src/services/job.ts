import { COLLECTIONS, STATS_DOCS, STATUS_PROGRESS } from '../../../shared/constants'
import type {
  GenerationErrorCode,
  GenerationMeta,
  GenerationOutput,
  GenerationStatus,
} from '../../../shared/types/generation'
import { FieldValue, Timestamp, db } from '../lib/admin'

/**
 * Ciclo de vida do job, do lado do banco.
 *
 * Duas invariantes governam tudo aqui:
 *
 * 1. **`activeJobs` volta exatamente uma vez.** Ele sobe na criação do job
 *    (API) e desce quando o job termina, dê certo ou errado. Se descer duas
 *    vezes, o contador vira negativo e o limite de concorrência deixa de valer.
 * 2. **Estorno é idempotente.** O flag `refunded` no documento é a guarda: o
 *    Eventarc reentrega eventos, e o cron de jobs travados pode correr junto
 *    com o worker. Estornar duas vezes é dar crédito de graça.
 */

/** Avança o status e o progresso — é o que o cliente vê em tempo real. */
export async function advance(generationId: string, status: GenerationStatus): Promise<void> {
  await db.collection(COLLECTIONS.generations).doc(generationId).update({
    status,
    progress: STATUS_PROGRESS[status],
    updatedAt: Timestamp.now(),
  })
}

/** Incrementa os agregados que o painel admin lê (§2.7). */
function bumpStats(
  tx: FirebaseFirestore.Transaction,
  fields: Partial<Record<'generations' | 'generationsFailed', number>> & { costUsd?: number },
): void {
  const day = new Date().toISOString().slice(0, 10)
  const payload = {
    ...Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [key, FieldValue.increment(value ?? 0)]),
    ),
    updatedAt: Timestamp.now(),
  }

  tx.set(db.collection(COLLECTIONS.stats).doc(STATS_DOCS.global), payload, { merge: true })
  tx.set(db.collection(COLLECTIONS.stats).doc(STATS_DOCS.daily(day)), payload, { merge: true })
}

export interface CompleteParams {
  generationId: string
  ownerId: string
  output: GenerationOutput
  meta: GenerationMeta
}

export async function completeJob(params: CompleteParams): Promise<void> {
  const generationRef = db.collection(COLLECTIONS.generations).doc(params.generationId)
  const userRef = db.collection(COLLECTIONS.users).doc(params.ownerId)

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(generationRef)
    if (!snapshot.exists) return

    const now = Timestamp.now()

    tx.update(generationRef, {
      status: 'completed',
      progress: 100,
      error: null,
      output: params.output,
      meta: params.meta,
      completedAt: now,
      updatedAt: now,
    })

    tx.update(userRef, {
      activeJobs: FieldValue.increment(-1),
      'stats.generations': FieldValue.increment(1),
      updatedAt: now,
    })

    bumpStats(tx, { generations: 1, costUsd: params.meta.costUsd })
  })
}

export interface FailParams {
  generationId: string
  ownerId: string
  code: GenerationErrorCode
  message: string
  meta?: Partial<GenerationMeta> | null
  /** Custo já gasto antes de falhar — o briefing pode ter sido pago. */
  costUsd?: number
}

/**
 * Marca como falho e devolve o crédito.
 *
 * Estorno é automático e não pedido: cobrar por uma arte que não existe é o
 * caminho mais curto para um chargeback, e o custo de API já foi gasto de
 * qualquer forma — devolver o crédito é mais barato que perder o cliente.
 */
export async function failJob(params: FailParams): Promise<void> {
  const generationRef = db.collection(COLLECTIONS.generations).doc(params.generationId)
  const userRef = db.collection(COLLECTIONS.users).doc(params.ownerId)

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(generationRef)
    if (!snapshot.exists) return

    // Já finalizado por outra execução (reentrega do Eventarc, cron): não mexe.
    const status = snapshot.get('status') as GenerationStatus
    if (status === 'completed' || status === 'failed' || status === 'canceled') return

    const alreadyRefunded = Boolean(snapshot.get('refunded'))
    const charged = (snapshot.get('creditsCharged') as number | undefined) ?? 0
    const now = Timestamp.now()

    let balanceAfter: number | null = null

    if (!alreadyRefunded && charged > 0) {
      const user = await tx.get(userRef)
      balanceAfter = ((user.get('credits') as number | undefined) ?? 0) + charged

      tx.update(userRef, {
        credits: balanceAfter,
        activeJobs: FieldValue.increment(-1),
        updatedAt: now,
      })

      tx.set(db.collection(COLLECTIONS.creditLedger).doc(), {
        ownerId: params.ownerId,
        delta: charged,
        balanceAfter,
        reason: 'refund',
        refId: params.generationId,
        note: `Estorno automático: ${params.message}`,
        createdAt: now,
      })
    } else {
      tx.update(userRef, { activeJobs: FieldValue.increment(-1), updatedAt: now })
    }

    tx.update(generationRef, {
      status: 'failed',
      progress: 100,
      error: { code: params.code, message: params.message },
      refunded: alreadyRefunded || charged > 0,
      ...(params.meta ? { meta: params.meta } : {}),
      completedAt: now,
      updatedAt: now,
    })

    bumpStats(tx, { generationsFailed: 1, costUsd: params.costUsd ?? 0 })
  })
}
