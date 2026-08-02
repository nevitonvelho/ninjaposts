import type { ClaimPurchasesResponse } from '#shared/types/api'

/**
 * Reivindicação de compras feitas antes do cadastro.
 *
 * Estado compartilhado via `useState` porque duas telas consultam a mesma
 * coisa: o app inteiro (uma vez por sessão, para creditar assim que a pessoa
 * entra) e a página de créditos (que precisa mostrar o que está pendente).
 * Dois estados separados divergiriam — a página diria "2 créditos pendentes"
 * depois de o app já tê-los creditado.
 */
export function usePurchaseClaim() {
  const result = useState<ClaimPurchasesResponse | null>('purchase-claim', () => null)
  const pending = useState('purchase-claim-loading', () => false)

  /** `true` quando existe compra travada só por falta de confirmação de e-mail. */
  const blockedByVerification = computed(
    () => Boolean(result.value && result.value.pending > 0 && !result.value.emailVerified),
  )

  async function claim(): Promise<ClaimPurchasesResponse | null> {
    if (pending.value) return result.value

    pending.value = true
    try {
      result.value = await useApi().post<ClaimPurchasesResponse>('/api/me/claim-purchases')
      return result.value
    } catch (error) {
      /**
       * Falha aqui é silenciosa de propósito: não há compra pendente na
       * esmagadora maioria das sessões, e um toast de erro na entrada do app
       * assustaria sem informar nada acionável. O erro fica no console e a
       * próxima visita à tela de créditos tenta de novo.
       */
      if (import.meta.dev) console.warn('[claim] falha ao reivindicar compras', error)
      return null
    } finally {
      pending.value = false
    }
  }

  return {
    result: readonly(result),
    pending: readonly(pending),
    blockedByVerification,
    claim,
  }
}
