import type { CreditPack, PackId } from '../types/billing'

/** Créditos concedidos uma única vez, no cadastro. Só para provar o produto. */
export const SIGNUP_BONUS_CREDITS = 1

/**
 * Catálogo de pacotes — fonte única para a landing, a página de créditos e o
 * creditamento no webhook.
 *
 * Os créditos **não expiram** e acumulam entre compras. Isso é o oposto da
 * lógica de assinatura (cota que zera no fim do ciclo) e simplifica tudo:
 * não há reset mensal, não há saldo a expirar e não há data de corte para
 * explicar ao usuário.
 */
export const CREDIT_PACKS: Record<PackId, CreditPack> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'Para experimentar e publicar as primeiras artes.',
    credits: 5,
    priceCents: 2990,
    checkoutUrl: 'https://pay.kiwify.com.br/3q0hbXy',
    highlighted: false,
  },
  essencial: {
    id: 'essencial',
    name: 'Essencial',
    description: 'Para quem publica algumas vezes por semana.',
    credits: 10,
    priceCents: 5599,
    checkoutUrl: 'https://pay.kiwify.com.br/jov9QNZ',
    highlighted: true,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'Para quem publica todo dia e testa variações.',
    credits: 20,
    priceCents: 8990,
    checkoutUrl: 'https://pay.kiwify.com.br/d8r3peP',
    highlighted: false,
  },
}

export const PACK_LIST: CreditPack[] = [
  CREDIT_PACKS.starter,
  CREDIT_PACKS.essencial,
  CREDIT_PACKS.pro,
]

/** Preço por crédito — é o número que revela qual pacote compensa. */
export function pricePerCredit(pack: CreditPack): number {
  return Math.round(pack.priceCents / pack.credits)
}

/**
 * Desconto do pacote em relação ao menor (`starter`), em pontos percentuais.
 * `0` quando não há economia. Usado no selo "economize X%".
 */
export function packSavings(pack: CreditPack): number {
  const base = pricePerCredit(CREDIT_PACKS.starter)
  const saving = Math.round((1 - pricePerCredit(pack) / base) * 100)
  return saving > 0 ? saving : 0
}

/**
 * Resolve o pacote a partir do que o webhook entrega.
 *
 * **Com ids de produto configurados, eles são a única palavra final.** Isso
 * importa porque o webhook da Kiwify pode estar no escopo "todos que sou
 * produtor": qualquer venda da conta bate no nosso endpoint, e casar por valor
 * daria créditos de graça a quem comprasse um produto não relacionado que por
 * acaso custe R$ 29,90.
 *
 * O casamento por valor (e depois por nome) só entra enquanto **nenhum** id
 * estiver configurado — o estado de bootstrap, em que o webhook já está no ar
 * mas as env vars ainda não foram preenchidas. Nesse modo, quem chama deve
 * logar o palpite: é conveniência temporária, não regra permanente.
 */
export function resolvePack(params: {
  externalProductId?: string | null
  amountCents?: number | null
  productName?: string | null
  /** Mapa `packId → id do produto no gateway`, vindo do runtimeConfig. */
  productIds?: Partial<Record<PackId, string>>
}): CreditPack | null {
  const { externalProductId, amountCents, productName, productIds } = params

  const configured = Object.values(productIds ?? {}).filter(Boolean)

  if (configured.length) {
    if (!externalProductId) return null
    return PACK_LIST.find(pack => productIds?.[pack.id] === externalProductId) ?? null
  }

  if (typeof amountCents === 'number' && amountCents > 0) {
    const match = PACK_LIST.find(pack => pack.priceCents === amountCents)
    if (match) return match
  }

  if (productName) {
    const normalized = productName.toLowerCase()
    const match = PACK_LIST.find(pack => normalized.includes(pack.name.toLowerCase()))
    if (match) return match
  }

  return null
}

/** `true` quando o pacote foi adivinhado por valor/nome, sem id configurado. */
export function isGuessedResolution(productIds?: Partial<Record<PackId, string>>): boolean {
  return Object.values(productIds ?? {}).filter(Boolean).length === 0
}
