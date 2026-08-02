import type { Unsubscribe } from 'firebase/firestore'
import {
  COLLECTIONS,
  GENERATION_LIMITS,
  STATUS_COPY,
  STATUS_PROGRESS,
  isActiveStatus,
} from '#shared/constants'
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

  /**
   * Passou do tempo em que ainda faz sentido esperar (§7.5).
   *
   * O relógio corre a partir do `createdAt` do documento, não da montagem da
   * tela: quem recarrega a página ou volta pela aba do histórico precisa ver o
   * mesmo aviso, e não um contador zerado que esconde meia hora de espera.
   *
   * Fica pausado enquanto o job não está ativo — um `setInterval` vivo numa
   * arte já pronta é trabalho que ninguém pediu.
   *
   * Depende do relógio do cliente, então adianta o aviso para quem está com a
   * hora errada. É um aviso, não uma mudança de estado: quem decide estornar é
   * o `reconcileStuckJobs`, com o relógio do servidor.
   */
  const { timestamp: now, pause, resume } = useTimestamp({ interval: 15_000, controls: true })

  watch(isActive, active => (active ? resume() : pause()), { immediate: true })

  const isSlow = computed(() => {
    if (!isActive.value) return false

    const createdAt = toDate(doc.value?.createdAt)
    if (!createdAt) return false

    return now.value - createdAt.getTime() >= GENERATION_LIMITS.slowAfterMs
  })

  return {
    generation: doc,
    status: readonly(status),
    error: readonly(error),
    isActive,
    isSlow,
    copy,
    progress,
  }
}
