/** Nomes das coleções do Firestore. Usados no cliente, no Nitro, nas Functions e nas Rules. */
export const COLLECTIONS = {
  users: 'users',
  projects: 'projects',
  generations: 'generations',
  purchases: 'purchases',
  templates: 'templates',
  creditLedger: 'creditLedger',
  webhookEvents: 'webhookEvents',
  stats: 'stats',
} as const

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS]

/** Caminhos no Cloud Storage. Centralizados para não haver string solta no código. */
export const STORAGE_PATHS = {
  userLogo: (uid: string, fileId: string, ext: string) => `users/${uid}/logo/${fileId}.${ext}`,
  generationOriginal: (uid: string, genId: string) => `generations/${uid}/${genId}/original.png`,
  generationJpg: (uid: string, genId: string) => `generations/${uid}/${genId}/image.jpg`,
  generationThumb: (uid: string, genId: string) => `generations/${uid}/${genId}/thumb.webp`,
  templatePreview: (templateId: string) => `templates/${templateId}/preview.webp`,
} as const

/** Documentos de agregado lidos pelo painel admin. */
export const STATS_DOCS = {
  global: 'global',
  daily: (date: string) => `daily_${date}`,
} as const
