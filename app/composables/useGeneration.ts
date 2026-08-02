import type { Unsubscribe } from 'firebase/firestore'
import { COLLECTIONS, STATUS_COPY, STATUS_PROGRESS, isActiveStatus } from '#shared/constants'
import type { GenerationDoc } from '#shared/types/generation'

/**
 * Um job de geração, em tempo real.
 *
 * `onSnapshot` e não polling: o worker escreve `status` e `progress` a cada
 * etapa (§7.1), e o Firestore entrega a mudança em milissegundos. Polling de
 * 2s mostraria uma barra que anda aos trancos e faria N leituras por job.
 */
export function useGeneration(id: MaybeRefOrGetter<string>) {
  const doc = ref<GenerationDoc | null>(null)
  const status = ref<'loading' | 'ready' | 'not_found' | 'error'>('loading')
  const error = ref<string | null>(null)

  let unsubscribe: Unsubscribe | null = null

  async function subscribe(generationId: string) {
    unsubscribe?.()
    status.value = 'loading'
    error.value = null

    const { db } = await useFirebaseAsync()
    const { doc: docRef, onSnapshot } = await import('firebase/firestore')

    unsubscribe = onSnapshot(
      docRef(db, COLLECTIONS.generations, generationId),
      (snapshot) => {
        if (!snapshot.exists()) {
          /**
           * Pode ser id inválido — ou uma arte que já passou das 24h e foi
           * apagada pela retenção (§0.5). A tela precisa dizer as duas coisas,
           * porque "não encontrado" sozinho parece bug para quem gerou ontem.
           */
          doc.value = null
          status.value = 'not_found'
          return
        }
        doc.value = { ...(snapshot.data() as GenerationDoc), id: snapshot.id }
        status.value = 'ready'
      },
      (err) => {
        status.value = 'error'
        error.value = firebaseErrorMessage(err)
      },
    )
  }

  watch(
    () => toValue(id),
    (generationId) => {
      if (generationId) void subscribe(generationId)
    },
    { immediate: true },
  )

  onScopeDispose(() => unsubscribe?.())

  const isActive = computed(() => (doc.value ? isActiveStatus(doc.value.status) : false))

  const copy = computed(() =>
    doc.value ? STATUS_COPY[doc.value.status] : STATUS_COPY.queued,
  )

  /**
   * A barra usa o progresso do documento, mas nunca deixa cair: uma etapa que
   * reescreve um valor menor faria a barra andar para trás, que lê como erro.
   */
  const progress = computed(() => {
    if (!doc.value) return 0
    return Math.max(doc.value.progress, STATUS_PROGRESS[doc.value.status])
  })

  return {
    generation: doc,
    status: readonly(status),
    error: readonly(error),
    isActive,
    copy,
    progress,
  }
}
