import type { Unsubscribe } from 'firebase/firestore'
import { COLLECTIONS } from '#shared/constants'
import type { GenerationDoc } from '#shared/types/generation'

export type ListStatus = 'idle' | 'loading' | 'ready' | 'error'

/**
 * Gerações mais recentes do usuário, em tempo real.
 *
 * `onSnapshot` e não leitura única: um job em andamento muda de status várias
 * vezes, e a grade precisa refletir isso sem o usuário recarregar a página.
 * Com o cache persistente do Firestore, a primeira pintura vem do disco local
 * e a rede só confirma depois.
 */
export function useRecentGenerations(max = 6) {
  const auth = useAuthStore()

  const items = ref<GenerationDoc[]>([])
  const status = ref<ListStatus>('idle')
  const error = ref<string | null>(null)
  const missingIndex = ref(false)

  let unsubscribe: Unsubscribe | null = null

  async function subscribe(uid: string) {
    unsubscribe?.()
    status.value = 'loading'
    error.value = null
    missingIndex.value = false

    const { db } = await useFirebaseAsync()
    const { collection, limit, onSnapshot, orderBy, query, where } = await import('firebase/firestore')

    const q = query(
      collection(db, COLLECTIONS.generations),
      where('ownerId', '==', uid),
      // Exclusão é lógica (§2.3): o histórico some da lista mas continua
      // auditável. Este filtro é o que exige o índice composto.
      where('deletedAt', '==', null),
      orderBy('createdAt', 'desc'),
      limit(max),
    )

    unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        items.value = snapshot.docs.map(d => ({ ...(d.data() as GenerationDoc), id: d.id }))
        status.value = 'ready'
      },
      (err) => {
        status.value = 'error'
        error.value = firebaseErrorMessage(err)

        /**
         * `failed-precondition` aqui significa quase sempre índice composto
         * ausente. Vale distinguir: a mensagem genérica mandaria o dev procurar
         * bug no código, quando falta rodar `npm run firebase:indexes`.
         */
        if ((err as { code?: string }).code === 'failed-precondition') {
          missingIndex.value = true
          if (import.meta.dev) {
            console.warn(
              '[generations] índice composto ausente. Rode `npm run firebase:indexes`.',
              err,
            )
          }
        }
      },
    )
  }

  watch(
    () => auth.user?.uid,
    (uid) => {
      if (uid) {
        void subscribe(uid)
      } else {
        unsubscribe?.()
        unsubscribe = null
        items.value = []
        status.value = 'idle'
      }
    },
    { immediate: true },
  )

  onScopeDispose(() => unsubscribe?.())

  return {
    // `items` sai sem `readonly()` de propósito: o `DeepReadonly` se propaga
    // para dentro de cada documento e passa a conflitar com o tipo dos props
    // (`readonly SocialNetwork[]` vs `SocialNetwork[]`) em todo componente que
    // consome a lista. O ganho de imutabilidade não paga esse atrito.
    items,
    status: readonly(status),
    error: readonly(error),
    missingIndex: readonly(missingIndex),
    isEmpty: computed(() => status.value === 'ready' && items.value.length === 0),
  }
}
