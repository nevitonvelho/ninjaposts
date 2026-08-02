import type { FsTimestamp } from './firestore'

/**
 * Cobrança: **pacotes de crédito pré-pagos**, não assinatura.
 *
 * A troca não é cosmética. Assinatura obriga a carregar ciclo, renovação,
 * inadimplência, cancelamento e reset mensal de cota — cinco máquinas de estado
 * que só existem por causa da recorrência. Crédito comprado é um número que
 * sobe na compra e desce na geração: o saldo é a única fonte de verdade, e não
 * há "fim de ciclo" para reconciliar.
 *
 * Consequência de produto: crédito **não expira**. Sem data de expiração não
 * existe o caso "o usuário pagou e perdeu" — que é de longe o que mais gera
 * pedido de reembolso em produto de crédito.
 */

export type PackId = 'starter' | 'essencial' | 'pro'

/** Gateway ativo. `mock` roda todo o fluxo sem credencial externa. */
export type PaymentProviderId = 'mock' | 'kiwify'

export interface CreditPack {
  id: PackId
  name: string
  description: string
  credits: number
  /** Em centavos de BRL. */
  priceCents: number
  /**
   * Link de checkout do gateway.
   *
   * Fica no catálogo, e não em variável de ambiente como um price id de
   * assinatura: é uma URL pública, aparece no HTML da página de preços e não
   * carrega nada sensível. Esconder atrás de env só adicionaria uma etapa de
   * deploy para publicar um link que qualquer visitante já vê.
   */
  checkoutUrl: string
  highlighted: boolean
}

// ---------------------------------------------------------------------------
// Compras
// ---------------------------------------------------------------------------

export type PurchaseStatus = 'paid' | 'refunded' | 'chargeback'

/**
 * `purchases/{orderId}` — uma compra aprovada no gateway.
 *
 * O id do documento é o id do pedido no provedor, e é isso que torna o
 * creditamento idempotente: webhook duplicado tenta criar o mesmo documento e
 * a transação vê que ele já existe.
 */
export interface PurchaseDoc {
  id: string
  /**
   * `null` quando o e-mail da compra não bate com nenhuma conta — acontece
   * quando a pessoa compra antes de se cadastrar. A compra fica pendente e é
   * reivindicada no primeiro login com aquele e-mail.
   */
  ownerId: string | null
  email: string
  provider: PaymentProviderId
  externalOrderId: string
  externalProductId: string | null
  packId: PackId | null
  credits: number
  amountCents: number
  status: PurchaseStatus
  /** Quando os créditos entraram na conta. `null` = compra ainda não reivindicada. */
  creditedAt: FsTimestamp | null
  createdAt: FsTimestamp
  updatedAt: FsTimestamp
}

/**
 * `webhookEvents/{eventId}` — guarda de idempotência.
 * Webhooks chegam duplicados; se o documento já existe, o evento é ignorado.
 */
export interface WebhookEventDoc {
  id: string
  provider: PaymentProviderId
  type: string
  uid: string | null
  processedAt: FsTimestamp
}

// ---------------------------------------------------------------------------
// Contrato do gateway
// ---------------------------------------------------------------------------

/**
 * Evento do gateway já normalizado — o domínio nunca vê o payload cru.
 *
 * `email` é a chave de ligação com a conta: o checkout da Kiwify acontece fora
 * do nosso app, então não há `uid` para carregar até lá.
 */
export interface NormalizedPurchaseEvent {
  /** Id do pedido no provedor. Chave de idempotência. */
  id: string
  type: 'purchase.paid' | 'purchase.refunded' | 'ignored'
  email: string | null
  externalProductId: string | null
  amountCents: number
  /** Nome do produto — usado como último recurso para inferir o pacote. */
  productName: string | null
}

/**
 * Toda integração de pagamento implementa esta interface.
 *
 * Não há `createCheckout`: o checkout é um link fixo, hospedado pelo provedor.
 * O que precisamos do gateway é só a confirmação de que o dinheiro entrou.
 */
export interface PaymentProvider {
  readonly id: PaymentProviderId
  /** Valida a assinatura com o corpo cru e normaliza o evento. */
  parseWebhook(rawBody: string, signature: string | null): Promise<NormalizedPurchaseEvent>
}
