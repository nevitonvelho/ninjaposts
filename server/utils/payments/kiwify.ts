import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NormalizedPurchaseEvent, PaymentProvider } from '#shared/types/billing'
import { rejectWebhook } from './rejection'

/**
 * Provider da Kiwify.
 *
 * **A Kiwify não documenta publicamente nem o formato do payload nem o
 * algoritmo da assinatura** (a doc pública cobre só o CRUD de webhooks). Então
 * as duas coisas aqui são deliberadamente tolerantes:
 *
 * - a assinatura é aceita se bater com qualquer combinação plausível
 *   (sha1/sha256 · hex/base64 · query param ou header);
 * - o payload é lido por caminhos alternativos, com fallback.
 *
 * Isso não afrouxa a segurança: **uma** combinação precisa bater, e ela é
 * calculada com o token secreto. O que a tolerância evita é o modo de falha
 * chato — pagamento aprovado, webhook rejeitado por detalhe de formato, e
 * cliente sem crédito no domingo à noite.
 *
 * Assim que o primeiro evento real confirmar o formato, dá para apertar isto
 * para uma única variante — o log em dev diz qual bateu.
 */

const ALGORITHMS = ['sha1', 'sha256'] as const

/** Comparação em tempo constante, tolerante a tamanhos diferentes. */
function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

function signatureMatches(rawBody: string, token: string, provided: string): string | null {
  const candidate = provided.trim().replace(/^sha(1|256)=/i, '')

  for (const algorithm of ALGORITHMS) {
    for (const encoding of ['hex', 'base64'] as const) {
      const digest = createHmac(algorithm, token).update(rawBody, 'utf8').digest(encoding)
      if (safeEquals(digest, candidate)) return `${algorithm}/${encoding}`
    }
  }

  // Alguns webhooks mandam o próprio token, sem HMAC nenhum.
  if (safeEquals(token, candidate)) return 'token-puro'

  return null
}

/** Lê um caminho aninhado sem explodir em campo ausente. */
function pick(source: unknown, ...paths: string[]): unknown {
  for (const path of paths) {
    let value: unknown = source
    for (const key of path.split('.')) {
      if (value === null || typeof value !== 'object') {
        value = undefined
        break
      }
      value = (value as Record<string, unknown>)[key]
    }
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/**
 * Valor pago, em centavos.
 *
 * A Kiwify manda o valor como string em centavos em `Commissions.charge_amount`.
 * Tratamos número e string com decimal como fallback — se vier "55.99" em vez
 * de "5599", multiplicamos. O limiar é grosseiro de propósito: pacote nenhum
 * custa centavos, então um valor com ponto decimal é reais, não centavos.
 */
function parseAmountCents(value: unknown): number {
  if (typeof value === 'number') return Math.round(value)

  const text = asString(value)
  if (!text) return 0

  if (text.includes('.') || text.includes(',')) {
    const normalized = Number(text.replace(',', '.'))
    return Number.isFinite(normalized) ? Math.round(normalized * 100) : 0
  }

  const parsed = Number(text)
  return Number.isFinite(parsed) ? Math.round(parsed) : 0
}

/**
 * Mapeia o evento da Kiwify para o nosso vocabulário.
 *
 * Olhamos `webhook_event_type` e `order_status` porque não sabemos qual dos
 * dois vem preenchido em cada tipo de evento — e o status do pedido é o que
 * realmente diz se o dinheiro entrou.
 */
function normalizeType(payload: unknown): NormalizedPurchaseEvent['type'] {
  const event = asString(pick(payload, 'webhook_event_type', 'event'))?.toLowerCase()
  const status = asString(pick(payload, 'order_status', 'status'))?.toLowerCase()

  if (event === 'order_approved' || status === 'paid' || status === 'approved') {
    return 'purchase.paid'
  }
  if (
    event === 'order_refunded'
    || event === 'chargeback'
    || status === 'refunded'
    || status === 'chargedback'
    || status === 'chargeback'
  ) {
    return 'purchase.refunded'
  }
  return 'ignored'
}

export function createKiwifyProvider(token: string): PaymentProvider {
  return {
    id: 'kiwify',

    async parseWebhook(rawBody, signature) {
      if (!token) {
        rejectWebhook('config', 'NUXT_KIWIFY_WEBHOOK_TOKEN não configurado')
      }
      if (!signature) {
        rejectWebhook('signature', 'requisição sem assinatura (nem query `signature`, nem header)')
      }

      const matched = signatureMatches(rawBody, token, signature)
      if (!matched) {
        rejectWebhook('signature', 'nenhuma variante de HMAC bateu com o token configurado')
      }
      if (import.meta.dev) {
        console.info(`[kiwify] assinatura validada por ${matched}`)
      }

      let payload: unknown
      try {
        payload = JSON.parse(rawBody)
      } catch {
        rejectWebhook('payload', 'corpo não é JSON válido')
      }

      const orderId = asString(pick(payload, 'order_id', 'id', 'order.order_id', 'order_ref'))
      if (!orderId) {
        rejectWebhook(
          'payload',
          `evento sem identificador de pedido — campos recebidos: ${Object.keys(payload as object).join(', ')}`,
        )
      }

      return {
        id: orderId,
        type: normalizeType(payload),
        email: asString(pick(payload, 'Customer.email', 'customer.email', 'email'))?.toLowerCase() ?? null,
        externalProductId: asString(
          pick(payload, 'Product.product_id', 'product.product_id', 'product_id'),
        ),
        productName: asString(
          pick(payload, 'Product.product_name', 'product.product_name', 'product_name'),
        ),
        amountCents: parseAmountCents(
          pick(
            payload,
            'Commissions.charge_amount',
            'commissions.charge_amount',
            'charge_amount',
            'Commissions.product_base_price',
          ),
        ),
      } satisfies NormalizedPurchaseEvent
    },
  }
}
