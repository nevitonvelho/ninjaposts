import { COLLECTIONS } from '#shared/constants'
import type { GenerationOutput } from '#shared/types/generation'
import { downloadFileName } from '#shared/utils/format'

/**
 * Download da arte, servido pelo nosso domínio.
 *
 * Poderia ser um link direto para o Storage — e é mais barato —, mas o arquivo
 * chegaria com nome de máquina. O atributo `download` do `<a>` é **ignorado**
 * quando a URL é de outra origem, e `firebasestorage.googleapis.com` é outra
 * origem; montar um blob no cliente esbarraria em CORS, que o bucket não tem
 * configurado.
 *
 * Servindo daqui, mesma origem, o nome funciona e nada depende de configuração
 * de bucket. O preço é o arquivo (~1–2 MB) passar pelo servidor.
 *
 * A posse é conferida de novo aqui: o caminho no Storage é adivinhável a partir
 * do id da geração, e o Admin SDK ignora as Storage Rules por completo.
 */
const CONTENT_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
} as const

type DownloadFormat = keyof typeof CONTENT_TYPES

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)
  const { db, storage } = useFirebaseAdmin()

  const id = getRouterParam(event, 'id')
  if (!id) throw apiError('invalid_input', 'Informe a arte.')

  const format = (getQuery(event).format ?? 'png') as DownloadFormat
  if (!(format in CONTENT_TYPES)) {
    throw apiError('invalid_input', 'Formato inválido. Use png ou jpg.')
  }

  const snapshot = await db.collection(COLLECTIONS.generations).doc(id).get()

  // 404 e não 403, pela mesma razão da exclusão: confirmar a existência de um
  // id alheio já é informação.
  if (!snapshot.exists || snapshot.get('ownerId') !== context.uid) {
    throw apiError('not_found', 'Arte não encontrada.')
  }
  if (snapshot.get('deletedAt')) {
    throw apiError('not_found', 'Arte não encontrada.')
  }

  const output = snapshot.get('output') as GenerationOutput | null
  if (!output) {
    throw apiError('invalid_input', 'Esta arte ainda não ficou pronta.')
  }

  const path = format === 'png' ? output.imagePath : output.jpgPath
  if (!path) {
    throw apiError('not_found', `Esta arte não tem versão ${format.toUpperCase()}.`)
  }

  const file = storage.bucket().file(path)

  let contents: Buffer
  try {
    const [buffer] = await file.download()
    contents = buffer
  } catch (error) {
    /**
     * O documento existe mas o arquivo não: é o que acontece quando a retenção
     * de 24h já apagou o objeto e o documento ainda não expirou. Falar em
     * "expirou" é mais útil que um 500 genérico.
     */
    console.warn(`[download] arquivo ausente para ${id} (${path})`, error)
    throw apiError('not_found', 'Esta arte expirou e não está mais disponível.')
  }

  const product = (snapshot.get('input')?.product as string | undefined) ?? 'post'
  const createdAt = snapshot.get('createdAt')?.toDate?.() ?? new Date()

  /**
   * Contador de downloads — o campo `stats.downloads` existe para isto.
   *
   * Sem `await` e com o erro engolido de propósito: falhar um download de 2 MB
   * já entregue porque um contador não subiu seria trocar o essencial pelo
   * acessório.
   */
  db.collection(COLLECTIONS.users)
    .doc(context.uid)
    .update({ 'stats.downloads': FieldValue.increment(1) })
    .catch(error => console.warn(`[download] contador não subiu para ${context.uid}`, error))

  setResponseHeaders(event, {
    'Content-Type': CONTENT_TYPES[format],
    'Content-Length': String(contents.byteLength),
    'Content-Disposition': `attachment; filename="${downloadFileName(product, format, createdAt)}"`,
    // Privado: a URL é a mesma para todo mundo, e o conteúdo não é.
    'Cache-Control': 'private, max-age=3600',
  })

  return contents
})
