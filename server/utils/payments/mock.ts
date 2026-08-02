import type { NormalizedPurchaseEvent, PaymentProvider } from '#shared/types/billing'
import { rejectWebhook } from './rejection'

/**
 * Provider de desenvolvimento.
 *
 * Aceita o payload já normalizado e não valida assinatura — existe para
 * exercitar todo o caminho de creditamento (idempotência, compra órfã,
 * estorno) com um `curl`, sem depender da Kiwify nem de túnel:
 *
 * ```bash
 * curl -X POST localhost:3000/api/billing/webhook \
 *   -H 'content-type: application/json' \
 *   -d '{"id":"teste-1","type":"purchase.paid","email":"voce@exemplo.com","amountCents":5599}'
 * ```
 *
 * Fica travado em desenvolvimento: em produção, um provider que não valida
 * assinatura é uma porta aberta para qualquer um se creditar.
 */
export function createMockProvider(): PaymentProvider {
  return {
    id: 'mock',

    async parseWebhook(rawBody) {
      if (!import.meta.dev) {
        rejectWebhook('config', 'provider `mock` não pode rodar em produção')
      }

      let payload: Partial<NormalizedPurchaseEvent>
      try {
        payload = JSON.parse(rawBody) as Partial<NormalizedPurchaseEvent>
      } catch {
        rejectWebhook('payload', 'corpo não é JSON válido')
      }

      if (!payload.id) {
        rejectWebhook('payload', 'informe `id` (identificador do pedido)')
      }

      return {
        id: payload.id,
        type: payload.type ?? 'purchase.paid',
        email: payload.email ?? null,
        externalProductId: payload.externalProductId ?? null,
        productName: payload.productName ?? null,
        amountCents: payload.amountCents ?? 0,
      }
    },
  }
}
