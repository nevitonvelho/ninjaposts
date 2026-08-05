import { COLLECTIONS, UNIVERSAL_NICHE } from '../../../shared/constants'
import { slugify } from '../../../shared/utils/format'
import type { AssetDoc } from '../../../shared/types/asset'
import { db, storage } from '../lib/admin'

/**
 * Biblioteca de assets, do lado do worker.
 *
 * Duas coisas diferentes saem daqui:
 *
 * - a **referência de estilo**, escolhida pelo sistema a partir do nicho — é
 *   como a direção de arte deixa de ser adjetivo no prompt e passa a ser
 *   exemplo visual;
 * - os **produtos**, escolhidos pelo usuário — é o que faz a garrafa de Coca
 *   sair com o rótulo real em vez de um vermelho parecido.
 */

/** Quantos candidatos buscar antes de sortear. Teto para não varrer a coleção. */
const CANDIDATE_LIMIT = 20

export interface ResolvedAsset {
  id: string
  name: string
  description: string | null
  buffer: Buffer
}

/**
 * Baixa um arquivo do bucket, tolerando ausência.
 *
 * Mesma política do `downloadLogo`: asset sumido custa uma imagem de entrada,
 * não a geração inteira. Falhar o job forçaria um estorno por causa de um
 * arquivo que o admin apagou entre a escolha do usuário e o render.
 */
async function download(path: string): Promise<Buffer | null> {
  try {
    const [buffer] = await storage.bucket().file(path).download()
    return buffer
  } catch (error) {
    console.warn(`[assets] ${path} indisponível, seguindo sem ele`, error)
    return null
  }
}

async function queryAssets(kind: string, niche: string | null): Promise<AssetDoc[]> {
  let query = db
    .collection(COLLECTIONS.assets)
    .where('kind', '==', kind)
    .where('isActive', '==', true)

  if (niche) query = query.where('niches', 'array-contains', niche)

  const snapshot = await query.orderBy('sortOrder', 'asc').limit(CANDIDATE_LIMIT).get()
  return snapshot.docs.map(doc => ({ ...(doc.data() as AssetDoc), id: doc.id }))
}

/**
 * Referência de estilo para o nicho, sorteada entre as candidatas.
 *
 * O sorteio existe para que dois posts seguidos do mesmo produto não saiam
 * iguais. A alternativa — sempre a de maior prioridade — daria a todo cliente
 * de pizzaria peças com a mesma cara, o que aparece no dia em que dois
 * concorrentes da mesma rua usam o app.
 *
 * Busca pelo nicho e, sem resultado, cai para as universais. Sem nenhuma das
 * duas, devolve `null` e o render segue como antes — a biblioteca vazia não
 * pode ser um requisito para gerar.
 */
export async function pickStyleReference(niche: string): Promise<ResolvedAsset | null> {
  const slug = slugify(niche)

  const candidates = (slug ? await queryAssets('style', slug) : [])
  const pool = candidates.length ? candidates : await queryAssets('style', UNIVERSAL_NICHE)
  if (!pool.length) return null

  const chosen = pool[Math.floor(Math.random() * pool.length)]!
  const buffer = await download(chosen.path)
  if (!buffer) return null

  return { id: chosen.id, name: chosen.name, description: chosen.description, buffer }
}

/**
 * Produtos escolhidos pelo usuário, na ordem em que ele escolheu.
 *
 * `getAll` em vez de N leituras: são até 3 ids conhecidos, e uma ida só ao
 * Firestore. Documento inexistente vem sem `exists` e é descartado junto com
 * os inativos — o usuário pode ter escolhido algo que o admin desativou entre
 * o preenchimento do formulário e o render.
 */
export async function resolveProductAssets(ids: string[]): Promise<ResolvedAsset[]> {
  if (!ids.length) return []

  const refs = ids.map(id => db.collection(COLLECTIONS.assets).doc(id))
  const snapshots = await db.getAll(...refs)

  const docs = snapshots
    .filter(snapshot => snapshot.exists && snapshot.get('isActive') === true)
    .map(snapshot => ({ ...(snapshot.data() as AssetDoc), id: snapshot.id }))

  const resolved = await Promise.all(
    docs.map(async (doc) => {
      const buffer = await download(doc.path)
      return buffer
        ? { id: doc.id, name: doc.name, description: doc.description, buffer }
        : null
    }),
  )

  return resolved.filter((item): item is ResolvedAsset => item !== null)
}
