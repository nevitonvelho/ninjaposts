import type { Auditable } from './firestore'

/**
 * `assets/{assetId}` — biblioteca curada, escrita só por admin.
 *
 * São duas bibliotecas com naturezas opostas, num documento só:
 *
 * - `style`   — peças que representam o padrão de arte de um nicho. O worker
 *               anexa uma ao render para o modelo **imitar a linguagem visual**,
 *               nunca o conteúdo. O usuário não escolhe e nem vê.
 * - `product` — PNGs de objetos reais (a garrafa de Coca, a embalagem). O
 *               usuário escolhe na hora de criar, e o modelo desenha **aquele
 *               objeto**, com rótulo e proporções, em vez de inventar um
 *               parecido.
 *
 * Ficam na mesma coleção porque tudo que as cerca é idêntico — upload, rules,
 * CRUD e a tela de admin. O que difere é só o consumo, e é o que `kind` separa.
 */
export type AssetKind = 'style' | 'product'

export interface AssetDoc extends Auditable {
  id: string
  kind: AssetKind
  /** Rótulo interno, para você achar na grade. Não vai para o prompt. */
  name: string
  /** Slugs de nicho, ou `['universal']`. Sempre passados por `slugify`. */
  niches: string[]
  /** Caminho no Storage, não URL — mesma razão de `BrandSettings.logoPath`. */
  path: string
  /**
   * Só para `product`: como o objeto é descrito ao modelo.
   *
   * "Garrafa de Coca-Cola 2L, rótulo vermelho" diz ao modelo o que ele está
   * vendo; sem isso, uma garrafa recortada em fundo transparente pode ser lida
   * como elemento de fundo e sumir da composição.
   */
  description: string | null
  /**
   * Desativar em vez de excluir: gerações antigas referenciam o id, e a grade
   * do admin precisa continuar explicando de onde veio a arte de ontem.
   */
  isActive: boolean
  sortOrder: number
  /** uid do admin que subiu. */
  createdBy: string
}
