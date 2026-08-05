import { ASSET_LIMITS, STORAGE_PATHS, UPLOAD_LIMITS, validateAssetFile } from '#shared/constants'
import type { AssetKind } from '#shared/types/asset'

/**
 * Upload direto para o Cloud Storage, sem passar pelo Nitro.
 *
 * Subir o arquivo pela nossa API significaria receber megabytes em memória numa
 * Cloud Function só para reenviá-los ao bucket — mais latência, mais custo e um
 * limite de payload no meio do caminho. O SDK do cliente sobe direto, e as
 * Storage Rules (§2.10) fazem o papel de porteiro: quem pode escrever onde, que
 * tipo e até que tamanho.
 *
 * O miolo é o mesmo para logo e para a biblioteca de assets — o que muda é o
 * caminho, o limite e quem tem permissão. Por isso `createUpload` recebe isso
 * como parâmetro em vez de existirem duas cópias do mesmo `uploadBytesResumable`
 * com barra de progresso e tratamento de cancelamento.
 */

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

interface UploadSpec {
  /** Valida antes de gastar a banda do usuário. Espelha as Storage Rules. */
  validate: (file: { size: number; type: string }) => { valid: boolean; error: string | null }
  /** Monta o caminho final. Recebe o uid e a extensão já resolvida. */
  path: (uid: string, fileId: string, ext: string) => string
  accept: readonly string[]
  maxBytes: number
  /** Mensagem quando a sessão caiu no meio do caminho. */
  sessionError: string
}

function createUpload(spec: UploadSpec) {
  const auth = useAuthStore()

  const status = ref<UploadStatus>('idle')
  /** 0–100. */
  const progress = ref(0)
  const error = ref<string | null>(null)

  let cancelUpload: (() => void) | null = null

  async function upload(file: File): Promise<string | null> {
    const uid = auth.user?.uid
    if (!uid) {
      error.value = spec.sessionError
      status.value = 'error'
      return null
    }

    // Mesma checagem das Storage Rules, adiantada: falhar depois de subir o
    // arquivo inteiro por WiFi de celular é uma espera inútil.
    const check = spec.validate(file)
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
    const path = spec.path(uid, crypto.randomUUID(), extension)
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
           * caminho apontando para o vazio — e o erro só apareceria muito
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
   * Apaga um arquivo do bucket. Erro aqui é deliberadamente silencioso: se o
   * arquivo já não existe, remover a referência é o que o usuário pediu —
   * travar a UI por causa de um órfão de 40KB não ajuda ninguém.
   */
  async function remove(path: string) {
    try {
      const { storage } = await useFirebaseAsync()
      const { deleteObject, ref: storageRef } = await import('firebase/storage')
      await deleteObject(storageRef(storage, path))
    } catch (err) {
      if (import.meta.dev) console.warn('[upload] não foi possível remover o arquivo', err)
    }
  }

  onScopeDispose(cancel)

  return {
    status: readonly(status),
    progress: readonly(progress),
    error: readonly(error),
    maxBytes: spec.maxBytes,
    accept: spec.accept.join(','),
    upload,
    cancel,
    reset,
    remove,
  }
}

export function useLogoUpload() {
  return createUpload({
    validate: validateLogoFile,
    path: (uid, fileId, ext) => STORAGE_PATHS.userLogo(uid, fileId, ext),
    accept: UPLOAD_LIMITS.logoMimeTypes,
    maxBytes: UPLOAD_LIMITS.logoMaxBytes,
    sessionError: 'Sua sessão expirou. Entre novamente para enviar a logo.',
  })
}

/**
 * Upload da biblioteca de assets. Só admin passa pelas Storage Rules — o
 * `uid` no caminho não aparece de propósito: o arquivo pertence ao produto,
 * não a quem subiu, e continua válido se aquele admin sair.
 */
export function useAssetUpload(kind: MaybeRefOrGetter<AssetKind>) {
  return createUpload({
    validate: validateAssetFile,
    path: (_uid, fileId, ext) => STORAGE_PATHS.asset(toValue(kind), fileId, ext),
    accept: ASSET_LIMITS.mimeTypes,
    maxBytes: ASSET_LIMITS.maxBytes,
    sessionError: 'Sua sessão expirou. Entre novamente para enviar o arquivo.',
  })
}
