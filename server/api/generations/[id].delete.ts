import { COLLECTIONS, isActiveStatus } from '#shared/constants'
import type { GenerationStatus } from '#shared/types/generation'

/**
 * Exclusão pedida pelo usuário — **lógica**, não física.
 *
 * `deletedAt` some o item do histórico mas mantém o registro para auditoria de
 * crédito: precisamos poder responder "esta geração foi cobrada?" mesmo depois
 * de o usuário apagá-la. Os arquivos e o documento somem de vez em até 24h,
 * pela retenção (§0.5) — não há por que apagar duas vezes.
 *
 * Job em andamento não pode ser apagado: o worker ainda vai escrever nele, e o
 * crédito ainda pode voltar por estorno. Cancelar é outra operação.
 */
export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)
  const { db } = useFirebaseAdmin()

  const id = getRouterParam(event, 'id')
  if (!id) throw apiError('invalid_input', 'Informe a geração.')

  const ref = db.collection(COLLECTIONS.generations).doc(id)
  const snapshot = await ref.get()

  if (!snapshot.exists || snapshot.get('ownerId') !== context.uid) {
    // 404 e não 403: confirmar a existência de um id alheio já é informação.
    throw apiError('not_found', 'Arte não encontrada.')
  }

  if (isActiveStatus(snapshot.get('status') as GenerationStatus)) {
    throw apiError('invalid_input', 'Esta arte ainda está sendo gerada. Aguarde terminar.')
  }

  if (snapshot.get('deletedAt')) return { ok: true, alreadyDeleted: true }

  await ref.update({ deletedAt: Timestamp.now(), updatedAt: Timestamp.now() })

  return { ok: true }
})
