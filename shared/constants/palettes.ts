/**
 * Paletas de partida.
 *
 * A maioria dos donos de negócio não sabe o hex da própria marca — mas
 * reconhece a paleta quando vê. Oferecer um ponto de partida decente evita o
 * resultado mais comum de um seletor de cor livre: quatro tons de vermelho
 * berrante que brigam entre si.
 *
 * A primeira cor é sempre a dominante, como em `BrandSettings.colors`.
 */

export interface PaletteSpec {
  id: string
  label: string
  colors: string[]
}

export const BRAND_PALETTES: PaletteSpec[] = [
  { id: 'apetitoso', label: 'Apetitoso', colors: ['#d62828', '#f77f00', '#fcbf49'] },
  { id: 'natural', label: 'Natural', colors: ['#386641', '#6a994e', '#a7c957'] },
  { id: 'oceano', label: 'Oceano', colors: ['#023e8a', '#0077b6', '#48cae4'] },
  { id: 'sofisticado', label: 'Sofisticado', colors: ['#1b1b1e', '#4a4e69', '#c9ada7'] },
  { id: 'doce', label: 'Doce', colors: ['#7b2cbf', '#e0479e', '#ffc2d1'] },
  { id: 'terroso', label: 'Terroso', colors: ['#6f4518', '#a68a64', '#e6ccb2'] },
  { id: 'energia', label: 'Energia', colors: ['#3a0ca3', '#f72585', '#4cc9f0'] },
  { id: 'monocromatico', label: 'Monocromático', colors: ['#0b0b0f', '#5c5c66', '#d9d9e0'] },
]
