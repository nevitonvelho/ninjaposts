import { FORMATS, NETWORKS, STYLES } from '../../../shared/constants'
import type { CreativeBrief, GenerationInput } from '../../../shared/types/generation'

/**
 * Montagem dos prompts.
 *
 * Fica isolado do cliente da OpenAI de propósito: é aqui que mora a qualidade
 * do produto, e é o que mais vai mudar com o tempo. Poder ler o prompt inteiro
 * num arquivo só — sem caçar concatenação espalhada por três módulos — é o que
 * torna *prompt tuning* possível depois, com os dados reais de `meta.promptUsed`.
 */

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

/** Linhas "campo: valor", omitindo o que o usuário não preencheu. */
function briefFacts(input: GenerationInput): string {
  const lines: string[] = [
    `Nicho do negócio: ${input.niche}`,
    `Produto ou serviço em destaque: ${input.product}`,
  ]

  if (input.description) lines.push(`Detalhes: ${input.description}`)
  if (input.priceCents !== null) lines.push(`Preço: ${formatPrice(input.priceCents)}`)
  if (input.promotion) lines.push(`Promoção: ${input.promotion}`)
  if (input.cta) lines.push(`Chamada para ação: ${input.cta}`)
  if (input.colors.length) lines.push(`Cores da marca (a primeira é dominante): ${input.colors.join(', ')}`)
  if (input.logoPath) lines.push('A marca tem logo, que será aplicada na arte.')
  if (input.extraInstructions) lines.push(`Pedidos do cliente: ${input.extraInstructions}`)

  const networks = input.networks.map(n => NETWORKS[n].label).join(', ')
  const format = FORMATS[input.format]
  const style = STYLES[input.style]

  lines.push(`Redes de publicação: ${networks}`)
  lines.push(`Formato da peça: ${format.label} (${format.ratio})`)
  lines.push(`Estilo pedido: ${style.label} — ${style.description}`)

  return lines.join('\n')
}

/**
 * Instrução do briefing criativo.
 *
 * A regra que mais importa está no fim: **o modelo de texto não escreve o
 * prompt de imagem em português**. Modelos de imagem respondem
 * significativamente melhor a instrução em inglês, mas legenda e hashtags
 * precisam sair em português do Brasil — são o que o usuário publica.
 */
export function buildBriefInstructions(input: GenerationInput): string {
  const style = STYLES[input.style]
  const format = FORMATS[input.format]
  const captionLimit = Math.min(...input.networks.map(n => NETWORKS[n].captionLimit))
  const hashtagLimit = Math.max(...input.networks.map(n => NETWORKS[n].hashtagLimit))

  return [
    'Você é diretor de arte e redator publicitário especializado em pequenos negócios brasileiros.',
    'A partir dos dados abaixo, produza o briefing criativo de UM post para redes sociais.',
    '',
    briefFacts(input),
    '',
    'Regras:',
    `- "imagePrompt": escreva EM INGLÊS, descritivo e cinematográfico, pronto para um modelo de imagem. Descreva composição, enquadramento, iluminação, materiais, profundidade de campo e hierarquia visual. Incorpore esta direção de arte: ${style.promptFragment}.`,
    `- A peça é ${format.label} (${format.ratio}) — componha para essa proporção e deixe respiro onde o texto vai entrar.`,
    input.colors.length
      ? `- Use a paleta ${input.colors.join(', ')} como base cromática, sem citar códigos hex no prompt.`
      : '- Escolha uma paleta que combine com o estilo e o nicho.',
    '- "negativePrompt": EM INGLÊS, o que deve ser evitado (texto ilegível, marca d\'água, deformações, ruído).',
    `- "caption": legenda EM PORTUGUÊS DO BRASIL, no máximo ${captionLimit} caracteres, tom próximo do público, com emojis usados com moderação.`,
    hashtagLimit > 0
      ? `- "hashtags": entre 8 e ${Math.min(15, hashtagLimit)} hashtags em português, misturando alcance amplo e nicho, sem o símbolo "#".`
      : '- "hashtags": array vazio — a rede escolhida não usa hashtags.',
    '- "altText": descrição objetiva da imagem EM PORTUGUÊS, para acessibilidade.',
    '- "colorGuidance": uma frase EM INGLÊS sobre o uso das cores na peça.',
    '- "textOverlay": os textos exatos que devem aparecer na arte, EM PORTUGUÊS. "headline" é obrigatório e curto (até 6 palavras).',
    input.priceCents !== null
      ? `- "textOverlay.price" deve ser exatamente "${formatPrice(input.priceCents)}".`
      : '- "textOverlay.price" deve ser null: este post não mostra preço.',
    '- Nada de promessa enganosa, superlativo vazio ou informação que não veio dos dados.',
  ].join('\n')
}

/** JSON Schema do `CreativeBrief`, para Structured Outputs. */
export const BRIEF_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'imagePrompt',
    'negativePrompt',
    'caption',
    'hashtags',
    'altText',
    'colorGuidance',
    'textOverlay',
  ],
  properties: {
    imagePrompt: { type: 'string' },
    negativePrompt: { type: 'string' },
    caption: { type: 'string' },
    hashtags: { type: 'array', items: { type: 'string' } },
    altText: { type: 'string' },
    colorGuidance: { type: 'string' },
    textOverlay: {
      type: 'object',
      additionalProperties: false,
      required: ['headline', 'price', 'promotion', 'cta'],
      properties: {
        headline: { type: 'string' },
        price: { type: ['string', 'null'] },
        promotion: { type: ['string', 'null'] },
        cta: { type: ['string', 'null'] },
      },
    },
  },
} as const

/**
 * Prompt final da imagem.
 *
 * No modo `ai` (v1) o texto é renderizado pelo próprio modelo — então os
 * textos do `textOverlay` entram no prompt, com instrução explícita de grafia
 * correta. É o ponto fraco conhecido dos modelos de imagem, e repetir o texto
 * exato entre aspas é o que mais reduz o erro tipográfico.
 */
export function buildImagePrompt(brief: CreativeBrief, input: GenerationInput): string {
  const parts: string[] = [brief.imagePrompt, brief.colorGuidance]

  if (input.renderMode === 'ai') {
    const texts: string[] = [`headline: "${brief.textOverlay.headline}"`]
    if (brief.textOverlay.price) texts.push(`price: "${brief.textOverlay.price}"`)
    if (brief.textOverlay.promotion) texts.push(`promotion: "${brief.textOverlay.promotion}"`)
    if (brief.textOverlay.cta) texts.push(`call to action: "${brief.textOverlay.cta}"`)

    parts.push(
      `Render the following Brazilian Portuguese text on the artwork, spelled EXACTLY as written, `
      + `with clean professional typography and clear visual hierarchy — ${texts.join('; ')}.`,
    )
  } else {
    // Modo `hybrid`: a IA entrega a cena limpa e o texto é composto depois.
    parts.push('Do not render any text, letters or numbers in the image. Leave clean negative space for typography.')
  }

  if (input.logoPath) {
    parts.push('Integrate the provided brand logo naturally into the composition, undistorted, with adequate clear space.')
  }

  parts.push(`Avoid: ${brief.negativePrompt}`)

  return parts.filter(Boolean).join('\n\n')
}
