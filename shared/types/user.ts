import type { Auditable, FsTimestamp } from './firestore'
import type { StyleId } from './generation'

export type UserRole = 'user' | 'admin'

/** Identidade visual reutilizada em todo post. */
export interface BrandSettings {
  /** Caminho no Storage, não URL. URLs de download expiram e não sobrevivem a troca de bucket. */
  logoPath: string | null
  /** Cores da marca em hex (`#RRGGBB`). Primeira é a dominante. */
  colors: string[]
  defaultStyle: StyleId | null
}

export interface UserStats {
  generations: number
  downloads: number
  /** Total já comprado, em créditos. Só sobe — é histórico, não saldo. */
  creditsPurchased: number
}

/**
 * `users/{uid}` — criado pelo trigger `onUserCreated`, nunca pelo cliente.
 * Se o cliente criasse, poderia escolher o próprio saldo de créditos.
 */
export interface UserDoc extends Auditable {
  uid: string
  email: string
  displayName: string
  photoURL: string | null
  company: string | null
  role: UserRole

  /**
   * Saldo atual. Somente o Admin SDK escreve — bloqueado nas Security Rules.
   *
   * Não expira e não zera: acumula compra após compra. Por isso não existe
   * `creditsResetAt` aqui — não há ciclo a reiniciar.
   */
  credits: number
  /** Jobs em andamento. Limita concorrência por usuário. */
  activeJobs: number

  brand: BrandSettings
  stats: UserStats
  lastSeenAt: FsTimestamp
}

/** Único subconjunto que o cliente pode escrever no próprio documento. */
export type UserEditableFields = Pick<UserDoc, 'displayName' | 'company' | 'brand'>

export type CreditReason =
  | 'signup_bonus'
  | 'generation'
  | 'refund'
  | 'purchase'
  | 'admin_adjust'

/** `creditLedger/{entryId}` — imutável. Toda mutação de saldo passa por aqui. */
export interface CreditLedgerDoc {
  id: string
  ownerId: string
  /** Negativo = débito, positivo = crédito. */
  delta: number
  balanceAfter: number
  reason: CreditReason
  /** Id da geração, assinatura ou admin responsável. */
  refId: string | null
  note: string | null
  createdAt: FsTimestamp
}
