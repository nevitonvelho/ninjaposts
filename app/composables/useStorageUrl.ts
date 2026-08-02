import type { MaybeRefOrGetter } from 'vue'

/**
 * Cache de módulo: caminho no Storage → URL de download.
 *
 * `getDownloadURL` é uma chamada de rede. Sem cache, uma grade com 12 posts
 * dispararia 12 requisições, e voltar para a mesma tela dispararia tudo de
 * novo. O caminho é imutável (cada geração escreve seus arquivos uma única
 * vez), então cachear indefinidamente é seguro.
 */
const cache = new Map<string, Promise<string>>()

function resolveUrl(path: string): Promise<string> {
  const cached = cache.get(path)
  if (cached) return cached

  const promise = (async () => {
    const { storage } = await useFirebaseAsync()
    const { getDownloadURL, ref: storageRef } = await import('firebase/storage')
    return getDownloadURL(storageRef(storage, path))
  })()

  cache.set(path, promise)
  // Falha não fica cacheada: um erro transitório de rede não pode condenar a
  // imagem a nunca mais carregar nesta sessão.
  promise.catch(() => cache.delete(path))

  return promise
}

export function useStorageUrl(path: MaybeRefOrGetter<string | null | undefined>) {
  const url = ref<string | null>(null)
  const pending = ref(false)
  const error = ref<string | null>(null)

  watchEffect(async (onCleanup) => {
    const value = toValue(path)
    url.value = null
    error.value = null

    if (!value) return

    let stale = false
    onCleanup(() => {
      stale = true
    })

    pending.value = true
    try {
      const resolved = await resolveUrl(value)
      // O caminho pode ter mudado enquanto a promise estava pendente.
      if (!stale) url.value = resolved
    } catch (err) {
      if (!stale) error.value = firebaseErrorMessage(err)
    } finally {
      if (!stale) pending.value = false
    }
  })

  return { url, pending, error }
}
