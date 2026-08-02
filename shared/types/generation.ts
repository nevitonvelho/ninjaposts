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

/** Textos que o modo `hybrid` compõe deterministicamente sobre a arte. */
export interface TextOverlay {
  headline: string
  price: string | null
  promotion: string | null
  cta: string | null
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
