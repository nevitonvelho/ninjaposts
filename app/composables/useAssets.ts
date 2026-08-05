import { COLLECTIONS, UNIVERSAL_NICHE } from '#shared/constants'
import type { AssetDoc, AssetKind } from '#shared/types/asset'

/**
 * Leitura e curadoria da biblioteca de assets.
 *
 * Escreve direto pelo SDK do cliente, como o perfil: as Security Rules já
 * negam escrita a quem não tem a claim `role: 'admin'`, e um endpoint no Nitro
 * só reencaminharia o que elas aprovam — uma segunda cópia da mesma regra, que
 * é o tipo que diverge com o tempo.
 */

export interface AssetDraft {
  kind: AssetKind
  name: string
  niches: string[]
  path: string
  description: string
  isActive: boolean
  sortOrder: number
}

export function emptyAssetDraft(kind: AssetKind = 'style'): AssetDraft {
  return { kind, name: '', niches: [], path: '', description: '', isActive: true, sortOrder: 0 }
}

/**
 * Lista assets de um tipo, em tempo real.
 *
 * `onSnapshot` e não leitura única: a grade do admin precisa refletir o upload
 * que acabou de acontecer, e o seletor de produtos do usuário precisa perder
 * na hora um asset que você desativou.
 */
export function useAssets(kind: MaybeRefOrGetter<AssetKind>, options: { activeOnly?: boolean } = {}) {
  const items = ref<AssetDoc[]>([])
  const pending = ref(true)
  const error = ref<string | null>(null)

  let unsubscribe: (() => void) | null = null

  watchEffect(async (onCleanup) => {
    const value = toValue(kind)
    pending.value = true
    error.value = null

    const { db } = await useFirebaseAsync()
    const { collection, onSnapshot, orderBy, query, where } = await import('firebase/firestore')

    const constraints = [where('kind', '==', value)]
    if (options.activeOnly) constraints.push(where('isActive', '==', true))

    unsubscribe?.()
    unsubscribe = onSnapshot(
      query(collection(db, COLLECTIONS.assets), ...constraints, orderBy('sortOrder', 'asc')),
      (snapshot) => {
        items.value = snapshot.docs.map(doc => ({ ...(doc.data() as AssetDoc), id: doc.id }))
        pending.value = false
      },
      (err) => {
        error.value = firebaseErrorMessage(err)
        pending.value = false
      },
    )

    onCleanup(() => {
      unsubscribe?.()
      unsubscribe = null
    })
  })

  return { items, pending, error }
}

export function useAssetLibrary() {
  const auth = useAuthStore()
  const toast = useToast()

  const saving = ref(false)
  const errors = ref<Record<string, string[]>>({})

  function errorFor(field: string): string[] | null {
    return errors.value[field] ?? null
  }

  async function create(draft: AssetDraft): Promise<boolean> {
    const uid = auth.user?.uid
    if (!uid || saving.value) return false

    const parsed = assetSchema.safeParse(draft)
    if (!parsed.success) {
      errors.value = fieldErrors(parsed.error)
      toast.warning('Revise os campos destacados.')
      return false
    }

    errors.value = {}
    saving.value = true

    try {
      const { db } = await useFirebaseAsync()
      const { addDoc, collection, serverTimestamp } = await import('firebase/firestore')

      const created = await addDoc(collection(db, COLLECTIONS.assets), {
        ...parsed.data,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      /**
       * `id` também dentro do documento, não só como id da doc.
       * O worker lê estes documentos com o Admin SDK e passa o objeto adiante;
       * ter o id no corpo evita carregar o snapshot junto só para saber quem é.
       */
      const { doc, updateDoc } = await import('firebase/firestore')
      await updateDoc(doc(db, COLLECTIONS.assets, created.id), { id: created.id })

      toast.success('Asset adicionado à biblioteca.')
      return true
    } catch (error) {
      toast.error(firebaseErrorMessage(error))
      return false
    } finally {
      saving.value = false
    }
  }

  /** Ativar/desativar em vez de excluir — gerações antigas referenciam o id. */
  async function setActive(asset: AssetDoc, isActive: boolean) {
    try {
      const { db } = await useFirebaseAsync()
      const { doc, serverTimestamp, updateDoc } = await import('firebase/firestore')
      await updateDoc(doc(db, COLLECTIONS.assets, asset.id), {
        isActive,
        updatedAt: serverTimestamp(),
      })
    } catch (error) {
      toast.error(firebaseErrorMessage(error))
    }
  }

  /**
   * Exclusão de verdade — documento e arquivo.
   *
   * A ordem importa: apaga o documento primeiro. Se o arquivo sumisse antes e
   * a exclusão do documento falhasse, a biblioteca ficaria mostrando um asset
   * cuja imagem não carrega, e o worker tentaria anexar um arquivo inexistente.
   */
  async function remove(asset: AssetDoc) {
    try {
      const { db } = await useFirebaseAsync()
      const { deleteDoc, doc } = await import('firebase/firestore')
      await deleteDoc(doc(db, COLLECTIONS.assets, asset.id))

      const { storage } = await useFirebaseAsync()
      const { deleteObject, ref: storageRef } = await import('firebase/storage')
      await deleteObject(storageRef(storage, asset.path)).catch(() => {})

      toast.info('Asset removido.')
    } catch (error) {
      toast.error(firebaseErrorMessage(error))
    }
  }

  return { saving, errors, errorFor, create, setActive, remove }
}

/**
 * Ordena os assets para o nicho pedido: os do nicho primeiro, universais depois.
 *
 * Filtrar no cliente, e não numa query por nicho, porque o seletor de produtos
 * já tem a lista inteira em memória por `onSnapshot` — uma segunda consulta
 * custaria uma ida à rede para reordenar meia dúzia de itens.
 */
export function sortAssetsForNiche<T extends { niches: string[] }>(
  assets: T[],
  niche: string,
): T[] {
  const slug = slugify(niche)
  const rank = (asset: T) => {
    if (slug && asset.niches.includes(slug)) return 0
    if (asset.niches.includes(UNIVERSAL_NICHE)) return 1
    return 2
  }
  return [...assets].sort((a, b) => rank(a) - rank(b))
}
