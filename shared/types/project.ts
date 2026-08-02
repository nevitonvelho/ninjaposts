import type { Auditable, FsTimestamp } from './firestore'
import type { BrandSettings } from './user'
import type { StyleId } from './generation'

/**
 * `projects/{projectId}` — uma marca do usuário (a hamburgueria, o salão, a loja).
 *
 * Existe para não obrigar a redigitar nicho, cores e logo a cada post, e para
 * suportar quem gerencia mais de um negócio (agências, franqueados).
 */
export interface ProjectDoc extends Auditable {
  id: string
  ownerId: string
  name: string
  niche: string
  description: string | null
  brand: BrandSettings
  /** Contador desnormalizado — evita `count()` a cada render da lista. */
  generationsCount: number
  archivedAt: FsTimestamp | null
}

/** `templates/{templateId}` — presets de estilo curados. Leitura pública, escrita só admin. */
export interface TemplateDoc {
  id: string
  name: string
  description: string
  /** Nichos em que o preset brilha. Vazio = universal. */
  niches: string[]
  style: StyleId
  /** Injetado no prompt final de imagem. */
  promptFragment: string
  negativePrompt: string | null
  previewPath: string
  isPremium: boolean
  isActive: boolean
  sortOrder: number
}

// ---------------------------------------------------------------------------
// Agregados do admin
// ---------------------------------------------------------------------------

/**
 * `stats/global` e `stats/daily_{YYYY-MM-DD}` — contadores mantidos por triggers.
 *
 * O painel admin lê 2 documentos em vez de varrer centenas de milhares de
 * gerações. É o que mantém a página instantânea em qualquer volume.
 */
export interface StatsDoc {
  id: string
  users: number
  newUsers: number
  generations: number
  generationsFailed: number
  downloads: number
  /** Custo de API acumulado, em USD. */
  costUsd: number
  /** Receita reconhecida no período, em centavos de BRL. */
  revenueCents: number
  activeSubscriptions: Record<string, number>
  updatedAt: FsTimestamp
}
