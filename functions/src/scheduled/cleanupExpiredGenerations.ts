import { onSchedule } from 'firebase-functions/v2/scheduler'
import { COLLECTIONS } from '../../../shared/constants'
import { Timestamp, db } from '../lib/admin'
import { REGION } from '../lib/env'
import { deleteGenerationFiles } from '../services/storage'

/**
 * Retenção de 24h (§0.5) — a rotina que **cumpre** a promessa.
 *
 * O TTL do Firestore e o ciclo de vida do bucket também apagam, mas os dois
 * rodam uma varredura por dia e não coordenam entre si: uma arte poderia ficar
 * com o documento apagado e o arquivo no ar, ou o contrário, por várias horas.
 * Esta rotina apaga o par junto, de hora em hora — as outras duas são rede de
 * segurança para o caso de ela falhar.
 *
 * A ordem importa: **arquivos primeiro, documento depois**. Se apagássemos o
 * documento antes e a exclusão dos arquivos falhasse, ninguém saberia que
 * aqueles arquivos existem — órfãos invisíveis, pagos para sempre.
 */
export const cleanupExpiredGenerations = onSchedule(
  {
    schedule: 'every 60 minutes',
    timeZone: 'America/Sao_Paulo',
    region: REGION,
    memory: '512MiB',
    timeoutSeconds: 540,
  },
  async () => {
    const now = Timestamp.now()
    let removed = 0
    let files = 0

    /**
     * Em lotes, e não tudo de uma vez: um pico de uso deixaria milhares de
     * documentos vencidos, e carregar todos numa query estoura a memória da
     * função. O que sobrar deste lote sai na próxima hora.
     */
    const BATCH = 200

    const expired = await db
      .collection(COLLECTIONS.generations)
      .where('expiresAt', '<=', now)
      .limit(BATCH)
      .get()

    if (expired.empty) return

    for (const doc of expired.docs) {
      const ownerId = doc.get('ownerId') as string | undefined
      if (!ownerId) continue

      try {
        files += await deleteGenerationFiles(ownerId, doc.id)
        await doc.ref.delete()
        removed += 1
      } catch (error) {
        // Uma falha não pode derrubar o lote: o próximo ciclo tenta de novo.
        console.error(`[cleanup] falha ao remover ${doc.id}`, error)
      }
    }

    console.info(`[cleanup] ${removed} gerações e ${files} arquivos removidos.`)
  },
)
