import { BUSINESS_FIELD, FORMATS, NETWORKS, STYLES, contactLine } from '../../../shared/constants'
import type { CreativeBrief, GenerationInput } from '../../../shared/types/generation'

/**
 * Montagem dos prompts.
 *
 * Fica isolado do cliente da OpenAI de propósito: é aqui que mora a qualidade
 * do produto, e é o que mais vai mudar com o tempo. Poder ler o prompt inteiro
 * num arquivo só — sem caçar concatenação espalhada por três módulos — é o que
 * torna *prompt tuning* possível depois, com os dados reais de `meta.promptUsed`.
 *
 * ---
 *
 * **O prompt de imagem é escrito em português.**
 *
 * Isto contraria a intuição comum de que modelo de imagem responde melhor em
 * inglês, e a escolha vem de evidência, não de teoria: a peça que serve de
 * referência para este produto foi gerada com um prompt inteiramente em pt-BR e
 * saiu com tipografia impecável. Faz sentido — o texto que a arte precisa
 * **grafar** é português, e pedir em inglês adiciona uma tradução no meio do
 * caminho justamente onde o erro dói mais.
 */

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

/**
 * Qualidade e realismo — o bloco que combate o aspecto de imagem gerada.
 *
 * Sem direção explícita o modelo assume render 3D, e é daí que vem o produto
 * "irrealista": liso demais, cor chapada, brilho de plástico.
 */
const QUALIDADE = [
  'Fotografia hiper-realista, de campanha publicitária.',
  'Iluminação cinematográfica, reflexos naturais, sombras suaves.',
  'Texturas extremamente detalhadas.',
  'Sem aparência de imagem gerada por IA. Sem ilustração, sem desenho, sem render 3D.',
  'Sem poluição visual, sem excesso de elementos.',
].join('\n')

/**
 * Disciplina de diagramação — o que separa "foto bonita com texto por cima" de
 * peça feita por designer.
 *
 * O que denuncia arte automática não é a fotografia: essa o modelo já entrega.
 * É o layout. Item do combo jogado solto ao lado do selo de preço, três
 * alinhamentos diferentes no mesmo terço da peça, margem que muda de lado para
 * lado, botão cinza genérico numa marca que tem cor. Cada linha aqui ataca um
 * desses defeitos — todos observados em peças reais deste produto.
 */
const DIAGRAMACAO = [
  'Margem de segurança uniforme nos quatro lados. Nenhum texto, selo ou botão encosta na borda.',
  'Tudo alinhado a uma grade: no máximo dois eixos de alinhamento na peça inteira.',
  'Um único raio de canto para todos os selos, botões e caixas.',
  'No máximo duas famílias tipográficas, com salto de tamanho evidente entre título, apoio e rodapé.',
  'Nenhum texto solto: todo texto secundário mora dentro de um bloco tratado —'
  + ' caixa, faixa, selo ou coluna — com espaçamento interno constante.',
  'A cor de destaque da marca aparece em pelo menos dois elementos (botão, selo de'
  + ' preço, faixa), nunca em um só e nunca em nenhum.',
  'Espaço vazio é composição, não sobra: se um canto ficar vazio, reequilibre a peça'
  + ' em vez de preencher com enfeite.',
].join('\n')

/**
 * O que nunca pode aparecer. Vai sempre, somado ao negativo do briefing.
 *
 * O primeiro grupo é tipografia, o segundo é diagramação, o terceiro é honestidade.
 * O último não é estético: telefone, endereço ou @ inventados numa peça que o dono
 * vai publicar mandam o cliente dele para o contato de outra pessoa.
 */
const NUNCA = [
  'texto com erro de grafia, letras embaralhadas, palavra duplicada ou sem sentido',
  'tipografia deformada ou derretida',
  'texto secundário solto sobre a foto, sem caixa, faixa ou selo que o sustente',
  'elementos desalinhados entre si ou margens irregulares',
  'mais de duas famílias tipográficas',
  'botão ou selo em cinza genérico quando a marca tem cor',
  'raios de luz, brilhos e reflexos decorativos que não vêm de uma fonte de luz da cena',
  'marca d\'água',
  'dedos, membros ou objetos flutuantes a mais',
  'telefone, endereço, site ou perfil inventados',
].join('; ')

/**
 * Contatos escolhidos pelo dono, cada um com o rótulo do que é.
 *
 * O rótulo importa: "(11) 98765-4321" sozinho pode virar telefone fixo na
 * diagramação; "WhatsApp: (11) 98765-4321" chega com o ícone certo.
 */
function contactFacts(input: GenerationInput): string[] {
  return input.contactItems.map(item => `${BUSINESS_FIELD[item.field].label}: ${item.value}`)
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

  const contatos = contactFacts(input)
  if (contatos.length) {
    lines.push(
      'Contatos reais do estabelecimento, informados pelo dono e confirmados por ele'
      + ' para esta peça (use exatamente assim, sem alterar um dígito):',
      ...contatos.map(line => `  - ${line}`),
    )
  }

  if (input.extraInstructions) lines.push(`Pedidos do cliente: ${input.extraInstructions}`)

  const networks = input.networks.map(n => NETWORKS[n].label).join(', ')
  const format = FORMATS[input.format]
  const style = STYLES[input.style]

  lines.push(`Redes de publicação: ${networks}`)
  lines.push(`Formato da peça: ${format.label} (${format.ratio})`)
  lines.push(`Estilo pedido: ${style.label} — ${style.description}`)

  return lines.join('\n')
}

/** Instrução do briefing criativo. */
export function buildBriefInstructions(input: GenerationInput): string {
  const style = STYLES[input.style]
  const format = FORMATS[input.format]
  const captionLimit = Math.min(...input.networks.map(n => NETWORKS[n].captionLimit))
  const hashtagLimit = Math.max(...input.networks.map(n => NETWORKS[n].hashtagLimit))
  const linhaContato = contactLine(input.contactItems)

  return [
    'Você é diretor de arte premiado, especializado em campanhas publicitárias',
    'para pequenos negócios brasileiros.',
    '',
    'A partir dos dados abaixo, produza o briefing de UM post para redes sociais.',
    '',
    briefFacts(input),
    '',
    'Regras — responda TUDO em português do Brasil:',
    `- "imagePrompt": a cena e a direção de arte — fundo, atmosfera, materiais, luz, ângulo do produto. Incorpore: ${style.promptFragment}.`,
    '',
    '- "layoutPlan": a diagramação, zona por zona, em 3 ou 4 frases. Onde ficam a logo,'
    + ' o título, o produto, o selo de preço e o rodapé, e que fração da peça cada um'
    + ` ocupa. A peça é ${format.label} (${format.ratio}) e o produto domina a composição.`
    + ' Escolha UMA cor de destaque da paleta e diga em quais dois elementos ela aparece.'
    + ' Trate o terço inferior como um bloco projetado, com um único eixo de alinhamento'
    + ' — é o que separa peça de designer de foto com texto por cima.'
    + (linhaContato
      ? ' A chamada e o contato formam uma só unidade no rodapé: botão sólido na cor de'
        + ' destaque, com o contato dentro dele ou em faixa colada a ele.'
      : ' Não há contato nesta peça: o rodapé fica limpo e equilibrado.'),
    '',
    '- "photography": a direção de fotografia do produto. Se for comida ou bebida,'
    + ' descreva o que faz dar fome — vapor, brilho de gordura, queijo derretendo,'
    + ' gotas de condensação, camadas visíveis no corte.',
    '',
    '- "productIncludes": os ingredientes ou componentes que o produto tem, um por'
    + ' item, tirados do nome e dos detalhes informados. Se o cliente não detalhou,'
    + ' use a composição clássica do produto no Brasil — sem inventar sofisticação.',
    '',
    '- "productExcludes": o que NÃO pode aparecer no produto. Liste os acompanhamentos'
    + ' que um modelo de imagem costuma acrescentar sozinho e que **não** foram pedidos'
    + ' — por exemplo bacon, cebola caramelizada, molho barbecue, ervas, ingrediente'
    + ' gourmet. Esta lista é o que impede a arte de mostrar um produto que o cliente'
    + ' não vende.',
    '',
    input.colors.length
      ? `- "colorGuidance": como usar a paleta ${input.colors.join(', ')} na peça.`
      : '- "colorGuidance": escolha uma paleta que combine com o estilo e o nicho e explique o uso.',
    '- "negativePrompt": o que evitar nesta peça especificamente.',
    `- "caption": legenda para publicar, no máximo ${captionLimit} caracteres, tom próximo do público, emojis com moderação.`,
    hashtagLimit > 0
      ? `- "hashtags": entre 8 e ${Math.min(15, hashtagLimit)} hashtags, misturando alcance amplo e nicho, sem o símbolo "#".`
      : '- "hashtags": array vazio — a rede escolhida não usa hashtags.',
    '- "altText": descrição objetiva da imagem, para acessibilidade.',
    '',
    '- "textOverlay": os textos exatos que aparecem NA ARTE. Texto curto é o que sai'
    + ' legível — seja implacável:',
    '  - "headline": obrigatório, no máximo 3 palavras. É o maior tipo da peça.',
    '  - "subheadline": uma linha curta de apoio, ou null.',
    '  - "items": as partes do combo/pacote, no máximo 3, cada uma com até 4 palavras.'
    + ' Array vazio se a oferta não for composta.',
    input.priceCents !== null
      ? `  - "price": exatamente "${formatPrice(input.priceCents)}".`
      : '  - "price": null — este post não mostra preço.',
    '  - "promotion": o selo da promoção, no máximo 4 palavras, ou null.',
    '  - "cta": no máximo 4 palavras, ou null.',
    linhaContato
      ? `  - "contact": exatamente esta string, sem reescrever nada: "${linhaContato}".`
      : '  - "contact": null. O dono não pediu contato nesta peça — e inventar um manda'
        + ' o cliente dele para o telefone de outra pessoa.',
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
    'productIncludes',
    'productExcludes',
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
    productIncludes: { type: 'array', items: { type: 'string' } },
    productExcludes: { type: 'array', items: { type: 'string' } },
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
 * O rodapé da peça: chamada e contato como **uma unidade de interface**.
 *
 * Nasceu de um defeito concreto. Com a chamada na lista de textos e o contato
 * numa lista separada, a arte saía com um botão cinza translúcido escrito
 * "Peça pelo WhatsApp" — sem o número — flutuando centralizado enquanto preço
 * e itens ficavam à direita: três alinhamentos no mesmo terço da peça, e o
 * telefone que o dono escolheu mostrar simplesmente ausente.
 *
 * Descrever botão e número como um objeto só resolve os dois de uma vez, e é
 * assim que um designer diagramaria: quem lê o "peça pelo WhatsApp" precisa
 * ver para onde pedir sem procurar.
 *
 * Os valores vêm de `input`, não do briefing. O modelo de texto já recebeu
 * ordem de copiar a string literal, mas ele é o elo que pode normalizar um DDD
 * ou "corrigir" um @ — e aqui um dígito trocado é o pior defeito possível do
 * produto. `brief.textOverlay.contact` só sobrevive no modo `hybrid`, onde
 * quem compõe é o `sharp`.
 */
function buildFooterBlock(cta: string | null, input: GenerationInput): string {
  const items = input.contactItems
  const principal = items.find(item => item.field === 'whatsapp' || item.field === 'phone') ?? null
  const secundarios = items.filter(item => item !== principal)

  const COPIA_FIEL = 'Copie caractere por caractere, incluindo pontuação, parênteses,'
    + ' hífen e arroba. Não reformate, não complete, não abrevie e não acrescente'
    + ' nenhum outro contato.'

  const linhas: string[] = ['RODAPÉ:']

  if (cta && principal) {
    const icone = principal.field === 'whatsapp' ? 'o ícone do WhatsApp' : 'um ícone de telefone'
    linhas.push(
      `- um único botão sólido, preenchido com a cor de destaque da marca, com ${icone}`
      + ` à esquerda, o texto "${cta}" e, imediatamente ao lado ou logo abaixo dentro do`
      + ` mesmo botão, o número "${principal.value}" — em tipo menor, mas legível.`,
      '- o botão é o elemento mais evidente do terço inferior e fica alinhado ao mesmo'
      + ' eixo do restante da peça.',
    )
  } else if (cta) {
    linhas.push(
      `- um único botão sólido, preenchido com a cor de destaque da marca, com o texto "${cta}".`,
      '- alinhado ao mesmo eixo do restante da peça, com respiro em volta.',
    )
  }

  if (secundarios.length) {
    linhas.push(
      // "Menor que o botão" só faz sentido se existir botão — sem CTA, a faixa é
      // o único elemento do rodapé e a referência de tamanho tem de ser outra.
      `- uma faixa na base, ${cta ? 'em tipo menor que o botão' : 'em tipo pequeno e discreto'},`
      + ` com: ${secundarios.map(i => i.value).join('  ·  ')}`,
      '- a faixa atravessa a peça de margem a margem, com fundo que garanta leitura.',
    )
  }

  if (!cta && principal) {
    linhas.push(
      `- uma faixa de contato na base, com fundo que garanta leitura: ${principal.value}`,
    )
  }

  if (linhas.length === 1) {
    return 'RODAPÉ: esta peça não leva chamada, telefone, endereço, site nem perfil.'
      + ' Deixe a base limpa e equilibrada. Não escreva contato nenhum — inventado, ele'
      + ' manda o cliente do anunciante para o telefone de outra pessoa.'
  }

  if (items.length) linhas.push(`- ${COPIA_FIEL}`)

  return linhas.join('\n')
}

/**
 * Prompt final da imagem.
 *
 * Modelado numa peça que comprovadamente funcionou: mesmo esqueleto, mesma
 * ordem, mesmo idioma. As duas seções que mais mudam o resultado são as menos
 * óbvias:
 *
 * - **Produto.** A lista "NÃO adicionar" pesa mais que a lista "contém": dizer
 *   que o lanche tem alface não impede o bacon de aparecer; dizer "sem bacon"
 *   impede. Sem ela, o modelo enfeita, e a arte mostra um produto que o cliente
 *   não vende.
 * - **Textos.** Vão em bloco corrido, na ordem de leitura, e não amarrados a
 *   rótulos de zona. Cada rótulo a mais é uma instrução a mais competindo com a
 *   tarefa de grafar as palavras corretamente.
 */
export function buildImagePrompt(
  brief: CreativeBrief,
  input: GenerationInput,
  /** A logo segue anexada à chamada, em vez de ser composta depois. */
  logoComoReferencia = false,
): string {
  const format = FORMATS[input.format]
  const partes: string[] = [
    `Você é um diretor de arte premiado especializado em campanhas publicitárias para ${input.niche}.`,
    `Crie uma arte para redes sociais em formato ${format.ratio}.`,
    'A arte deve parecer produzida por uma agência profissional, com acabamento premium.',
    '',
    `CENA:\n${brief.imagePrompt}`,
    '',
    `CORES:\n${brief.colorGuidance}`,
    '',
    `LAYOUT:\n${brief.layoutPlan}`,
  ]

  const produto: string[] = [`PRODUTO: ${input.product}`, brief.photography]
  if (brief.productIncludes.length) {
    produto.push(`O produto contém APENAS: ${brief.productIncludes.join(', ')}.`)
  }
  if (brief.productExcludes.length) {
    produto.push(`NÃO adicionar de forma alguma: ${brief.productExcludes.join(', ')}.`)
  }
  partes.push('', produto.join('\n'))

  if (input.renderMode === 'ai') {
    const { headline, subheadline, price, promotion, cta, items } = brief.textOverlay

    /**
     * O CTA sai da lista de textos e vira **botão** no rodapé.
     *
     * Listado junto com o resto, ele saía como mais uma frase solta sobre a
     * foto — e é justamente o elemento que o público precisa reconhecer como
     * clicável mesmo numa imagem estática.
     */
    const textos = [headline, subheadline, ...items, promotion, price]
      .filter((t): t is string => Boolean(t))

    partes.push(
      '',
      'TEXTOS — escreva exatamente estas palavras na arte, em português do Brasil,'
      + ' com grafia idêntica e tipografia moderna de alto contraste:',
      textos.join('\n'),
    )

    if (items.length) {
      partes.push(
        '',
        'Os itens do combo formam uma coluna alinhada dentro de um bloco tratado, com'
        + ' marcador ou separador entre eles e espaçamento constante. Nunca soltos sobre'
        + ' a foto e nunca encostados no selo de preço.',
      )
    }

    partes.push('', buildFooterBlock(cta, input))
    partes.push('', 'Não escreva nenhum outro texto, letra ou número na imagem.')
  } else {
    partes.push(
      '',
      'TEXTOS: não escreva texto, letra ou número algum. Deixe espaço negativo limpo'
      + ' onde a tipografia será composta depois.',
    )
  }

  if (logoComoReferencia) {
    /**
     * A logo vai anexada à chamada, e o risco desta rota é o modelo tratar a
     * imagem recebida como **tela** — foi o que aconteceu quando ela era a
     * única entrada, e a composição inteira ficou ancorada num arquivo de 200
     * pixels. As duas últimas frases existem só para desfazer essa leitura.
     */
    partes.push(
      '',
      'LOGO: a imagem anexada é a LOGO da marca. Ela NÃO é o fundo, NÃO é a base'
      + ' da arte e NÃO deve ser reinterpretada ou redesenhada.'
      + ' Aplique-a no canto superior esquerdo exatamente como está: mesmas formas,'
      + ' mesmas proporções, mesmas cores, sem distorcer e sem recolorir, com respiro'
      + ' ao redor e sem competir com o título.'
      + ' Todo o restante da arte deve ser criado do zero conforme descrito acima.',
    )
  } else if (input.logoPath) {
    // A logo será composta com `sharp` depois. Aqui só se reserva o lugar — e se
    // proíbe o modelo de inventar uma marca, que ele faz se o canto ficar vazio.
    partes.push(
      '',
      'LOGO: deixe o canto superior esquerdo limpo, de fundo liso e sem elemento'
      + ' importante, reservado para a logo real da marca ser aplicada depois.'
      + ' Não desenhe, não invente e não escreva nenhuma logo, emblema ou nome de marca.',
    )
  }

  partes.push('', `DIAGRAMAÇÃO:\n${DIAGRAMACAO}`)
  partes.push('', `QUALIDADE:\n${QUALIDADE}`)
  partes.push('', `EVITAR: ${brief.negativePrompt}; ${NUNCA}.`)

  return partes.join('\n')
}
