import { STORAGE_PATHS } from '../../../shared/constants'
import { storage } from '../lib/admin'
import type { ProcessedImage } from './image'

/**
 * Etapa UPLOAD.
 *
 * `cacheControl` longo e imutável: cada geração escreve seus arquivos uma única
 * vez, num caminho que inclui o id do job, então o conteúdo nunca muda. Como as
 * artes expiram em 24h (§0.5), o cache do navegador some junto com elas.
 */

const CACHE_CONTROL = 'public, max-age=31536000, immutable'

export async function uploadGenerationFiles(
  uid: string,
  generationId: string,
  image: ProcessedImage,
): Promise<{ imagePath: string; jpgPath: string; thumbPath: string }> {
  const bucket = storage.bucket()

  const files = [
    { path: STORAGE_PATHS.generationOriginal(uid, generationId), body: image.png, type: 'image/png' },
    { path: STORAGE_PATHS.generationJpg(uid, generationId), body: image.jpg, type: 'image/jpeg' },
    { path: STORAGE_PATHS.generationThumb(uid, generationId), body: image.thumb, type: 'image/webp' },
  ]

  await Promise.all(
    files.map(file =>
      bucket.file(file.path).save(file.body, {
        contentType: file.type,
        metadata: { cacheControl: CACHE_CONTROL },
        resumable: false,
      }),
    ),
  )

  return {
    imagePath: files[0]!.path,
    jpgPath: files[1]!.path,
    thumbPath: files[2]!.path,
  }
}

/** Baixa a logo do usuário para mandar como referência ao modelo. */
export async function downloadLogo(logoPath: string): Promise<Buffer | null> {
  try {
    const [buffer] = await storage.bucket().file(logoPath).download()
    return buffer
  } catch (error) {
    /**
     * Logo ausente não derruba a geração: o usuário perde a marca na arte, mas
     * recebe a arte — muito melhor que falhar o job inteiro e ter que estornar
     * por causa de um arquivo que ele apagou depois de enviar.
     */
    console.warn(`[storage] logo ${logoPath} indisponível, seguindo sem ela`, error)
    return null
  }
}

/** Remove os arquivos de uma geração. Usado pela rotina de retenção. */
export async function deleteGenerationFiles(uid: string, generationId: string): Promise<number> {
  const [files] = await storage.bucket().getFiles({ prefix: `generations/${uid}/${generationId}/` })

  await Promise.all(files.map(file => file.delete({ ignoreNotFound: true })))
  return files.length
}
