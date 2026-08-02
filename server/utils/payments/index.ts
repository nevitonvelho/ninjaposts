import type { PackId } from '#shared/types/billing'
import type { PaymentProvider } from '#shared/types/billing'
import { createKiwifyProvider } from './kiwify'
import { createMockProvider } from './mock'

/**
 * Resolve o gateway ativo a partir do `runtimeConfig`.
 *
 * O domínio inteiro (crédito, ledger, idempotência, compra órfã) conversa só
 * com a interface `PaymentProvider` — trocar de gateway, ou rodar sem nenhum,
 * não toca em regra de negócio.
 */
export function usePaymentProvider(): PaymentProvider {
  const config = useRuntimeConfig()

  return config.paymentProvider === 'kiwify'
    ? createKiwifyProvider(config.kiwifyWebhookToken)
    : createMockProvider()
}

/**
 * Ids de produto por pacote, vindos do ambiente.
 *
 * Só entram no mapa os que estão preenchidos: um id vazio casaria com um
 * `externalProductId` ausente e creditaria o pacote errado.
 */
export function kiwifyProductIds(): Partial<Record<PackId, string>> {
  const config = useRuntimeConfig()

  const entries: [PackId, string][] = [
    ['starter', config.kiwifyProductStarter],
    ['essencial', config.kiwifyProductEssencial],
    ['pro', config.kiwifyProductPro],
  ]

  return Object.fromEntries(entries.filter(([, id]) => Boolean(id?.trim())))
}
