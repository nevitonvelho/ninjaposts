/**
 * Formatação isomórfica — auto-importada no cliente e no Nitro.
 * Nada aqui pode depender de `window` ou de APIs de Node.
 */

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** Dinheiro é sempre armazenado em centavos (inteiro) para evitar erro de ponto flutuante. */
export function formatPriceCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return ''
  return BRL.format(cents / 100)
}

/** Converte o que o usuário digita ("29,90", "R$ 29.90") em centavos. */
export function parsePriceToCents(input: string): number | null {
  const cleaned = input.replace(/[^\d,.-]/g, '').trim()
  if (!cleaned) return null

  // pt-BR usa vírgula como decimal; o último separador é o decimal.
  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  const decimalSep = lastComma > lastDot ? ',' : lastDot > lastComma ? '.' : null

  let normalized = cleaned
  if (decimalSep) {
    const [intPart, decPart = ''] = [
      cleaned.slice(0, cleaned.lastIndexOf(decimalSep)),
      cleaned.slice(cleaned.lastIndexOf(decimalSep) + 1),
    ]
    normalized = `${intPart.replace(/[^\d-]/g, '')}.${decPart.replace(/\D/g, '').padEnd(2, '0').slice(0, 2)}`
  } else {
    normalized = cleaned.replace(/[^\d-]/g, '')
  }

  const value = Number(normalized)
  return Number.isFinite(value) ? Math.round(value * 100) : null
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value)
}

/** Aceita Date, ISO string ou qualquer objeto com `toDate()` (Timestamp do Firestore). */
export function toDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }
  return null
}

export function formatDate(value: unknown): string {
  const date = toDate(value)
  if (!date) return ''
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date)
}

export function formatDateTime(value: unknown): string {
  const date = toDate(value)
  if (!date) return ''
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

/**
 * "há 5 minutos". Recebe `now` por parâmetro em vez de chamar `Date.now()`
 * internamente para ser determinístico e testável.
 */
export function formatRelative(value: unknown, now: Date = new Date()): string {
  const date = toDate(value)
  if (!date) return ''

  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000)
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]

  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds) {
      return rtf.format(Math.round(diffSeconds / seconds), unit)
    }
  }
  return 'agora mesmo'
}

export function formatHashtags(hashtags: string[]): string {
  return hashtags.map(tag => (tag.startsWith('#') ? tag : `#${tag}`)).join(' ')
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0]}${parts.at(-1)![0]}`.toUpperCase()
}

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`
}

/** Nome do arquivo baixado. Ex.: `ninjaposts-x-bacon-2026-08-01.png`. */
export function downloadFileName(product: string, ext: 'png' | 'jpg', date: Date = new Date()): string {
  const day = date.toISOString().slice(0, 10)
  return `ninjaposts-${slugify(product) || 'post'}-${day}.${ext}`
}
