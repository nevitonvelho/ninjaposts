/**
 * Utilitários de cor — isomórficos.
 *
 * Vivem em `shared/` porque servem aos dois lados: o formulário avisa que uma
 * cor não sustenta texto legível, e o worker (Etapa 7, modo `hybrid`) usa o
 * mesmo cálculo para escolher a cor do texto que compõe sobre a arte. Duas
 * implementações do mesmo contraste acabariam discordando.
 *
 * A fórmula é a da WCAG 2.1 (luminância relativa + razão de contraste).
 */

const HEX = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/** Aceita `#abc`, `abc`, `#aabbcc` — devolve sempre `#aabbcc` minúsculo, ou `null`. */
export function normalizeHex(value: string): string | null {
  const match = value.trim().match(HEX)
  if (!match) return null

  const digits = match[1]!.toLowerCase()
  const full = digits.length === 3 ? digits.split('').map(d => d + d).join('') : digits
  return `#${full}`
}

export function isHexColor(value: string): boolean {
  return normalizeHex(value) !== null
}

export function hexToRgb(value: string): { r: number; g: number; b: number } | null {
  const hex = normalizeHex(value)
  if (!hex) return null
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  }
}

/** Luminância relativa WCAG, de 0 (preto) a 1 (branco). */
export function relativeLuminance(value: string): number {
  const rgb = hexToRgb(value)
  if (!rgb) return 0

  const channel = (raw: number) => {
    const c = raw / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }

  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
}

/** Razão de contraste entre duas cores: 1 (idênticas) a 21 (preto no branco). */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (light! + 0.05) / (dark! + 0.05)
}

/** Cor de texto que melhor se lê sobre o fundo informado. */
export function bestTextColor(background: string): '#ffffff' | '#09090b' {
  return contrastRatio(background, '#ffffff') >= contrastRatio(background, '#09090b')
    ? '#ffffff'
    : '#09090b'
}

export interface ColorReadability {
  /** Melhor razão de contraste alcançável com texto branco ou preto. */
  ratio: number
  textColor: string
  /** WCAG AA para texto normal. */
  passesAA: boolean
  /** Quase branca: some contra o fundo da própria peça. */
  tooLight: boolean
  warning: string | null
}

export function checkReadability(color: string): ColorReadability {
  const textColor = bestTextColor(color)
  const ratio = contrastRatio(color, textColor)
  const tooLight = contrastRatio(color, '#ffffff') < 1.4

  return {
    ratio,
    textColor,
    passesAA: ratio >= 4.5,
    tooLight,
    warning: tooLight
      ? 'Muito clara — pode sumir em fundos brancos.'
      : ratio < 4.5
        ? 'Contraste baixo: texto sobre esta cor fica difícil de ler.'
        : null,
  }
}
