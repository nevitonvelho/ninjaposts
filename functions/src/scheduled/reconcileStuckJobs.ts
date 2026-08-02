import { onSchedule } from 'firebase-functions/v2/scheduler'
import { ACTIVE_STATUSES, COLLECTIONS, GENERATION_LIMITS } from '../../../shared/constants'
import { Timestamp, db } from '../lib/admin'
import { REGION } from '../lib/env'
import { failJob } from '../services/job'

/**
 * Jobs travados (§7.5).
 *
 * O worker pode morrer sem escrever nada: estouro de memória, timeout duro da
 * plataforma, deploy no meio da execução. Nesses casos o documento fica em
 * `rendering` para sempre, o `activeJobs` do usuário nunca desce — e ele fica
 * sem conseguir gerar, com o crédito já debitado. É o pior desfecho possível.
 *
 * O corte de 10 minutos é folgado de propósito: uma geração normal leva de 20s
 * a 90s, então nada legítimo chega perto disso. Marcar cedo demais estornaria
 * um job que ainda estava vivo — e aí sairiam duas imagens por um crédito.
 */
export const reconcileStuckJobs = onSchedule(
  {
    schedule: 'every 10 minutes',
    timeZone: 'America/Sao_Paulo',
    region: REGION,
    memory: '256MiB',
  },
  async () => {
    const cutoff = Timestamp.fromMillis(Date.now() - GENERATION_LIMITS.stuckAfterMs)

    const stuck = await db
      .collection(COLLECTIONS.generations)
      .where('status', 'in', ACTIVE_STATUSES)
      .where('updatedAt', '<=', cutoff)
      .limit(50)
      .get()

    if (stuck.empty) return

    for (const doc of stuck.docs) {
      const ownerId = doc.get('ownerId') as string | undefined
      if (!ownerId) continue

      console.warn(`[reconcile] ${doc.id} preso em "${doc.get('status')}" — estornando.`)

      try {
        /**
         * `failJob` já é idempotente e só age em job não finalizado. Se o
         * worker acordar no meio e completar, quem chegar depois não faz nada.
         */
        await failJob({
          generationId: doc.id,
          ownerId,
          code: 'timeout',
          message: 'A geração não terminou a tempo. Seus créditos foram devolvidos.',
        })
      } catch (error) {
        console.error(`[reconcile] falha ao estornar ${doc.id}`, error)
      }
    }
  },
)
