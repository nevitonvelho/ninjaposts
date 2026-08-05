import type { AssetKind } from '../types/asset'

/**
 * Regras da biblioteca de assets, compartilhadas pelo admin, pelo formulário
 * de geração e pelo worker.
 */

/**
 * Nicho-curinga.
 *
 * Existe porque `array-contains` não casa array vazio: sem uma sentinela,
 * "serve a qualquer nicho" exigiria varrer a coleção inteira a cada geração.
 *
 * Fica em `constants/` e não em `types/` porque é valor de runtime — o Nuxt
 * auto-importa `shared/types/` apenas como tipos.
 */
export const UNIVERSAL_NICHE = 'universal'

export interface AssetKindSpec {
  id: AssetKind
  label: string
  /** Explicação na tela do admin — a diferença entre os dois não é óbvia. */
  description: string
  icon: string
}

export const ASSET_KINDS: Record<AssetKind, AssetKindSpec> = {
  style: {
    id: 'style',
    label: 'Referência de estilo',
    description:
      'Peça pronta que representa o padrão de arte do nicho. O modelo imita a '
      + 'linguagem visual — fundo, tipografia, energia — sem copiar o conteúdo. '
      + 'Entra sozinha, pelo nicho; o usuário não escolhe.',
    icon: 'lucide:palette',
  },
  product: {
    id: 'product',
    label: 'Produto',
    description:
      'PNG de um objeto real (garrafa, embalagem, lata). O usuário escolhe na '
      + 'hora de criar e o modelo desenha exatamente esse objeto, com rótulo e '
      + 'proporções, em vez de inventar um parecido.',
    icon: 'lucide:package',
  },
}

export const ASSET_KIND_LIST: AssetKindSpec[] = Object.values(ASSET_KINDS)

export const ASSET_LIMITS = {
  /**
   * Menor que os 5MB do Storage por margem: a galeria do admin renderiza o
   * arquivo original (não há pipeline de thumbnail), e 20 assets de 5MB numa
   * grade travam a página.
   */
  maxBytes: 4 * 1024 * 1024,
  mimeTypes: ['image/png', 'image/jpeg', 'image/webp'] as const,
  name: { min: 2, max: 60 },
  description: { max: 160 },
  niches: { max: 8 },
  /**
   * Produtos por arte. Cada um é uma imagem a mais na chamada — mais custo, e
   * mais chance de o modelo espremer objetos numa cena que já tem o produto
   * principal, a logo e o texto.
   */
  perGeneration: 3,
} as const

/** Espelha as Storage Rules. A regra no servidor é a que vale; esta dá feedback imediato. */
export function validateAssetFile(file: { size: number; type: string }): {
  valid: boolean
  error: string | null
} {
  if (!(ASSET_LIMITS.mimeTypes as readonly string[]).includes(file.type)) {
    return { valid: false, error: 'Envie um arquivo PNG, JPG ou WebP.' }
  }
  if (file.size > ASSET_LIMITS.maxBytes) {
    return { valid: false, error: `O arquivo deve ter no máximo ${ASSET_LIMITS.maxBytes / 1024 / 1024}MB.` }
  }
  return { valid: true, error: null }
}
