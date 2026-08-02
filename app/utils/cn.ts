import { twMerge } from 'tailwind-merge'

export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[]
  | Record<string, boolean | null | undefined>

function flatten(value: ClassValue, out: string[]): void {
  if (!value) return
  if (typeof value === 'string' || typeof value === 'number') {
    out.push(String(value))
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) flatten(item, out)
    return
  }
  for (const [key, enabled] of Object.entries(value)) {
    if (enabled) out.push(key)
  }
}

/**
 * Junta classes condicionais e resolve conflitos do Tailwind.
 *
 * Sem `twMerge`, passar `class="bg-white"` para um `<UiButton>` que já tem
 * `bg-brand-600` não funciona como se espera: as duas classes ficam no atributo
 * e quem vence é a que aparece depois **no CSS gerado**, não no HTML. O
 * resultado é um override que às vezes pega e às vezes não.
 *
 * `cn()` remove a classe perdedora antes de chegar no DOM, então a última
 * declarada sempre vence — que é o comportamento que todo mundo assume.
 */
export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = []
  for (const input of inputs) flatten(input, classes)
  return twMerge(classes.join(' '))
}
