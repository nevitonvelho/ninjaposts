import {
  COLLECTIONS,
  CREDIT_COST_PER_GENERATION,
  GENERATION_LIMITS,
  retentionExpiresAt,
} from '#shared/constants'
import type { CreateGenerationResponse } from '#shared/types/api'

/**
 * Cria o job de geração — a porta por onde crédito **sai**.
 *
 * O trabalho pesado não acontece aqui (§0.3): o caminho Hosting → Cloud
 * Function tem timeout rígido de 60s e uma geração leva de 20s a 90s. Este
 * endpoint debita, grava o documento e responde 202; o worker reage ao
 * `onDocumentCreated` e o cliente acompanha por `onSnapshot`.
 *
 * O débito acontece **na criação**, não no fim. Cobrar depois abriria a janela
 * clássica: N requisições paralelas passam todas pela checagem de saldo antes
 * de qualquer uma debitar, e cinco artes saem por um crédito.
 */
export default defineEventHandler(async (event): Promise<CreateGenerationResponse> => {
  const context = await requireAuth(event)
  const { db } = useFirebaseAdmin()

  const parsed = createGenerationSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw apiError(
      'invalid_input',
      'Revise os campos do formulário.',
      fieldErrors(parsed.error),
    )
  }

  const { input, projectId, parentId } = parsed.data

  /**
   * A logo precisa ser do próprio usuário.
   *
   * O `logoPath` chega do cliente como texto livre, e o worker lê esse caminho
   * com o Admin SDK — que ignora as Storage Rules. Sem esta checagem, alguém
   * poderia apontar para `users/<outro-uid>/logo/...` e usar a marca alheia na
   * própria arte. É o tipo de furo que a rule do Storage sozinha não cobre.
   */
  if (input.logoPath && !input.logoPath.startsWith(`users/${context.uid}/logo/`)) {
    throw apiError('forbidden', 'Esta logo não pertence à sua conta.')
  }

  /**
   * `contactItems` **não** é conferido contra o perfil de propósito.
   *
   * A checagem da logo existe porque o caminho aponta para o arquivo de outra
   * pessoa. Aqui não há dado alheio envolvido: o telefone é do próprio usuário,
   * e ele já poderia escrever qualquer texto na peça por `promotion` ou
   * `extraInstructions`. Reconciliar com `users/{uid}` só adicionaria uma
   * leitura e um jeito novo de o formulário falhar quando o perfil muda no meio
   * do preenchimento.
   */

  if (projectId) {
    const project = await db.collection(COLLECTIONS.projects).doc(projectId).get()
    if (!project.exists || project.get('ownerId') !== context.uid) {
      throw apiError('not_found', 'Projeto não encontrado.')
    }
  }

  const generationRef = db.collection(COLLECTIONS.generations).doc()
  const userRef = db.collection(COLLECTIONS.users).doc(context.uid)
  const cost = CREDIT_COST_PER_GENERATION

  try {
    const creditsRemaining = await db.runTransaction(async (tx) => {
      const user = await tx.get(userRef)
      if (!user.exists) {
        throw apiError('not_found', 'Sua conta ainda está sendo preparada. Tente em instantes.')
      }

      const credits = (user.get('credits') as number | undefined) ?? 0
      const activeJobs = (user.get('activeJobs') as number | undefined) ?? 0

      if (credits < cost) {
        throw apiError(
          'insufficient_credits',
          'Você está sem créditos. Compre um pacote para continuar criando.',
        )
      }
      if (activeJobs >= GENERATION_LIMITS.maxConcurrentJobs) {
        throw apiError(
          'too_many_active_jobs',
          `Você já tem ${GENERATION_LIMITS.maxConcurrentJobs} artes sendo geradas. Aguarde uma terminar.`,
        )
      }

      const now = Timestamp.now()

      const { balanceAfter } = await applyCreditMutation(tx, {
        uid: context.uid,
        delta: -cost,
        reason: 'generation',
        refId: generationRef.id,
        note: `Geração de arte: ${input.product}`,
      })

      /**
       * `activeJobs` sobe na mesma transação do débito.
       *
       * Incrementar depois — quando o worker acorda — deixaria uma janela em
       * que o limite de concorrência não vale, e é exatamente nela que um
       * clique duplo dispara dois jobs.
       */
      tx.update(userRef, { activeJobs: FieldValue.increment(1) })

      tx.set(generationRef, {
        id: generationRef.id,
        ownerId: context.uid,
        projectId,

        input,
        status: 'queued',
        progress: 0,
        error: null,
        output: null,
        meta: null,

        creditsCharged: cost,
        refunded: false,
        parentId,

        createdAt: now,
        updatedAt: now,
        completedAt: null,
        deletedAt: null,
        // Retenção de 24h (§0.5): é este campo que a política de TTL lê.
        expiresAt: Timestamp.fromDate(retentionExpiresAt(now.toDate())),
      })

      return balanceAfter
    })

    setResponseStatus(event, 202)
    return { id: generationRef.id, creditsCharged: cost, creditsRemaining }
  } catch (error) {
    // Erros de negócio já vêm formatados de `apiError`; só o resto vira 500.
    if ((error as { statusCode?: number }).statusCode) throw error
    throw internalError(`criação de geração para ${context.uid}`, error)
  }
})
