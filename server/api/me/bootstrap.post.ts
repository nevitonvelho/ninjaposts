import { COLLECTIONS, SIGNUP_BONUS_CREDITS, emptyBrandSettings } from '#shared/constants'

/**
 * Cria `users/{uid}` no primeiro acesso.
 *
 * Por que no servidor e não no cliente: este documento carrega `credits` e
 * `role`. Se o cliente pudesse criá-lo, escolheria o próprio saldo.
 * As Security Rules negam `create` em `users/` justamente para forçar este
 * caminho.
 *
 * Idempotente: chamar várias vezes (duas abas, retry de rede, refresh no meio
 * do cadastro) nunca concede o bônus duas vezes — a checagem de existência e a
 * escrita acontecem dentro da mesma transação.
 *
 * Nota de arquitetura: na Etapa 7 isto vira também um trigger `onUserCreated`,
 * para cobrir contas criadas fora do app (console, importação). O endpoint
 * continua sendo o caminho síncrono, que é o que permite o app mostrar os
 * créditos imediatamente em vez de esperar o trigger.
 */
export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)
  const { db } = useFirebaseAdmin()

  const userRef = db.collection(COLLECTIONS.users).doc(context.uid)

  try {
    const created = await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(userRef)
      if (snapshot.exists) return false

      const now = Timestamp.now()

      tx.set(userRef, {
        uid: context.uid,
        email: context.email ?? '',
        displayName: context.name?.trim() || context.email?.split('@')[0] || 'Novo usuário',
        photoURL: context.picture ?? null,
        company: null,
        role: 'user',

        // Sem plano e sem `creditsResetAt`: o saldo é pré-pago e não expira.
        credits: SIGNUP_BONUS_CREDITS,
        activeJobs: 0,

        brand: emptyBrandSettings(),
        stats: { generations: 0, downloads: 0, creditsPurchased: 0 },

        createdAt: now,
        updatedAt: now,
        lastSeenAt: now,
      })

      // Toda mutação de saldo gera entrada no ledger — inclusive a primeira.
      // É o que permite responder "de onde vieram esses créditos?" no suporte.
      tx.set(db.collection(COLLECTIONS.creditLedger).doc(), {
        ownerId: context.uid,
        delta: SIGNUP_BONUS_CREDITS,
        balanceAfter: SIGNUP_BONUS_CREDITS,
        reason: 'signup_bonus',
        refId: null,
        note: 'Bônus de boas-vindas',
        createdAt: now,
      })

      return true
    })

    return {
      created,
      credits: created ? SIGNUP_BONUS_CREDITS : undefined,
    }
  } catch (error) {
    throw internalError(`bootstrap do usuário ${context.uid}`, error)
  }
})
