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

/**
 * Anatomia de um anúncio de conversão, zona por zona.
 *
 * Existe porque pedir "composição, enquadramento, iluminação" produz uma cena,
 * não uma peça: o modelo entrega uma foto bonita e o texto acaba jogado por
 * cima. Anúncio é **diagramação** — logo num canto, título dominante, coluna de
 * itens, caixa de preço, barra de CTA, rodapé — e isso precisa ser pedido.
 *
 * Em inglês para ser aproveitada direto no `layoutPlan`, que vai para o modelo
 * de imagem. Não é camisa de força: o briefing escolhe as zonas que fazem
 * sentido para o formato e a oferta — um story não comporta o mesmo que um
 * feed quadrado.
 */
const AD_ANATOMY = [
  'brand logo — small, in a top corner, generous clear space, never stretched or recoloured',
  'headline — the largest type on the piece, heavy condensed sans, one to three words',
  'subheadline — a single short supporting line under the headline, one word accented in the brand colour',
  'item list — a vertical column down one side, one short line per item, thin rules between them, small line icons',
  'hero product — the photographic centrepiece, the largest object, slightly off centre',
  'price block — an outlined or filled box, the second largest type, small currency symbol and a huge number',
  'call to action — a bar or pill with strong contrast against the background',
  'footer — a discreet strip with two or three very short trust badges',
]

/**
 * Direção de fotografia publicitária.
 *
 * Sem isto o modelo assume render 3D, e é daí que vem o aspecto plástico: o
 * produto sai liso demais, com cor chapada e brilho de material sintético.
 * Nomear câmera, lente e esquema de luz é o que puxa o resultado para o
 * repertório de fotografia real.
 */
const PHOTO_REALISM = [
  'shot on a full-frame camera, 85mm lens at f/2.8, shallow depth of field',
  'studio strobes: warm key light, cool rim light separating the subject from the background',
  'natural specular highlights, real surface texture, visible crumb and grain, condensation only where it belongs',
  'graded like a commercial campaign — rich but never oversaturated',
].join('; ')

/**
 * O que nunca pode aparecer.
 *
 * Vai **sempre**, somado ao negativo que o modelo de texto escreve. Deixar a
 * lista inteiramente a cargo do modelo é apostar que ele lembre de tudo em toda
 * geração, e ele não lembra.
 *
 * O último grupo é o mais importante e não é estético: telefone, endereço, site
 * ou @ inventados numa peça que o dono vai publicar mandam cliente para o
 * contato de outra pessoa. É o pior defeito que este produto pode ter — pior
 * que arte feia, porque arte feia ninguém publica.
 */
const ANTI_AI = [
  'plastic CGI sheen',
  'over-sharpened HDR',
  'waxy or artificial-looking food',
  'warped or melted typography',
  'misspelled, duplicated or gibberish lettering',
  'extra fingers, limbs or floating objects',
  'watermark',
  'invented phone numbers',
  'invented addresses',
  'invented website URLs',
  'invented social media handles',
].join(', ')

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
    'Você é diretor de arte premiado, especializado em campanhas de alta conversão',
    'para pequenos negócios brasileiros. Seu trabalho é indistinguível do de uma',
    'agência: diagramação em grid, hierarquia impecável, muito espaço negativo.',
    '',
    'A partir dos dados abaixo, produza o briefing criativo de UM post para redes sociais.',
    '',
    briefFacts(input),
    '',
    'Regras:',
    `- "imagePrompt": EM INGLÊS, a cena e a direção de arte — materiais, atmosfera, textura de fundo, profundidade. Incorpore: ${style.promptFragment}.`,
    '',
    '- "layoutPlan": EM INGLÊS, a DIAGRAMAÇÃO da peça, zona por zona: onde cada bloco'
    + ' vive e que tamanho ocupa em relação aos outros. Este é o campo que transforma'
    + ' uma foto num anúncio — descreva posição, não sentimento. Escolha as zonas que'
    + ' fazem sentido para o formato e a oferta, deste repertório:',
    `  - ${AD_ANATOMY.join('\n  - ')}`,
    `  A peça é ${format.label} (${format.ratio}); componha para essa proporção.`,
    '',
    '- "photography": EM INGLÊS, a direção de fotografia do produto. Se o produto for'
    + ' comida ou bebida, especifique fotografia publicitária de alimento — vapor,'
    + ' brilho de gordura, frescor, corte que mostra as camadas. Se não for, a direção'
    + ' equivalente para o tipo de produto.',
    '',
    input.colors.length
      ? `- "colorGuidance": EM INGLÊS, como usar a paleta ${input.colors.join(', ')} na peça, sem citar códigos hex.`
      : '- "colorGuidance": EM INGLÊS, escolha uma paleta que combine com o estilo e o nicho e explique o uso.',
    '- "negativePrompt": EM INGLÊS, o que evitar **nesta peça especificamente** (o resto já é tratado).',
    `- "caption": legenda EM PORTUGUÊS DO BRASIL, no máximo ${captionLimit} caracteres, tom próximo do público, com emojis usados com moderação.`,
    hashtagLimit > 0
      ? `- "hashtags": entre 8 e ${Math.min(15, hashtagLimit)} hashtags em português, misturando alcance amplo e nicho, sem o símbolo "#".`
      : '- "hashtags": array vazio — a rede escolhida não usa hashtags.',
    '- "altText": descrição objetiva da imagem EM PORTUGUÊS, para acessibilidade.',
    '',
    '- "textOverlay": os textos exatos que aparecem NA ARTE, EM PORTUGUÊS. Cada campo é'
    + ' uma zona do layout, e texto curto é o que sai legível — seja implacável:',
    '  - "headline": obrigatório, no máximo 3 palavras. É o maior tipo da peça.',
    '  - "subheadline": uma linha curta de apoio, ou null.',
    '  - "items": as partes do combo/pacote, uma por linha, no máximo 4, cada uma com'
    + ' até 4 palavras. Array vazio se a oferta não for composta.',
    input.priceCents !== null
      ? `  - "price": exatamente "${formatPrice(input.priceCents)}".`
      : '  - "price": null — este post não mostra preço.',
    '  - "promotion": o selo da promoção, no máximo 4 palavras, ou null.',
    '  - "cta": no máximo 4 palavras, ou null.',
    '  - "contact": telefone, WhatsApp ou endereço APENAS se aparecer literalmente nos'
    + ' dados acima. Caso contrário, null. NUNCA invente um número, endereço, site ou @:'
    + ' o dono vai publicar esta peça, e um contato falso manda o cliente dele para'
    + ' outro lugar.',
    '',
    '- Nada de promessa enganosa, superlativo vazio ou informação que não veio dos dados.',
  ].join('\n')
}

/** JSON Schema do `CreativeBrief`, para Structured Outputs. */
export const BRIEF_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  // `strict: true` exige que TODO campo declarado esteja em `required` — campo
  // opcional de verdade se expressa com `type: [..., 'null']`, não omitindo daqui.
  required: [
    'imagePrompt',
    'layoutPlan',
    'photography',
    'negativePrompt',
    'caption',
    'hashtags',
    'altText',
    'colorGuidance',
    'textOverlay',
  ],
  properties: {
    imagePrompt: { type: 'string' },
    layoutPlan: { type: 'string' },
    photography: { type: 'string' },
    negativePrompt: { type: 'string' },
    caption: { type: 'string' },
    hashtags: { type: 'array', items: { type: 'string' } },
    altText: { type: 'string' },
    colorGuidance: { type: 'string' },
    textOverlay: {
      type: 'object',
      additionalProperties: false,
      required: ['headline', 'subheadline', 'price', 'promotion', 'cta', 'items', 'contact'],
      properties: {
        headline: { type: 'string' },
        subheadline: { type: ['string', 'null'] },
        price: { type: ['string', 'null'] },
        promotion: { type: ['string', 'null'] },
        cta: { type: ['string', 'null'] },
        items: { type: 'array', items: { type: 'string' } },
        contact: { type: ['string', 'null'] },
      },
    },
  },
} as const

/**
 * Prompt da 2ª passada — integrar a logo na arte já pronta.
 *
 * Curto de propósito. A arte já existe e a única tarefa é encaixar a marca; um
 * prompt longo aqui convidaria o modelo a reinterpretar a cena inteira, que é
 * exatamente o que `input_fidelity: 'high'` está tentando impedir.
 *
 * As duas frases finais carregam o peso: preservar a forma exata da marca, e
 * não mexer em mais nada.
 */
export function buildLogoIntegrationPrompt(): string {
  return [
    'The first image is a finished advertising creative with a deliberately clean,',
    'uncluttered area in its top-left corner. The second image is the brand logo.',
    '',
    'Place the logo into that reserved corner so it belongs to the scene — picking up the',
    'ambient light, the surface texture and any perspective already present there, as a',
    'real printed or applied mark would.',
    '',
    'Preserve the logo exactly: same shapes, same proportions, same colours, same lettering.',
    'Do not redraw, restyle, translate or reletter it. Change nothing else in the artwork —',
    'keep the existing composition, product, typography and colours untouched.',
  ].join('\n')
}

/**
 * Prompt final da imagem.
 *
 * Montado em **seções rotuladas**, e não num parágrafo corrido: o modelo trata
 * cada rótulo como um compartimento, e direção de arte deixa de competir com
 * tipografia pela mesma atenção.
 *
 * No modo `ai` (v1) o texto é renderizado pelo próprio modelo. Cada string sai
 * **amarrada à sua zona** — string curta com endereço erra muito menos que uma
 * lista solta —, entre aspas e com instrução de grafia exata. E o prompt fecha
 * proibindo qualquer texto além dos listados: sem isso o modelo preenche o
 * espaço vazio com letra inventada, que é a origem do rabisco ilegível.
 */
export function buildImagePrompt(brief: CreativeBrief, input: GenerationInput): string {
  const format = FORMATS[input.format]
  const sections: string[] = [
    // Só a proporção: `format.label` é rótulo de UI em português, e português
    // solto no meio de um prompt em inglês só adiciona ruído.
    `FORMAT: ${format.ratio} advertising creative for social media.`,
    `ART DIRECTION: ${brief.imagePrompt}`,
    `LAYOUT: ${brief.layoutPlan}`,
    // Em duas linhas: o modelo escreve a direção do produto, e a técnica fixa
    // entra separada. Emendar as duas produzia frase quebrada no meio.
    `PHOTOGRAPHY: ${brief.photography}\nTechnical direction: ${PHOTO_REALISM}.`,
    `COLOR: ${brief.colorGuidance}`,
  ]

  if (input.renderMode === 'ai') {
    const { headline, subheadline, price, promotion, cta, items, contact } = brief.textOverlay

    const zones: string[] = [`headline zone — "${headline}"`]
    if (subheadline) zones.push(`subheadline, directly under the headline — "${subheadline}"`)
    if (items.length) {
      zones.push(`item list column, one line each — ${items.map(i => `"${i}"`).join(', ')}`)
    }
    if (price) zones.push(`price block — "${price}"`)
    if (promotion) zones.push(`promotion badge — "${promotion}"`)
    if (cta) zones.push(`call-to-action bar — "${cta}"`)
    if (contact) zones.push(`contact bar, next to the call to action — "${contact}"`)

    sections.push(
      'TYPOGRAPHY: render the following Brazilian Portuguese text, spelled character for'
      + ' character exactly as written, with clean professional kerning and clear'
      + ` hierarchy:\n- ${zones.join('\n- ')}\n`
      + 'Render NO other text, letters, numbers or symbols anywhere in the image.',
    )
  } else {
    // Modo `hybrid`: a IA entrega a cena limpa e o texto é composto depois.
    sections.push(
      'TYPOGRAPHY: render no text, letters or numbers at all. Leave clean, uncluttered'
      + ' negative space in the zones described above, where typography will be composited later.',
    )
  }

  if (input.logoPath) {
    /**
     * A logo não vai para o modelo — é composta com `sharp` depois. O que o
     * prompt faz é **reservar o lugar** dela.
     *
     * A proibição explícita não é redundante: sem ela o modelo desenha uma
     * marca inventada no canto, e a composição acaba empilhando duas logos.
     */
    sections.push(
      'BRAND: leave the top-left corner clean and uncluttered — flat, low-detail,'
      + ' even-toned background with no important subject matter — as reserved space'
      + ' where the real brand logo will be placed afterwards.'
      + ' Do NOT draw, invent or letter any logo, emblem, wordmark or brand name anywhere.',
    )
  }

  sections.push(`AVOID: ${brief.negativePrompt}, ${ANTI_AI}.`)

  return sections.filter(Boolean).join('\n\n')
}
