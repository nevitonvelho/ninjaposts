/**
 * Barrel das constantes. Importar via alias:
 *   import { CREDIT_PACKS, FORMATS } from '#shared/constants'
 *
 * Constantes ficam fora de `shared/types/` de propósito: o Nuxt auto-importa
 * `shared/types/` apenas como *tipos*. Valores de runtime precisam de import
 * explícito, e o alias `#shared` deixa isso legível nos três ambientes.
 */
export * from './collections'
export * from './formats'
export * from './limits'
export * from './niches'
export * from './packs'
export * from './palettes'
export * from './styles'
