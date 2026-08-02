import type { Transaction } from 'firebase-admin/firestore'
import { COLLECTIONS } from '#shared/constants'
import type { CreditReason } from '#shared/types/user'

/**
 * Mutação de saldo — o **único** caminho por onde crédito muda de valor.
 *
 * Toda alteração escreve duas coisas na mesma transação: o novo saldo em
 * `users/{uid}` e uma entrada imutável em `creditLedger`. Sem o par, o suporte
 * não consegue responder "de onde veio (ou para onde foi) esse crédito?" — e
 * saldo sem histórico é impossível de auditar depois que o usuário reclama.
 *
 * Recebe a transação em vez de abrir a própria: quem chama já precisa ler o
 * webhook, a compra e o usuário no mesmo instante atômico. Duas transações
 * aninhadas dariam a janela exata para creditar duas vezes.
 */
export interface CreditMutation {
  uid: string
  /** Negativo = débito. */
  delta: number
  reason: CreditReason
  /** Id da compra, da geração ou do admin responsável. */
  refId: string | null
  note?: string | null
}

export interface CreditMutationResult {
  balanceBefore: number
  balanceAfter: number
}

/**
 * Aplica a mutação. **Precisa ser chamada depois de todas as leituras** da
 * transação — o Firestore proíbe ler após escrever.
 *
 * O saldo pode ficar negativo em estorno de reembolso: quem gerou 10 artes e
 * pediu o dinheiro de volta fica devendo. Isso é dívida real, não bug — cortar
 * em zero esconderia o prejuízo do painel e deixaria a pessoa comprar de novo
 * como se nada tivesse acontecido.
 */
export async function applyCreditMutation(
  tx: Transaction,
  mutation: CreditMutation,
): Promise<CreditMutationResult> {
  const { db } = useFirebaseAdmin()
  const userRef = db.collection(COLLECTIONS.users).doc(mutation.uid)

  const snapshot = await tx.get(userRef)
  if (!snapshot.exists) {
    throw new Error(`usuário ${mutation.uid} não existe`)
  }

  const balanceBefore = (snapshot.get('credits') as number | undefined) ?? 0
  const balanceAfter = balanceBefore + mutation.delta
  const now = Timestamp.now()

  /**
   * `stats.creditsPurchased` é histórico, não saldo: só sobe, e só em compra.
   * Estorno de reembolso não o desconta de propósito — o total comprado
   * continua sendo o que a pessoa comprou.
   */
  const bumpsPurchased = mutation.reason === 'purchase' && mutation.delta > 0

  tx.update(userRef, {
    credits: balanceAfter,
    updatedAt: now,
    ...(bumpsPurchased ? { 'stats.creditsPurchased': FieldValue.increment(mutation.delta) } : {}),
  })

  tx.set(db.collection(COLLECTIONS.creditLedger).doc(), {
    ownerId: mutation.uid,
    delta: mutation.delta,
    balanceAfter,
    reason: mutation.reason,
    refId: mutation.refId,
    note: mutation.note ?? null,
    createdAt: now,
  })

  return { balanceBefore, balanceAfter }
}

/**
 * Resolve o e-mail da compra para um `uid`.
 *
 * Vai ao Firebase Auth, e não ao Firestore: o Auth é quem normaliza e garante
 * unicidade de e-mail. Uma query em `users.email` dependeria de o campo ter
 * sido gravado com a mesma capitalização — e "Joao@Gmail.com" no checkout não
 * acharia a conta salva como "joao@gmail.com".
 *
 * Fica fora da transação de propósito: só precisamos do id. O saldo continua
 * sendo lido e escrito atomicamente lá dentro.
 */
export async function findUidByEmail(email: string): Promise<string | null> {
  const { auth } = useFirebaseAdmin()

  try {
    const user = await auth.getUserByEmail(email.trim())
    return user.uid
  } catch (error) {
    if ((error as { code?: string }).code === 'auth/user-not-found') return null
    throw error
  }
}
