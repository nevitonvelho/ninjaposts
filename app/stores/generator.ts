import {
  BUSINESS_FIELDS,
  FORMATS,
  MAX_CONTACT_ITEMS,
  NETWORKS,
  NICHE_SUGGESTIONS,
  STYLES,
  creditCostFor,
  defaultContactFields,
  formatsForNetworks,
  resolveContactItems,
  withBusinessInfo,
} from '#shared/constants'
import type { NicheSuggestion } from '#shared/constants'
import type {
  GenerationInput,
  PostFormat,
  RenderMode,
  SocialNetwork,
  StyleId,
} from '#shared/types/generation'
import type { BrandSettings, BusinessField } from '#shared/types/user'

/**
 * Rascunho do formulário de criação.
 *
 * É store e não composable porque o estado precisa sobreviver à navegação: o
 * usuário sai de `/app/criar` para comprar créditos, volta, e o que digitou
 * continua lá. Persistido em `localStorage` para sobreviver também ao refresh —
 * perder 6 campos preenchidos por um F5 acidental é o tipo de atrito que faz
 * alguém desistir antes da primeira arte.
 */

/**
 * Três etapas, não quatro.
 *
 * A etapa "Marca" existia para o usuário redigitar cores e logo a cada post.
 * Com isso guardado no perfil (§ `BrandSettings`), o que sobra não é um
 * formulário — é uma conferência: o que já está pronto, o que aparece na arte
 * e o botão de gerar. Fundir "Negócio" e "Oferta" segue o mesmo raciocínio:
 * são seis campos sobre o mesmo assunto, e quatro deles são opcionais.
 */
export type StepId = 'post' | 'arte' | 'revisao'

export interface StepSpec {
  id: StepId
  label: string
  title: string
  description: string
  icon: string
}

export const GENERATOR_STEPS: StepSpec[] = [
  {
    id: 'post',
    label: 'O post',
    title: 'O que você quer divulgar?',
    description: 'O produto e, se fizer sentido, o preço. É daqui que sai a direção de arte.',
    icon: 'lucide:store',
  },
  {
    id: 'arte',
    label: 'A arte',
    title: 'Onde publicar e com que cara',
    description: 'A rede define o formato; o estilo define a luz, a textura e a composição.',
    icon: 'lucide:palette',
  },
  {
    id: 'revisao',
    label: 'Revisão',
    title: 'O que aparece na arte',
    description: 'Sua marca e seus contatos, já prontos. Confira e gere.',
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
  post: ['niche', 'product', 'description', 'priceCents', 'promotion', 'cta'],
  arte: ['networks', 'format', 'style', 'templateId'],
  revisao: ['colors', 'logoPath', 'contactItems', 'renderMode', 'extraInstructions'],
}

const NO_STEP_VALIDATED: Record<StepId, boolean> = { post: false, arte: false, revisao: false }

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
  /**
   * Quais informações do perfil vão na arte — a **escolha**, não os valores.
   *
   * Guardar o telefone aqui congelaria no `localStorage` um número que o dono
   * pode ter corrigido no perfil ontem. O valor é resolvido na hora de montar
   * o input, sempre a partir do perfil vigente.
   */
  contactFields: BusinessField[]

  renderMode: RenderMode
  extraInstructions: string

  projectId: string | null
  parentId: string | null
}

/** A versão no nome invalida rascunhos antigos quando o formato do draft mudar. */
const DRAFT_KEY = 'ninjaposts:generator-draft:v2'

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
    contactFields: [],

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

  const auth = useAuthStore()

  const stepIndex = ref(0)
  /** Etapas em que já tentamos avançar — só nelas os erros aparecem. */
  const validated = ref<Record<StepId, boolean>>({ ...NO_STEP_VALIDATED })

  const currentStep = computed(() => GENERATOR_STEPS[stepIndex.value] ?? GENERATOR_STEPS[0]!)
  const isFirstStep = computed(() => stepIndex.value === 0)
  const isLastStep = computed(() => stepIndex.value === GENERATOR_STEPS.length - 1)

  // -------------------------------------------------------------------------
  // Conversão e validação
  // -------------------------------------------------------------------------

  const priceCents = computed(() => parsePriceToCents(draft.value.priceInput))

  // -------------------------------------------------------------------------
  // Informações do estabelecimento
  // -------------------------------------------------------------------------

  /** Dados do perfil, normalizados — conta antiga não tem o campo `business`. */
  const business = computed(() => withBusinessInfo(auth.userDoc?.brand?.business))

  /** Só o que o dono realmente preencheu no perfil pode ser oferecido aqui. */
  const availableContactFields = computed(() =>
    BUSINESS_FIELDS.filter(spec => business.value[spec.id]),
  )

  /** A seleção resolvida contra o perfil, já formatada para a arte. */
  const contactItems = computed(() =>
    resolveContactItems(business.value, draft.value.contactFields),
  )

  const contactSelectionFull = computed(() => contactItems.value.length >= MAX_CONTACT_ITEMS)

  function isContactSelected(field: BusinessField): boolean {
    return draft.value.contactFields.includes(field)
  }

  /** Desmarcar é sempre livre; marcar respeita o teto de legibilidade da peça. */
  function toggleContactField(field: BusinessField) {
    if (isContactSelected(field)) {
      draft.value.contactFields = draft.value.contactFields.filter(id => id !== field)
      return
    }
    if (contactSelectionFull.value) return
    draft.value.contactFields = [...draft.value.contactFields, field]
  }

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
    contactItems: contactItems.value,

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
    validated.value = { post: true, arte: true, revisao: true }
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
    contacts: contactItems.value,
  }))

  function reset() {
    draft.value = emptyDraft()
    stepIndex.value = 0
    styleTouched.value = false
    validated.value = { ...NO_STEP_VALIDATED }
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
      /**
       * Recupera a *escolha*, não os valores gravados na geração antiga: se o
       * telefone mudou desde então, o post novo sai com o número certo.
       */
      contactFields: source.contactItems.map(item => item.field),

      renderMode: source.renderMode,
      extraInstructions: source.extraInstructions ?? '',

      projectId: null,
      parentId: options.parentId ?? null,
    }
    stepIndex.value = 0
    // O estilo veio de uma geração real: é escolha, não palpite.
    styleTouched.value = true
    validated.value = { ...NO_STEP_VALIDATED }
  }

  /**
   * Aplica os padrões do perfil em um rascunho ainda intocado.
   *
   * Cada campo só é preenchido se estiver vazio: reaplicar por cima desfaria
   * escolha do usuário — quem apagou as cores de propósito e deu F5 as veria
   * voltar sozinhas.
   */
  function applyBrandDefaults(brand: Partial<BrandSettings>) {
    if (!draft.value.colors.length && brand.colors?.length) {
      draft.value.colors = [...brand.colors]
    }
    if (!draft.value.logoPath && brand.logoPath) {
      draft.value.logoPath = brand.logoPath
    }
    if (brand.defaultStyle && draft.value.style === emptyDraft().style) {
      draft.value.style = brand.defaultStyle
    }
    if (!draft.value.contactFields.length) {
      draft.value.contactFields = defaultContactFields(brand.business)
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

    business,
    availableContactFields,
    contactItems,
    contactSelectionFull,
    isContactSelected,
    toggleContactField,

    creditCost,
    isDirty,
    summary,

    reset,
    hydrateFrom,
    applyBrandDefaults,
  }
})
