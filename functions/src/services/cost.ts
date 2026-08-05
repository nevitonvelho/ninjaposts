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

/**
 * USD por imagem, por qualidade — a de 1024×1024; formatos maiores custam mais.
 *
 * **Calibrada para `gpt-image-1`.** Com outro modelo configurado, estes números
 * deixam de valer.
 */
const IMAGE_PRICE = {
  low: 0.011,
  medium: 0.042,
  high: 0.167,
} as const

/** O modelo para o qual `IMAGE_PRICE` foi levantada. */
const PRICED_IMAGE_MODEL = 'gpt-image-1'

/**
 * Avisa uma vez por instância que a estimativa está descalibrada.
 *
 * Uma vez, e não a cada geração: o log de uma função que processa milhares de
 * jobs não pode virar a mesma linha repetida. E avisar é obrigatório — uma
 * estimativa silenciosamente errada alimenta o teto diário de gasto, que é o
 * que deveria impedir o cartão de sangrar.
 */
let avisouModelo = false

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

/**
 * Acréscimo por imagem **de entrada** na chamada de edição.
 *
 * A logo sempre custou isso e passava despercebida; com a biblioteca de assets
 * uma geração pode levar logo + 3 produtos + 1 referência, e aí a diferença
 * deixa de ser ruído. Sem contabilizar, o teto diário de gasto
 * (`GENERATION_LIMITS.dailyCostCapUsd`) libera mais jobs do que o cartão
 * aguenta — que é exatamente o que ele existe para impedir.
 *
 * Como o resto deste arquivo: estimativa, não fatura.
 */
const INPUT_IMAGE_PRICE = 0.015

export function estimateImageCost(
  size: string,
  quality: keyof typeof IMAGE_PRICE,
  model?: string,
  /** Quantidade de imagens anexadas à chamada. */
  inputImages = 0,
): number {
  if (model && model !== PRICED_IMAGE_MODEL && !avisouModelo) {
    avisouModelo = true
    console.warn(
      `[cost] estimativa calibrada para ${PRICED_IMAGE_MODEL}, mas o modelo em uso é `
      + `${model}. O custo por arte e o teto diário de gasto estão errados até `
      + 'IMAGE_PRICE ser atualizada com a tabela de preços deste modelo.',
    )
  }

  return IMAGE_PRICE[quality] * (SIZE_MULTIPLIER[size] ?? 1) + inputImages * INPUT_IMAGE_PRICE
}
