import type { Auditable, FsTimestamp, SoftDeletable } from './firestore'

// ---------------------------------------------------------------------------
// Vocabulário do domínio
// ---------------------------------------------------------------------------

export type SocialNetwork =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'linkedin'
  | 'whatsapp'

/**
 * Formato da peça. Determina o tamanho de render e o recorte final.
 * Ver `shared/constants/formats.ts` para as dimensões.
 */
export type PostFormat = 'square' | 'portrait' | 'story' | 'landscape'

export type StyleId =
  | 'minimalista'
  | 'moderno'
  | 'elegante'
  | 'vibrante'
  | 'retro'
  | 'luxuoso'
  | 'divertido'
  | 'natural'
  | 'tecnologico'
  | 'artesanal'

/**
 * Como o texto e a logo chegam na arte final.
 *
 * - `ai`     — o modelo de imagem renderiza tudo, a logo entra como imagem de
 *              referência. Resultado mais coeso, risco de erro tipográfico.
 * - `hybrid` — a IA gera só a cena; preço, CTA e logo são compostos com `sharp`
 *              a partir de `CreativeBrief.textOverlay`. Texto sempre perfeito.
 *
 * v1 entrega `ai`; `hybrid` é um branch na etapa de processamento do worker.
 */
export type RenderMode = 'ai' | 'hybrid'

// ---------------------------------------------------------------------------
// Entrada do usuário
// ---------------------------------------------------------------------------

/** Exatamente o que o usuário preencheu no formulário. Persistido para permitir duplicar. */
export interface GenerationInput {
  niche: string
  product: string
  description: string | null
  /** Em centavos, para evitar aritmética de ponto flutuante com dinheiro. */
  priceCents: number | null
  promotion: string | null
  cta: string | null

  networks: SocialNetwork[]
  format: PostFormat
  style: StyleId
  templateId: string | null

  colors: string[]
  logoPath: string | null

  renderMode: RenderMode
  /** Instruções livres do usuário, anexadas ao briefing. */
  extraInstructions: string | null
}

// ---------------------------------------------------------------------------
// Briefing criativo (saída estruturada do modelo de texto)
// ---------------------------------------------------------------------------

/**
 * Textos que aparecem na arte — renderizados pelo modelo no modo `ai`,
 * compostos com `sharp` no modo `hybrid`.
 *
 * Cada campo corresponde a **uma zona** da peça, e é isso que torna a
 * tipografia previsível: string curta amarrada a um lugar erra muito menos que
 * um bloco de texto solto no prompt.
 */
export interface TextOverlay {
  headline: string
  /** Linha de apoio sob o título. Ex.: "Simples. Gostoso. Do jeito certo." */
  subheadline: string | null
  price: string | null
  promotion: string | null
  cta: string | null
  /**
   * Itens do combo/pacote, um por linha, para a coluna lateral.
   * Ex.: `['1 X-Egg', 'Batata pequena', '1 Coca-Cola 600ml']`.
   */
  items: string[]
  /**
   * Telefone, WhatsApp ou endereço para a barra de contato.
   *
   * **Só é preenchido quando o dado veio do usuário.** Um número inventado numa
   * peça que o dono vai publicar é o pior defeito possível deste produto — pior
   * que arte feia, porque manda cliente para o telefone de outra pessoa.
   */
  contact: string | null
}

/**
 * Resultado da primeira chamada à OpenAI (Responses API + Structured Outputs).
 *
 * Traduzir campos crus em direção de arte é o que faz a diferença de qualidade:
 * modelos de imagem respondem muito melhor a um prompt descritivo e
 * cinematográfico do que a uma lista de campos de formulário.
 */
export interface CreativeBrief {
  imagePrompt: string
  /**
   * O que o produto contém — e, crucialmente, o que ele **não** contém.
   *
   * Existe porque modelo de imagem enfeita por padrão: pede-se um X-Egg e vem
   * bacon, cebola caramelizada e um molho âmbar que ninguém pediu. O resultado
   * é uma foto de um produto que o cliente não vende, o que é pior do que uma
   * foto feia — ele publica e alguém pede o que viu.
   *
   * A lista negativa carrega mais peso que a positiva: dizer "contém alface"
   * não impede o bacon de aparecer, dizer "sem bacon" impede.
   */
  productIncludes: string[]
  productExcludes: string[]
  /**
   * Diagramação da peça, zona por zona, em inglês.
   *
   * É o campo que separa "foto bonita com texto por cima" de anúncio. Sem
   * pedir posição explícita de logo, título, coluna de itens, caixa de preço e
   * rodapé, o modelo entrega uma cena — que foi exatamente o que ele fazia.
   */
  layoutPlan: string
  /**
   * Direção de fotografia do produto, em inglês. Lente, luz, textura.
   *
   * Separado do `imagePrompt` porque é o que resolve o aspecto plástico: sem
   * direção explícita, o modelo assume render 3D, não fotografia.
   */
  photography: string
  negativePrompt: string
  caption: string
  hashtags: string[]
  altText: string
  colorGuidance: string
  textOverlay: TextOverlay
}

// ---------------------------------------------------------------------------
// Documento da geração
// ---------------------------------------------------------------------------

/**
 * Ciclo de vida do job. O worker avança um estado por etapa, e o cliente
 * acompanha por `onSnapshot` — a barra de progresso mostra trabalho real.
 */
export type GenerationStatus =
  | 'queued'
  | 'briefing'
  | 'rendering'
  | 'finishing'
  | 'completed'
  | 'failed'
  | 'canceled'

export type GenerationErrorCode =
  | 'content_policy'
  | 'provider_error'
  | 'rate_limited'
  /**
   * Conta do provedor sem saldo — separado de `rate_limited` porque a OpenAI
   * devolve 429 para os dois, e os desfechos são opostos: throttling passa
   * sozinho, saldo zerado não passa nunca. Tratar como o mesmo caso faz o app
   * mandar o usuário "tentar de novo em alguns minutos" para sempre.
   */
  | 'quota_exhausted'
  | 'invalid_input'
  | 'timeout'
  | 'internal'

export interface GenerationError {
  code: GenerationErrorCode
  /** Mensagem já pronta para o usuário, em português. */
  message: string
}

export interface GenerationOutput {
  imagePath: string | null
  jpgPath: string | null
  thumbPath: string | null
  width: number
  height: number
  caption: string | null
  hashtags: string[]
  altText: string | null
}

/** Observabilidade e custo. É o que permite ajustar prompt e precificação com dados reais. */
export interface GenerationMeta {
  briefModel: string
  imageModel: string
  /** Prompt final enviado ao modelo de imagem. */
  promptUsed: string
  revisedPrompt: string | null
  tokensIn: number
  tokensOut: number
  costUsd: number
  durationMs: number
  attempt: number
}

export interface GenerationDoc extends Auditable, SoftDeletable {
  id: string
  ownerId: string
  projectId: string | null

  input: GenerationInput
  status: GenerationStatus
  /** 0–100. */
  progress: number
  error: GenerationError | null
  output: GenerationOutput | null
  meta: GenerationMeta | null

  creditsCharged: number
  refunded: boolean
  /** Origem quando o post veio de "gerar novamente" ou "duplicar". */
  parentId: string | null
  completedAt: FsTimestamp | null

  /**
   * Momento da exclusão automática — 24h após a criação (§ retenção).
   *
   * É o campo lido pela política de TTL do Firestore, e existe no documento
   * (em vez de ser derivado de `createdAt` na leitura) porque o TTL do
   * Firestore precisa de um campo próprio para indexar.
   */
  expiresAt: FsTimestamp
}

/** Status em que o job ainda está ocupando um slot de concorrência. */
export type ActiveGenerationStatus = Extract<
  GenerationStatus,
  'queued' | 'briefing' | 'rendering' | 'finishing'
>
