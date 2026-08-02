import type { ActiveGenerationStatus, GenerationStatus } from '../types/generation'

/** Limites de upload da logo — validados no cliente, nas Storage Rules e no servidor. */
export const UPLOAD_LIMITS = {
  logoMaxBytes: 2 * 1024 * 1024,
  logoMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const,
  logoMinDimension: 64,
} as const

/** Limites de campo do formulário. Espelhados no schema Zod do servidor. */
export const INPUT_LIMITS = {
  niche: { min: 2, max: 60 },
  product: { min: 2, max: 80 },
  description: { max: 400 },
  promotion: { max: 120 },
  cta: { max: 60 },
  extraInstructions: { max: 500 },
  colors: { max: 4 },
  priceCents: { min: 0, max: 100_000_000 },
} as const

/** Guardas operacionais do worker de geração. */
export const GENERATION_LIMITS = {
  maxAttempts: 3,
  /**
   * Além disso a tela avisa que algo pode ter dado errado.
   *
   * Fica **antes** de `stuckAfterMs` de propósito. Uma geração leva de 20s a
   * 90s, então aos 6 minutos já não há desfecho bom possível — e sem aviso a
   * tela mostra a mesma barra parada com a mesma mensagem tranquilizadora, o
   * que lê como travamento do app. O usuário descobre pelo aviso antes de o
   * sistema agir, e não fica olhando para um spinner adivinhando.
   */
  slowAfterMs: 6 * 60 * 1000,
  /** Além disso o job é considerado travado e estornado pelo cron de reconciliação. */
  stuckAfterMs: 10 * 60 * 1000,
  /** Teto global de gasto diário com a API de imagem, em USD. */
  dailyCostCapUsd: 250,
  /**
   * Jobs simultâneos por usuário. Igual para todo mundo — sem planos, não há
   * o que diferenciar, e o limite existe para proteger a fila, não para vender.
   */
  maxConcurrentJobs: 2,
} as const

/**
 * Retenção das artes geradas: **24 horas**.
 *
 * O documento carrega `expiresAt` e some por política de TTL do Firestore; os
 * arquivos somem por regra de ciclo de vida do bucket. São dois mecanismos
 * porque são dois sistemas — o TTL do Firestore não toca no Storage, e a regra
 * do bucket não sabe o que é uma geração.
 *
 * Consequência que a UI precisa deixar clara: baixar a arte não é opcional.
 * Toda tela de resultado e todo card do histórico mostram quanto tempo resta.
 */
export const GENERATION_RETENTION_HOURS = 24

export const GENERATION_RETENTION_MS = GENERATION_RETENTION_HOURS * 60 * 60 * 1000

/** Momento em que a arte deixa de existir. Calculado na criação do job. */
export function retentionExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + GENERATION_RETENTION_MS)
}

/** Horas inteiras restantes até a exclusão. `0` quando já expirou. */
export function hoursUntilExpiry(expiresAt: Date, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (60 * 60 * 1000)))
}

/** Status em que o job ainda ocupa um slot de concorrência do usuário. */
export const ACTIVE_STATUSES: ActiveGenerationStatus[] = [
  'queued',
  'briefing',
  'rendering',
  'finishing',
]

export function isActiveStatus(status: GenerationStatus): status is ActiveGenerationStatus {
  return (ACTIVE_STATUSES as GenerationStatus[]).includes(status)
}

export function isTerminalStatus(status: GenerationStatus): boolean {
  return !isActiveStatus(status)
}

/**
 * Microcopy de cada etapa. Um job leva de 20s a 90s — texto que muda conforme o
 * trabalho real acontece é o que impede o usuário de achar que travou.
 */
export const STATUS_COPY: Record<GenerationStatus, { title: string; hint: string }> = {
  queued: { title: 'Na fila', hint: 'Preparando tudo para começar…' },
  briefing: { title: 'Criando o conceito', hint: 'Definindo direção de arte, legenda e hashtags.' },
  rendering: { title: 'Desenhando a arte', hint: 'Essa é a parte mais demorada. Vale a pena.' },
  finishing: { title: 'Finalizando', hint: 'Ajustando formato e preparando os downloads.' },
  completed: { title: 'Pronto!', hint: 'Sua arte está pronta para publicar.' },
  failed: { title: 'Não deu certo', hint: 'Seus créditos foram devolvidos.' },
  canceled: { title: 'Cancelado', hint: 'A geração foi interrompida.' },
}

/** Progresso aproximado por etapa, para a barra não ficar parada. */
export const STATUS_PROGRESS: Record<GenerationStatus, number> = {
  queued: 5,
  briefing: 25,
  rendering: 60,
  finishing: 90,
  completed: 100,
  failed: 100,
  canceled: 100,
}
