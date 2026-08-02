import {
  FORMATS,
  NETWORKS,
  NICHE_SUGGESTIONS,
  STYLES,
  creditCostFor,
  formatsForNetworks,
} from '#shared/constants'
import type { NicheSuggestion } from '#shared/constants'
import type {
  GenerationInput,
  PostFormat,
  RenderMode,
  SocialNetwork,
  StyleId,
} from '#shared/types/generation'

/**
 * Rascunho do formulário de criação.
 *
 * É store e não composable porque o estado precisa sobreviver à navegação: o
 * usuário sai de `/app/criar` para comprar créditos, volta, e o que digitou
 * continua lá. Persistido em `localStorage` para sobreviver também ao refresh —
 * perder 6 campos preenchidos por um F5 acidental é o tipo de atrito que faz
 * alguém desistir antes da primeira arte.
 */

export type StepId = 'business' | 'offer' | 'style' | 'brand'

export interface StepSpec {
  id: StepId
  label: string
  title: string
  description: string
  icon: string
}

export const GENERATOR_STEPS: StepSpec[] = [
  {
    id: 'business',
    label: 'Negócio',
    title: 'Sobre o seu negócio',
    description: 'O que você vende e para quem. É daqui que sai a direção de arte.',
    icon: 'lucide:store',
  },
  {
    id: 'offer',
    label: 'Oferta',
    title: 'A oferta do post',
    description: 'Preço, promoção e chamada. Tudo opcional — inclua só o que fizer sentido.',
    icon: 'lucide:tag',
  },
  {
    id: 'style',
    label: 'Estilo',
    title: 'Estilo e formato',
    description: 'Onde o post vai ser publicado e com que cara ele deve ter.',
    icon: 'lucide:palette',
  },
  {
    id: 'brand',
    label: 'Marca',
    title: 'Sua marca',
    description: 'Cores, logo e ajustes finais antes de gerar.',
    icon: 'lucide:sparkles',
  },
]

/**
 * Campos do `GenerationInput` sob responsabilidade de cada etapa.
 *
 * A validação roda sempre sobre o input inteiro (uma fonte só, o schema Zod do
 * `shared/`); este mapa serve apenas para decidir *onde* cada erro aparece e
 * se a etapa atual libera o avanço.
 */
const STEP_FIELDS: Record<StepId, (keyof GenerationInput)[]> = {
  business: ['niche', 'product', 'description'],
  offer: ['priceCents', 'promotion', 'cta'],
  style: ['networks', 'format', 'style', 'templateId'],
  brand: ['colors', 'logoPath', 'renderMode', 'extraInstructions'],
}

/**
 * Modelo do formulário — não é o `GenerationInput`.
 *
 * A diferença que importa é o preço: o campo guarda o que o usuário está
 * digitando ("29,9", "R$ 29,90", ""), e só vira `priceCents` na conversão. Se
 * guardássemos centavos direto, o campo apagaria a vírgula embaixo do cursor.
 */
export interface GeneratorDraft {
  niche: string
  product: string
  description: string
  priceInput: string
  promotion: string
  cta: string

  networks: SocialNetwork[]
  format: PostFormat
  style: StyleId
  templateId: string | null

  colors: string[]
  logoPath: string | null

  renderMode: RenderMode
  extraInstructions: string

  projectId: string | null
  parentId: string | null
}

/** A versão no nome invalida rascunhos antigos quando o formato do draft mudar. */
const DRAFT_KEY = 'criaposts:generator-draft:v1'

export function emptyDraft(): GeneratorDraft {
  return {
    niche: '',
    product: '',
    description: '',
    priceInput: '',
    promotion: '',
    cta: '',

    networks: ['instagram'],
    format: 'square',
    style: 'minimalista',
    templateId: null,

    colors: [],
    logoPath: null,

    renderMode: 'ai',
    extraInstructions: '',

    projectId: null,
    parentId: null,
  }
}

export const useGeneratorStore = defineStore('generator', () => {
  /**
   * `mergeDefaults` garante que um rascunho salvo antes de um campo existir
   * ganhe o default em vez de vir `undefined` e quebrar o `v-model`.
   */
  const draft = useLocalStorage<GeneratorDraft>(DRAFT_KEY, emptyDraft(), {
    mergeDefaults: true,
  })

  const stepIndex = ref(0)
  /** Etapas em que já tentamos avançar — só nelas os erros aparecem. */
  const validated = ref<Record<StepId, boolean>>({
    business: false,
    offer: false,
    style: false,
    brand: false,
  })

  const currentStep = computed(() => GENERATOR_STEPS[stepIndex.value] ?? GENERATOR_STEPS[0]!)
  const isFirstStep = computed(() => stepIndex.value === 0)
  const isLastStep = computed(() => stepIndex.value === GENERATOR_STEPS.length - 1)

  // -------------------------------------------------------------------------
  // Conversão e validação
  // -------------------------------------------------------------------------

  const priceCents = computed(() => parsePriceToCents(draft.value.priceInput))

  /** Objeto cru no formato que o schema espera. */
  const rawInput = computed(() => ({
    niche: draft.value.niche,
    product: draft.value.product,
    description: draft.value.description,
    priceCents: priceCents.value,
    promotion: draft.value.promotion,
    cta: draft.value.cta,

    networks: draft.value.networks,
    format: draft.value.format,
    style: draft.value.style,
    templateId: draft.value.templateId,

    colors: draft.value.colors,
    logoPath: draft.value.logoPath,

    renderMode: draft.value.renderMode,
    extraInstructions: draft.value.extraInstructions,
  }))

  const parsed = computed(() => generationInputSchema.safeParse(rawInput.value))

  /**
   * Input pronto para a API — com strings vazias já convertidas em `null` pelo
   * próprio schema. É o mesmo `safeParse` que o Nitro roda na Etapa 7, então
   * o que passa aqui passa lá.
   */
  const input = computed<GenerationInput | null>(() =>
    parsed.value.success ? (parsed.value.data as GenerationInput) : null,
  )

  const allErrors = computed<Record<string, string[]>>(() =>
    parsed.value.success ? {} : fieldErrors(parsed.value.error),
  )

  const isValid = computed(() => parsed.value.success)

  function stepHasErrors(id: StepId): boolean {
    return STEP_FIELDS[id].some(field => Boolean(allErrors.value[field]?.length))
  }

  /** Etapa completa: sem erros nos campos dela. */
  function isStepComplete(id: StepId): boolean {
    return !stepHasErrors(id)
  }

  /**
   * Erros visíveis. Enquanto o usuário não tentou avançar, o formulário fica
   * calado: marcar "informe o nicho" em vermelho antes de ele digitar a
   * primeira letra é ruído, não ajuda.
   */
  const visibleErrors = computed<Record<string, string[]>>(() => {
    const result: Record<string, string[]> = {}
    for (const step of GENERATOR_STEPS) {
      if (!validated.value[step.id]) continue
      for (const field of STEP_FIELDS[step.id]) {
        const messages = allErrors.value[field]
        if (messages?.length) result[field] = messages
      }
    }
    return result
  })

  function errorFor(field: keyof GenerationInput): string[] | null {
    return visibleErrors.value[field] ?? null
  }

  // -------------------------------------------------------------------------
  // Navegação
  // -------------------------------------------------------------------------

  /** Índice da primeira etapa incompleta — usado para não pular direto ao fim. */
  const firstIncompleteIndex = computed(() => {
    const index = GENERATOR_STEPS.findIndex(step => stepHasErrors(step.id))
    return index === -1 ? GENERATOR_STEPS.length - 1 : index
  })

  function goTo(index: number) {
    const target = Math.min(Math.max(index, 0), GENERATOR_STEPS.length - 1)
    // Voltar é sempre livre; avançar só até a primeira etapa que ainda falha.
    if (target > stepIndex.value && target > firstIncompleteIndex.value) {
      markValidated(GENERATOR_STEPS[firstIncompleteIndex.value]!.id)
      stepIndex.value = firstIncompleteIndex.value
      return
    }
    stepIndex.value = target
  }

  function markValidated(id: StepId) {
    validated.value = { ...validated.value, [id]: true }
  }

  /** Avança se a etapa atual estiver válida; caso contrário revela os erros. */
  function next(): boolean {
    const id = currentStep.value.id
    markValidated(id)
    if (stepHasErrors(id)) return false
    if (!isLastStep.value) stepIndex.value += 1
    return true
  }

  function back() {
    if (!isFirstStep.value) stepIndex.value -= 1
  }

  /** Revela todos os erros de uma vez — chamado no submit. */
  function validateAll(): boolean {
    validated.value = { business: true, offer: true, style: true, brand: true }
    if (isValid.value) return true
    stepIndex.value = firstIncompleteIndex.value
    return false
  }

  // -------------------------------------------------------------------------
  // Coerência entre campos
  // -------------------------------------------------------------------------

  /** Formatos que sobrevivem à interseção das redes escolhidas. */
  const availableFormats = computed(() => formatsForNetworks(draft.value.networks))

  /**
   * Escolher TikTok com "Feed quadrado" selecionado deixaria o formulário em um
   * estado que a API recusa. Em vez de mostrar erro, corrigimos para o formato
   * padrão da rede — o usuário mudou de rede, não errou.
   */
  watch(
    () => draft.value.networks,
    (networks) => {
      const allowed = availableFormats.value
      if (allowed.length && !allowed.includes(draft.value.format)) {
        const preferred = networks[0] ? NETWORKS[networks[0]].defaultFormat : allowed[0]!
        draft.value.format = allowed.includes(preferred) ? preferred : allowed[0]!
      }
    },
    { deep: true },
  )

  /**
   * Sugestão correspondente ao nicho digitado, se houver.
   *
   * Derivada do texto em vez de guardada: o usuário pode digitar "pizzaria" à
   * mão, sem clicar no chip, e ainda assim merece o placeholder e o estilo
   * sugeridos. Guardar a escolha perderia esse caso.
   */
  const nicheSuggestion = computed<NicheSuggestion | null>(() => {
    const slug = slugify(draft.value.niche)
    if (!slug) return null
    return NICHE_SUGGESTIONS.find(item => slugify(item.label) === slug) ?? null
  })

  /** Enquanto for `false`, o estilo ainda é palpite nosso e pode ser trocado. */
  const styleTouched = ref(false)

  function setStyle(style: StyleId) {
    draft.value.style = style
    styleTouched.value = true
  }

  /** Chip de nicho clicado: preenche o campo e, se couber, o estilo. */
  function applyNiche(suggestion: NicheSuggestion) {
    draft.value.niche = suggestion.label
    if (!styleTouched.value) draft.value.style = suggestion.suggestedStyle
  }

  function toggleNetwork(network: SocialNetwork) {
    const current = draft.value.networks
    draft.value.networks = current.includes(network)
      ? current.filter(n => n !== network)
      : [...current, network]
  }

  // -------------------------------------------------------------------------
  // Custo
  // -------------------------------------------------------------------------

  const creditCost = creditCostFor()

  // -------------------------------------------------------------------------
  // Ciclo de vida do rascunho
  // -------------------------------------------------------------------------

  const isDirty = computed(() => {
    const base = emptyDraft()
    return (Object.keys(base) as (keyof GeneratorDraft)[]).some(
      key => JSON.stringify(draft.value[key]) !== JSON.stringify(base[key]),
    )
  })

  /** Resumo legível para a revisão final e para o cabeçalho do formulário. */
  const summary = computed(() => ({
    niche: draft.value.niche || '—',
    product: draft.value.product || '—',
    price: priceCents.value === null ? null : formatPriceCents(priceCents.value),
    networks: draft.value.networks.map(n => NETWORKS[n].label),
    format: FORMATS[draft.value.format],
    style: STYLES[draft.value.style],
    colors: draft.value.colors,
    hasLogo: Boolean(draft.value.logoPath),
  }))

  function reset() {
    draft.value = emptyDraft()
    stepIndex.value = 0
    styleTouched.value = false
    validated.value = { business: false, offer: false, style: false, brand: false }
  }

  /**
   * Preenche o rascunho a partir de uma geração existente ("gerar novamente"
   * e "duplicar", Etapa 9). O parentId preserva a linhagem no documento.
   */
  function hydrateFrom(source: GenerationInput, options: { parentId?: string | null } = {}) {
    draft.value = {
      ...emptyDraft(),
      niche: source.niche,
      product: source.product,
      description: source.description ?? '',
      priceInput: source.priceCents === null ? '' : formatPriceCents(source.priceCents),
      promotion: source.promotion ?? '',
      cta: source.cta ?? '',

      networks: [...source.networks],
      format: source.format,
      style: source.style,
      templateId: source.templateId,

      colors: [...source.colors],
      logoPath: source.logoPath,

      renderMode: source.renderMode,
      extraInstructions: source.extraInstructions ?? '',

      projectId: null,
      parentId: options.parentId ?? null,
    }
    stepIndex.value = 0
    // O estilo veio de uma geração real: é escolha, não palpite.
    styleTouched.value = true
    validated.value = { business: false, offer: false, style: false, brand: false }
  }

  /** Aplica os padrões de marca do perfil em um rascunho ainda intocado. */
  function applyBrandDefaults(brand: {
    colors: string[]
    logoPath: string | null
    defaultStyle: StyleId | null
  }) {
    if (!draft.value.colors.length && brand.colors.length) {
      draft.value.colors = [...brand.colors]
    }
    if (!draft.value.logoPath && brand.logoPath) {
      draft.value.logoPath = brand.logoPath
    }
    if (brand.defaultStyle && draft.value.style === emptyDraft().style) {
      draft.value.style = brand.defaultStyle
    }
  }

  return {
    draft,
    steps: GENERATOR_STEPS,
    stepIndex,
    currentStep,
    isFirstStep,
    isLastStep,

    input,
    priceCents,
    isValid,
    allErrors,
    visibleErrors,
    errorFor,
    isStepComplete,
    validateAll,

    goTo,
    next,
    back,

    availableFormats,
    nicheSuggestion,
    styleTouched,
    setStyle,
    applyNiche,
    toggleNetwork,
    creditCost,
    isDirty,
    summary,

    reset,
    hydrateFrom,
    applyBrandDefaults,
  }
})
