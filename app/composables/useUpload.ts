import { STORAGE_PATHS, UPLOAD_LIMITS } from '#shared/constants'

/**
 * Upload da logo direto para o Cloud Storage, sem passar pelo Nitro.
 *
 * Subir o arquivo pela nossa API significaria receber 2MB em memória numa
 * Cloud Function só para reenviá-los ao bucket — mais latência, mais custo e um
 * limite de payload no meio do caminho. O SDK do cliente sobe direto, e as
 * Storage Rules (§2.10) fazem o papel de porteiro: só o dono escreve, só
 * imagem, no máximo 2MB.
 */

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

export function useLogoUpload() {
  const auth = useAuthStore()

  const status = ref<UploadStatus>('idle')
  /** 0–100. */
  const progress = ref(0)
  const error = ref<string | null>(null)

  let cancelUpload: (() => void) | null = null

  async function upload(file: File): Promise<string | null> {
    const uid = auth.user?.uid
    if (!uid) {
      error.value = 'Sua sessão expirou. Entre novamente para enviar a logo.'
      status.value = 'error'
      return null
    }

    // Mesma checagem das Storage Rules, adiantada: falhar depois de subir 2MB
    // por WiFi de celular é uma espera inútil.
    const check = validateLogoFile(file)
    if (!check.valid) {
      error.value = check.error
      status.value = 'error'
      return null
    }

    status.value = 'uploading'
    progress.value = 0
    error.value = null

    const { storage } = await useFirebaseAsync()
    const { getMetadata, ref: storageRef, uploadBytesResumable } = await import('firebase/storage')

    const extension = EXTENSIONS[file.type] ?? 'png'
    const path = STORAGE_PATHS.userLogo(uid, crypto.randomUUID(), extension)
    const task = uploadBytesResumable(storageRef(storage, path), file, {
      contentType: file.type,
      // Imutável por construção: cada upload gera um id novo, então o arquivo
      // nunca muda de conteúdo e pode ser cacheado para sempre.
      cacheControl: 'public, max-age=31536000, immutable',
    })

    cancelUpload = () => task.cancel()

    return new Promise<string | null>((resolve) => {
      task.on(
        'state_changed',
        (snapshot) => {
          progress.value = snapshot.totalBytes
            ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
            : 0
        },
        (err) => {
          cancelUpload = null
          // Cancelamento é ação do usuário, não falha: não vira alerta vermelho.
          if ((err as { code?: string }).code === 'storage/canceled') {
            status.value = 'idle'
            progress.value = 0
            resolve(null)
            return
          }
          status.value = 'error'
          error.value = firebaseErrorMessage(err)
          resolve(null)
        },
        async () => {
          cancelUpload = null
          progress.value = 100

          /**
           * Confirma o arquivo no bucket antes de declarar sucesso. Sem isto,
           * uma regra que rejeitasse o upload silenciosamente deixaria um
           * `logoPath` apontando para o vazio — e o erro só apareceria muito
           * depois, na hora de gerar a arte.
           */
          try {
            await getMetadata(task.snapshot.ref)
            status.value = 'success'
            resolve(path)
          } catch (err) {
            status.value = 'error'
            error.value = firebaseErrorMessage(err)
            resolve(null)
          }
        },
      )
    })
  }

  function cancel() {
    cancelUpload?.()
    cancelUpload = null
  }

  function reset() {
    status.value = 'idle'
    progress.value = 0
    error.value = null
  }

  /**
   * Apaga um arquivo do bucket. Erro aqui é deliberadamente silencioso: se a
   * logo antiga já não existe, remover a referência no formulário é o que o
   * usuário pediu — travar a UI por causa de um órfão de 40KB não ajuda ninguém.
   */
  async function remove(path: string) {
    try {
      const { storage } = await useFirebaseAsync()
      const { deleteObject, ref: storageRef } = await import('firebase/storage')
      await deleteObject(storageRef(storage, path))
    } catch (err) {
      if (import.meta.dev) console.warn('[upload] não foi possível remover a logo', err)
    }
  }

  onScopeDispose(cancel)

  return {
    status: readonly(status),
    progress: readonly(progress),
    error: readonly(error),
    maxBytes: UPLOAD_LIMITS.logoMaxBytes,
    accept: UPLOAD_LIMITS.logoMimeTypes.join(','),
    upload,
    cancel,
    reset,
    remove,
  }
}
