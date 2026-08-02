import { COLLECTIONS } from '#shared/constants'
import type { ClaimPurchasesResponse } from '#shared/types/api'

/**
 * Reivindica compras feitas antes do cadastro.
 *
 * O checkout acontece fora do app (link hospedado pelo gateway), então nada
 * garante que quem pagou já tenha conta. Essas compras ficam em `purchases`
 * com `ownerId: null`, esperando. Sem este endpoint, comprar antes de se
 * cadastrar seria dinheiro entrando e crédito nenhum saindo — e viraria
 * suporte manual, um a um.
 *
 * **Só e-mail confirmado reivindica.** É o que impede alguém de se cadastrar
 * com o e-mail de outra pessoa e levar a compra dela. Quem ainda não confirmou
 * recebe a contagem do que está pendente, para a UI poder pedir a confirmação
 * em vez de simplesmente não creditar em silêncio.
 *
 * Idempotente: `creditedAt` é gravado na mesma transação do crédito, então
 * chamar de novo não credita duas vezes.
 */
export default defineEventHandler(async (event): Promise<ClaimPurchasesResponse> => {
  const context = await requireAuth(event)
  const { db } = useFirebaseAdmin()

  const email = context.email?.trim().toLowerCase()
  if (!email) return { claimed: 0, credits: 0, pending: 0, emailVerified: false }

  const pendingQuery = db
    .collection(COLLECTIONS.purchases)
    .where('email', '==', email)
    .where('creditedAt', '==', null)
    .limit(20)

  try {
    const pending = await pendingQuery.get()

    // Compra reembolsada antes de ser reivindicada não vira crédito.
    const claimable = pending.docs.filter(doc => doc.get('status') === 'paid')
    if (!claimable.length) {
      return { claimed: 0, credits: 0, pending: 0, emailVerified: context.emailVerified }
    }

    if (!context.emailVerified) {
      return {
        claimed: 0,
        credits: 0,
        pending: claimable.reduce((total, doc) => total + ((doc.get('credits') as number) ?? 0), 0),
        emailVerified: false,
      }
    }

    /**
     * Uma transação por compra, e não uma para todas.
     *
     * Se a quinta falhar, as quatro anteriores já creditadas continuam válidas
     * — e a próxima chamada pega só o que sobrou. Uma transação única
     * desfaria tudo por causa de um documento problemático.
     */
    let claimed = 0
    let credits = 0

    for (const doc of claimable) {
      const purchaseRef = doc.ref

      const granted = await db.runTransaction(async (tx) => {
        const snapshot = await tx.get(purchaseRef)
        if (!snapshot.exists || snapshot.get('creditedAt') || snapshot.get('status') !== 'paid') {
          return 0
        }

        const amount = (snapshot.get('credits') as number | undefined) ?? 0
        if (amount <= 0) return 0

        await applyCreditMutation(tx, {
          uid: context.uid,
          delta: amount,
          reason: 'purchase',
          refId: snapshot.id,
          note: 'Compra reivindicada após o cadastro',
        })

        tx.update(purchaseRef, {
          ownerId: context.uid,
          creditedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        })

        return amount
      })

      if (granted > 0) {
        claimed += 1
        credits += granted
      }
    }

    return { claimed, credits, pending: 0, emailVerified: true }
  } catch (error) {
    /**
     * `failed-precondition` aqui é quase sempre índice composto ausente
     * (`email ASC, creditedAt ASC`). Vale distinguir na mensagem: o genérico
     * mandaria procurar bug no código quando falta rodar o deploy de índices.
     */
    if ((error as { code?: string | number }).code === 9) {
      console.error(
        '[claim-purchases] índice composto ausente em purchases(email, creditedAt). '
        + 'Rode `npm run firebase:indexes`.',
        error,
      )
    }
    throw internalError(`reivindicação de compras de ${context.uid}`, error)
  }
})
