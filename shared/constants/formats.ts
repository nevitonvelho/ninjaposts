import type { PostFormat, SocialNetwork } from '../types/generation'

/**
 * Tamanhos suportados nativamente pelo modelo de imagem.
 * Pedir qualquer outra dimensão à API é erro — o ajuste fino é feito no
 * pós-processamento com `sharp`, a partir de um destes três.
 */
export type RenderSize = '1024x1024' | '1024x1536' | '1536x1024'

export interface FormatSpec {
  id: PostFormat
  label: string
  description: string
  /** Tamanho pedido ao modelo. */
  renderSize: RenderSize
  /** Dimensão final entregue ao usuário, após recorte/redimensionamento. */
  output: { width: number; height: number }
  /** Rótulo de proporção para a UI. */
  ratio: string
}

export const FORMATS: Record<PostFormat, FormatSpec> = {
  square: {
    id: 'square',
    label: 'Feed quadrado',
    description: 'Instagram e Facebook',
    renderSize: '1024x1024',
    output: { width: 1080, height: 1080 },
    ratio: '1:1',
  },
  portrait: {
    id: 'portrait',
    label: 'Feed vertical',
    description: 'Maior área na timeline',
    renderSize: '1024x1536',
    output: { width: 1080, height: 1350 },
    ratio: '4:5',
  },
  story: {
    id: 'story',
    label: 'Story / Reels',
    description: 'Tela cheia no celular',
    renderSize: '1024x1536',
    output: { width: 1080, height: 1920 },
    ratio: '9:16',
  },
  landscape: {
    id: 'landscape',
    label: 'Horizontal',
    description: 'LinkedIn e capas',
    renderSize: '1536x1024',
    output: { width: 1200, height: 800 },
    ratio: '3:2',
  },
}

export const FORMAT_LIST: FormatSpec[] = Object.values(FORMATS)

export interface NetworkSpec {
  id: SocialNetwork
  label: string
  icon: string
  /** Formato pré-selecionado ao escolher a rede. */
  defaultFormat: PostFormat
  formats: PostFormat[]
  /** Limite de caracteres da legenda, usado na validação e no contador da UI. */
  captionLimit: number
  hashtagLimit: number
}

export const NETWORKS: Record<SocialNetwork, NetworkSpec> = {
  instagram: {
    id: 'instagram',
    label: 'Instagram',
    icon: 'lucide:instagram',
    defaultFormat: 'square',
    formats: ['square', 'portrait', 'story'],
    captionLimit: 2200,
    hashtagLimit: 30,
  },
  facebook: {
    id: 'facebook',
    label: 'Facebook',
    icon: 'lucide:facebook',
    defaultFormat: 'square',
    formats: ['square', 'portrait', 'landscape', 'story'],
    captionLimit: 5000,
    hashtagLimit: 10,
  },
  tiktok: {
    id: 'tiktok',
    label: 'TikTok',
    icon: 'lucide:music-2',
    defaultFormat: 'story',
    formats: ['story'],
    captionLimit: 2200,
    hashtagLimit: 10,
  },
  linkedin: {
    id: 'linkedin',
    label: 'LinkedIn',
    icon: 'lucide:linkedin',
    defaultFormat: 'landscape',
    formats: ['landscape', 'square', 'portrait'],
    captionLimit: 3000,
    hashtagLimit: 5,
  },
  whatsapp: {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: 'lucide:message-circle',
    defaultFormat: 'story',
    formats: ['story', 'square'],
    captionLimit: 1000,
    hashtagLimit: 0,
  },
}

export const NETWORK_LIST: NetworkSpec[] = Object.values(NETWORKS)

// ---------------------------------------------------------------------------
// Custo em créditos
// ---------------------------------------------------------------------------

/**
 * Fonte única do custo de uma geração. O cliente usa para mostrar o preço
 * antes de gerar; o servidor usa para debitar. Nunca duplicar esta regra.
 *
 * Preço único e sem exceção: **1 crédito por arte**, e regerar custa o mesmo,
 * porque é outra chamada ao modelo de imagem. Uma tabela de custo por formato
 * ou por qualidade obrigaria o usuário a fazer conta antes de clicar — e a
 * economia de API não paga esse atrito.
 */
export const CREDIT_COST_PER_GENERATION = 1

export function creditCostFor(): number {
  return CREDIT_COST_PER_GENERATION
}

/** Formatos válidos para a rede escolhida — usado para não oferecer combinação inválida. */
export function formatsForNetworks(networks: SocialNetwork[]): PostFormat[] {
  if (!networks.length) return FORMAT_LIST.map(f => f.id)
  const sets = networks.map(n => new Set(NETWORKS[n].formats))
  return FORMAT_LIST.map(f => f.id).filter(id => sets.every(set => set.has(id)))
}
