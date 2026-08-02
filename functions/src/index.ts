/**
 * Cloud Functions do CriaPosts.
 *
 * Três funções, três responsabilidades:
 *
 * - `onGenerationCreated` — o worker de geração (§7.1)
 * - `cleanupExpiredGenerations` — a retenção de 24h (§0.5)
 * - `reconcileStuckJobs` — a rede de segurança de crédito (§7.5)
 *
 * A API HTTP **não** mora aqui: ela é o servidor Nitro do Nuxt, empacotado no
 * deploy do próprio app (§0.2). Este pacote é só o trabalho de background.
 */
export { onGenerationCreated } from './triggers/onGenerationCreated'
export { cleanupExpiredGenerations } from './scheduled/cleanupExpiredGenerations'
export { reconcileStuckJobs } from './scheduled/reconcileStuckJobs'
