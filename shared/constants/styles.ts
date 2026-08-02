import type { StyleId } from '../types/generation'

export interface StyleSpec {
  id: StyleId
  label: string
  description: string
  /**
   * Fragmento injetado no briefing criativo. Descreve *direção de arte*
   * (luz, textura, composição), não adjetivos vagos — é o que o modelo de
   * imagem realmente consegue executar.
   *
   * **Em inglês**, ao contrário do resto do arquivo: ele é copiado para dentro
   * do `imagePrompt`, que precisa sair em inglês. Escrevê-lo em português
   * obrigava o modelo de texto a traduzir no meio do caminho, e direção de arte
   * traduzida chega diluída.
   */
  promptFragment: string
  /** Gradiente de pré-visualização enquanto não há imagem de exemplo. */
  preview: string
}

export const STYLES: Record<StyleId, StyleSpec> = {
  minimalista: {
    id: 'minimalista',
    label: 'Minimalista',
    description: 'Muito espaço, poucos elementos',
    promptFragment:
      'minimalist composition, flat uncluttered background and generous negative space, a single focal point, soft diffused lighting, reduced palette, clean sans-serif typography',
    preview: 'from-zinc-100 to-zinc-200',
  },
  moderno: {
    id: 'moderno',
    label: 'Moderno',
    description: 'Geométrico e contemporâneo',
    promptFragment:
      'contemporary design with geometric shapes, solid colour blocks, asymmetric grid, long crisp shadows, high contrast',
    preview: 'from-violet-200 to-indigo-300',
  },
  elegante: {
    id: 'elegante',
    label: 'Elegante',
    description: 'Sofisticado e discreto',
    promptFragment:
      'sophisticated aesthetic, refined serif typography, subtle marble or linen textures, soft side lighting, neutral palette with one metallic accent',
    preview: 'from-stone-200 to-amber-100',
  },
  vibrante: {
    id: 'vibrante',
    label: 'Vibrante',
    description: 'Cores fortes e energia',
    promptFragment:
      'highly saturated colour, intense contrast, energetic gradients, dramatic lighting, dynamic diagonal composition',
    preview: 'from-orange-300 to-pink-400',
  },
  retro: {
    id: 'retro',
    label: 'Retrô',
    description: 'Nostalgia dos anos 70–90',
    promptFragment:
      'eighties vintage aesthetic, film grain, warm faded palette, period condensed typography, printed paper texture',
    preview: 'from-amber-200 to-red-300',
  },
  luxuoso: {
    id: 'luxuoso',
    label: 'Luxuoso',
    description: 'Premium e exclusivo',
    promptFragment:
      'premium presentation, deep dark background, gold detailing, soft reflections, directional studio lighting, satin finish',
    preview: 'from-zinc-800 to-yellow-700',
  },
  divertido: {
    id: 'divertido',
    label: 'Divertido',
    description: 'Descontraído e jovem',
    promptFragment:
      'playful illustration, rounded shapes, cheerful colours, floating elements, soft shadows, relaxed and welcoming mood',
    preview: 'from-sky-200 to-emerald-300',
  },
  natural: {
    id: 'natural',
    label: 'Natural',
    description: 'Orgânico e artesanal',
    promptFragment:
      'organic aesthetic, natural window light, raw wood and fabric textures, earthy tones, realistic photographic composition',
    preview: 'from-lime-200 to-stone-300',
  },
  tecnologico: {
    id: 'tecnologico',
    label: 'Tecnológico',
    description: 'Futurista e digital',
    promptFragment:
      'futuristic aesthetic, cool neon light, dark reflective surfaces, grid lines, volumetric glow, high-precision digital finish',
    preview: 'from-cyan-300 to-blue-600',
  },
  artesanal: {
    id: 'artesanal',
    label: 'Artesanal',
    description: 'Feito à mão, afetivo',
    promptFragment:
      'handmade look, brush strokes and hand lettering, kraft paper texture, collage, intentional imperfections',
    preview: 'from-orange-200 to-amber-300',
  },
}

export const STYLE_LIST: StyleSpec[] = Object.values(STYLES)
