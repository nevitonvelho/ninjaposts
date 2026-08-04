import type { GenerationDoc, GenerationInput } from './generation'
import type { BusinessInfo } from './user'
import type { CreditPack, PurchaseDoc } from './billing'
import type { Serialized } from './firestore'

/**
 * Contratos entre `app/` e `server/api`. Como `shared/` é auto-importado nos
 * dois lados, uma mudança de contrato quebra o build do cliente e do servidor
 * ao mesmo tempo — que é exatamente o que queremos.
 */

// --- Erros -----------------------------------------------------------------

export type ApiErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'invalid_input'
  | 'insufficient_credits'
  | 'too_many_active_jobs'
  | 'rate_limited'
  | 'internal'

export interface ApiError {
  code: ApiErrorCode
  /** Mensagem pronta para exibir, em português. */
  message: string
  details?: Record<string, string[]>
}

// --- Gerações --------------------------------------------------------------

export interface CreateGenerationBody {
  input: GenerationInput
  projectId?: string | null
  /** Preenchido em "gerar novamente" / "duplicar". */
  parentId?: string | null
}

/** 202 Accepted: o job foi aceito, o resultado chega por `onSnapshot`. */
export interface CreateGenerationResponse {
  id: string
  creditsCharged: number
  creditsRemaining: number
}

export type GenerationDto = Serialized<GenerationDoc>

export interface ListGenerationsQuery {
  cursor?: string
  limit?: number
  status?: string
  projectId?: string
  search?: string
}

export interface Paginated<T> {
  items: T[]
  nextCursor: string | null
}

// --- Perfil ----------------------------------------------------------------

export interface UpdateProfileBody {
  displayName?: string
  company?: string | null
  brand?: {
    logoPath?: string | null
    colors?: string[]
    defaultStyle?: string | null
    business?: Partial<BusinessInfo>
  }
}

// --- Créditos --------------------------------------------------------------

/**
 * O checkout é um link fixo do gateway — não há endpoint para criá-lo. O que a
 * API expõe é o extrato: o que foi comprado e o que foi consumido.
 */
export interface CreditSummary {
  balance: number
  purchased: number
  spent: number
  packs: CreditPack[]
}

export type PurchaseDto = Serialized<PurchaseDoc>

/**
 * Reivindica compras feitas antes do cadastro, casando pelo e-mail da conta.
 *
 * `pending > 0` com `emailVerified: false` é o caso que a UI precisa tratar:
 * a compra existe e é da pessoa, mas o crédito só entra depois que ela
 * confirmar o e-mail — sem isso, cadastrar-se com o e-mail alheio levaria a
 * compra de outra pessoa.
 */
export interface ClaimPurchasesResponse {
  claimed: number
  credits: number
  pending: number
  emailVerified: boolean
}

// --- Admin -----------------------------------------------------------------

export interface AdjustCreditsBody {
  uid: string
  delta: number
  note: string
}
