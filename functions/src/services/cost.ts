/**
 * Estimativa de custo por geração, em USD.
 *
 * **Estes números são estimativa, não fatura.** Servem para o painel admin
 * responder "o pacote está com preço certo?" e para o teto diário de gasto
 * cortar antes de o cartão sangrar. A conta real vem do faturamento da OpenAI —
 * e a tabela abaixo precisa ser revisada quando o preço mudar.
 *
 * Vale a pena mesmo assim: sem número nenhum, o custo por arte só apareceria no
 * fim do mês, quando não dá mais para reagir.
 */

/** USD por 1M de tokens. */
const TEXT_PRICE_PER_MILLION = {
  input: 1.25,
  output: 10,
} as const

/** USD por imagem, por qualidade — a de 1024×1024; formatos maiores custam mais. */
const IMAGE_PRICE = {
  low: 0.011,
  medium: 0.042,
  high: 0.167,
} as const

/** Multiplicador por tamanho de render, relativo ao quadrado. */
const SIZE_MULTIPLIER: Record<string, number> = {
  '1024x1024': 1,
  '1024x1536': 1.5,
  '1536x1024': 1.5,
}

export function estimateTextCost(tokensIn: number, tokensOut: number): number {
  return (
    (tokensIn / 1_000_000) * TEXT_PRICE_PER_MILLION.input
    + (tokensOut / 1_000_000) * TEXT_PRICE_PER_MILLION.output
  )
}

export function estimateImageCost(size: string, quality: keyof typeof IMAGE_PRICE): number {
  return IMAGE_PRICE[quality] * (SIZE_MULTIPLIER[size] ?? 1)
}
