import { z } from 'zod'
import {
  ASSET_LIMITS,
  BUSINESS_FIELD,
  BUSINESS_FIELD_IDS,
  INPUT_LIMITS,
  MAX_CONTACT_ITEMS,
  UPLOAD_LIMITS,
  emptyBusinessInfo,
} from '../constants'
import type { BusinessField } from '../types/user'

/**
 * Fonte única de validação. O formulário do cliente e a rota do Nitro usam
 * exatamente estes schemas.
 *
 * Isso não é só conveniência: validação duplicada *diverge* com o tempo, e a
 * versão do servidor sempre acaba mais frouxa que a do cliente — que é o lado
 * que importa, já que o cliente é controlável pelo usuário.
 */

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

/** Campo opcional de texto: string vazia vira `null` antes de validar. */
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .transform(v => (v.length ? v : null))
    .nullable()
    .default(null)
}

export const hexColorSchema = z
  .string()
  .regex(HEX_COLOR, 'Use uma cor no formato #RRGGBB')

export const socialNetworkSchema = z.enum([
  'instagram',
  'facebook',
  'tiktok',
  'linkedin',
  'whatsapp',
])

export const postFormatSchema = z.enum(['square', 'portrait', 'story', 'landscape'])

export const styleSchema = z.enum([
  'minimalista',
  'moderno',
  'elegante',
  'vibrante',
  'retro',
  'luxuoso',
  'divertido',
  'natural',
  'tecnologico',
  'artesanal',
])

export const renderModeSchema = z.enum(['ai', 'hybrid'])
export const packSchema = z.enum(['starter', 'essencial', 'pro'])

export const businessFieldSchema = z.enum(
  BUSINESS_FIELD_IDS as [BusinessField, ...BusinessField[]],
)

/**
 * Todo campo do estabelecimento é opcional e tem limite próprio, tirado do
 * catálogo — assim adicionar "PIX" amanhã é uma entrada em `BUSINESS_FIELDS`,
 * não uma edição em três arquivos.
 */
export const businessInfoSchema = z.object(
  Object.fromEntries(
    BUSINESS_FIELD_IDS.map(id => [id, optionalText(BUSINESS_FIELD[id].max)]),
  ) as Record<BusinessField, ReturnType<typeof optionalText>>,
)

/**
 * O valor vai ser **grafado na arte**, então o limite é de legibilidade, não de
 * armazenamento: uma linha de rodapé com 80 caracteres já sai ilegível no feed.
 */
export const contactItemSchema = z.object({
  field: businessFieldSchema,
  value: z.string().trim().min(1).max(120),
})

export const generationInputSchema = z.object({
  niche: z
    .string()
    .trim()
    .min(INPUT_LIMITS.niche.min, 'Informe o nicho do seu negócio')
    .max(INPUT_LIMITS.niche.max),
  product: z
    .string()
    .trim()
    .min(INPUT_LIMITS.product.min, 'Informe o produto ou serviço')
    .max(INPUT_LIMITS.product.max),
  description: optionalText(INPUT_LIMITS.description.max),
  priceCents: z
    .number()
    .int('O preço deve ser um valor inteiro em centavos')
    .min(INPUT_LIMITS.priceCents.min)
    .max(INPUT_LIMITS.priceCents.max)
    .nullable()
    .default(null),
  promotion: optionalText(INPUT_LIMITS.promotion.max),
  cta: optionalText(INPUT_LIMITS.cta.max),

  networks: z
    .array(socialNetworkSchema)
    .min(1, 'Escolha pelo menos uma rede social')
    .max(5),
  format: postFormatSchema,
  style: styleSchema,
  templateId: z.string().trim().min(1).nullable().default(null),

  colors: z
    .array(hexColorSchema)
    .max(INPUT_LIMITS.colors.max, `No máximo ${INPUT_LIMITS.colors.max} cores`)
    .default([]),
  logoPath: z.string().trim().min(1).nullable().default(null),
  productAssetIds: z
    .array(z.string().trim().min(1).max(64))
    .max(ASSET_LIMITS.perGeneration, `No máximo ${ASSET_LIMITS.perGeneration} produtos por arte`)
    .default([]),
  contactItems: z
    .array(contactItemSchema)
    .max(MAX_CONTACT_ITEMS, `No máximo ${MAX_CONTACT_ITEMS} informações de contato na arte`)
    .default([]),

  renderMode: renderModeSchema.default('ai'),
  extraInstructions: optionalText(INPUT_LIMITS.extraInstructions.max),
})

export const createGenerationSchema = z.object({
  input: generationInputSchema,
  projectId: z.string().trim().min(1).nullable().default(null),
  parentId: z.string().trim().min(1).nullable().default(null),
})

export const brandSchema = z.object({
  logoPath: z.string().trim().min(1).nullable().default(null),
  colors: z.array(hexColorSchema).max(INPUT_LIMITS.colors.max).default([]),
  defaultStyle: styleSchema.nullable().default(null),
  business: businessInfoSchema.default(() => emptyBusinessInfo()),
})

/**
 * O formulário de perfil envia o objeto inteiro — não existe edição parcial na
 * UI. Validar tudo de uma vez é o que garante que `brand.business` chegue
 * completo ao Firestore: um merge parcial gravaria `undefined` nos campos que
 * a tela não tocou, e o Firestore recusa `undefined`.
 */
export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2, 'Informe seu nome').max(80),
  company: optionalText(80),
  brand: brandSchema,
})

export const assetKindSchema = z.enum(['style', 'product'])

/**
 * Biblioteca de assets. Validado no cliente porque a escrita é direta pelo SDK
 * — as Security Rules barram quem não é admin, mas não sabem dizer "o nome
 * está curto demais" de um jeito que dê para mostrar na tela.
 */
export const assetSchema = z.object({
  kind: assetKindSchema,
  name: z
    .string()
    .trim()
    .min(ASSET_LIMITS.name.min, 'Dê um nome para achar depois')
    .max(ASSET_LIMITS.name.max),
  /**
   * Pelo menos um nicho, sempre — mesmo que seja `universal`. Asset sem nicho
   * nenhum é invisível para a consulta do worker, que casa por
   * `array-contains`, e viraria um arquivo pago que nunca é usado.
   */
  niches: z
    .array(z.string().trim().min(1).max(60))
    .min(1, 'Escolha ao menos um nicho, ou marque como universal')
    .max(ASSET_LIMITS.niches.max),
  path: z.string().trim().min(1, 'Envie o arquivo'),
  description: optionalText(ASSET_LIMITS.description.max),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
})

export const projectSchema = z.object({
  name: z.string().trim().min(2, 'Dê um nome ao projeto').max(60),
  niche: z.string().trim().min(INPUT_LIMITS.niche.min).max(INPUT_LIMITS.niche.max),
  description: optionalText(240),
  brand: brandSchema,
})

/**
 * Não há schema de checkout: o pagamento acontece em link fixo hospedado pelo
 * gateway (§8), então o app nunca monta uma sessão de compra. O que precisa de
 * validação é o webhook, e ele é validado por assinatura, não por schema.
 */

export const adjustCreditsSchema = z.object({
  uid: z.string().trim().min(1),
  delta: z.number().int().min(-10_000).max(10_000),
  note: z.string().trim().min(3).max(200),
})

// --- Credenciais -----------------------------------------------------------

export const emailSchema = z.string().trim().toLowerCase().email('E-mail inválido')

export const passwordSchema = z
  .string()
  .min(8, 'Use pelo menos 8 caracteres')
  .max(128)

export const loginSchema = z.object({ email: emailSchema, password: passwordSchema })

export const registerSchema = z.object({
  displayName: z.string().trim().min(2, 'Informe seu nome').max(80),
  email: emailSchema,
  password: passwordSchema,
})

// --- Upload ----------------------------------------------------------------

export interface FileValidationResult {
  valid: boolean
  error: string | null
}

/** Espelha as Storage Rules. A regra no servidor é a que vale; esta dá feedback imediato. */
export function validateLogoFile(file: { size: number; type: string }): FileValidationResult {
  if (!(UPLOAD_LIMITS.logoMimeTypes as readonly string[]).includes(file.type)) {
    return { valid: false, error: 'Envie um arquivo PNG, JPG, WebP ou SVG.' }
  }
  if (file.size > UPLOAD_LIMITS.logoMaxBytes) {
    const mb = UPLOAD_LIMITS.logoMaxBytes / 1024 / 1024
    return { valid: false, error: `A logo deve ter no máximo ${mb}MB.` }
  }
  return { valid: true, error: null }
}

// --- Erros -----------------------------------------------------------------

/** Achata erros do Zod no formato `{ campo: [mensagens] }` usado por `ApiError.details`. */
export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_'
    ;(result[key] ??= []).push(issue.message)
  }
  return result
}

export type GenerationInputSchema = z.infer<typeof generationInputSchema>
