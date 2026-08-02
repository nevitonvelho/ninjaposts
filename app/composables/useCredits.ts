import { CREDIT_COST_PER_GENERATION, GENERATION_LIMITS, PACK_LIST } from '#shared/constants'

export type BlockReason = 'profile_not_ready' | 'insufficient_credits' | 'too_many_active_jobs' | null

/**
 * Saldo, custo e permissão de gerar.
 *
 * A regra de custo **não** é reimplementada aqui: vem de
 * `CREDIT_COST_PER_GENERATION`, o mesmo valor que o servidor usa para debitar.
 * Cliente e servidor divergirem no preço é o bug que aparece como "cobrou 2 e
 * mostrou 1" — e some do radar até alguém reclamar.
 */
export function useCredits() {
  const auth = useAuthStore()

  const balance = computed(() => auth.credits)
  const ready = computed(() => auth.profileStatus === 'ready')

  const activeJobs = computed(() => auth.userDoc?.activeJobs ?? 0)
  const maxConcurrentJobs = GENERATION_LIMITS.maxConcurrentJobs

  /** Todo post custa o mesmo — inclusive regerar. */
  const cost = CREDIT_COST_PER_GENERATION

  /** Menor pacote que resolve o saldo agora — CTA da tela sem crédito. */
  const suggestedPack = computed(() => PACK_LIST.find(pack => pack.highlighted) ?? PACK_LIST[0]!)

  const blockReason = computed<BlockReason>(() => {
    if (!ready.value) return 'profile_not_ready'
    if (balance.value < cost) return 'insufficient_credits'
    if (activeJobs.value >= maxConcurrentJobs) return 'too_many_active_jobs'
    return null
  })

  const canGenerate = computed(() => blockReason.value === null)

  /** Mensagem já pronta para a UI — evita cada tela inventar a sua. */
  const blockMessage = computed<string | null>(() => {
    switch (blockReason.value) {
      case 'profile_not_ready':
        return 'Estamos carregando sua conta. Aguarde um instante.'
      case 'insufficient_credits':
        return 'Você está sem créditos. Compre um pacote para continuar criando.'
      case 'too_many_active_jobs':
        return `Você já tem ${maxConcurrentJobs} artes sendo geradas. Aguarde uma terminar.`
      default:
        return null
    }
  })

  return {
    balance,
    ready,
    activeJobs,
    maxConcurrentJobs,
    cost,
    suggestedPack,
    canGenerate,
    blockReason,
    blockMessage,
  }
}
