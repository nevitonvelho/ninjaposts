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
   * **Em português**, como o resto do prompt de imagem. A referência que
   * comprovadamente funciona para este produto é um prompt inteiramente em
   * pt-BR — e o texto que a arte precisa grafar também é português. Misturar
   * idiomas custaria mais do que qualquer ganho de vocabulário do inglês.
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
      'composição minimalista, fundo liso e amplo espaço negativo, um único ponto focal, iluminação suave e difusa, paleta reduzida, tipografia limpa sem serifa',
    preview: 'from-zinc-100 to-zinc-200',
  },
  moderno: {
    id: 'moderno',
    label: 'Moderno',
    description: 'Geométrico e contemporâneo',
    promptFragment:
      'design contemporâneo com formas geométricas, blocos de cor sólidos, grid assimétrico, sombras longas e nítidas, alto contraste',
    preview: 'from-violet-200 to-indigo-300',
  },
  elegante: {
    id: 'elegante',
    label: 'Elegante',
    description: 'Sofisticado e discreto',
    promptFragment:
      'estética sofisticada, tipografia serifada refinada, texturas sutis de mármore ou linho, iluminação lateral suave, paleta neutra com um acento metálico',
    preview: 'from-stone-200 to-amber-100',
  },
  vibrante: {
    id: 'vibrante',
    label: 'Vibrante',
    description: 'Cores fortes e energia',
    promptFragment:
      'cores altamente saturadas, contraste intenso, gradientes energéticos, iluminação dramática, composição dinâmica em diagonal',
    preview: 'from-orange-300 to-pink-400',
  },
  retro: {
    id: 'retro',
    label: 'Retrô',
    description: 'Nostalgia dos anos 70–90',
    promptFragment:
      'estética vintage anos 80, grão de filme, paleta desbotada quente, tipografia condensada da época, textura de papel impresso',
    preview: 'from-amber-200 to-red-300',
  },
  luxuoso: {
    id: 'luxuoso',
    label: 'Luxuoso',
    description: 'Premium e exclusivo',
    promptFragment:
      'apresentação premium, fundo escuro profundo, detalhes dourados, reflexos suaves, iluminação de estúdio direcional, acabamento acetinado',
    preview: 'from-zinc-800 to-yellow-700',
  },
  divertido: {
    id: 'divertido',
    label: 'Divertido',
    description: 'Descontraído e jovem',
    promptFragment:
      'ilustração lúdica, formas arredondadas, cores alegres, elementos flutuantes, sombras macias, clima descontraído e acolhedor',
    preview: 'from-sky-200 to-emerald-300',
  },
  natural: {
    id: 'natural',
    label: 'Natural',
    description: 'Orgânico e artesanal',
    promptFragment:
      'estética orgânica, luz natural de janela, texturas de madeira e tecido cru, tons terrosos, composição fotográfica realista',
    preview: 'from-lime-200 to-stone-300',
  },
  tecnologico: {
    id: 'tecnologico',
    label: 'Tecnológico',
    description: 'Futurista e digital',
    promptFragment:
      'estética futurista, luz neon fria, superfícies escuras com reflexo, linhas de grid, brilho volumétrico, acabamento digital de alta precisão',
    preview: 'from-cyan-300 to-blue-600',
  },
  artesanal: {
    id: 'artesanal',
    label: 'Artesanal',
    description: 'Feito à mão, afetivo',
    promptFragment:
      'aparência feita à mão, traços de pincel e lettering manual, textura de papel kraft, colagem, imperfeições intencionais',
    preview: 'from-orange-200 to-amber-300',
  },
}

export const STYLE_LIST: StyleSpec[] = Object.values(STYLES)
