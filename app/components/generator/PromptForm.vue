<script setup lang="ts">
import type { CreateGenerationBody } from '#shared/types/api'
// Import explícito em vez de auto-import: `<component :is>` precisa da
// referência real, e assim o TypeScript confere os três nomes no build.
import PromptStepPost from './PromptStepPost.vue'
import PromptStepArt from './PromptStepArt.vue'
import PromptStepReview from './PromptStepReview.vue'

/**
 * Orquestra o wizard: navegação, validação por etapa, custo e envio.
 *
 * A criação do job em si não mora aqui — o formulário emite um payload já
 * validado e quem chama decide o que fazer com ele. Isso mantém o componente
 * testável sem rede e deixa a troca para a API real (Etapa 7) em um só lugar.
 */

const props = defineProps<{ submitting?: boolean }>()

const emit = defineEmits<{ submit: [payload: CreateGenerationBody] }>()

const generator = useGeneratorStore()
const { draft } = storeToRefs(generator)
const { balance, ready, cost, canGenerate, blockMessage } = useCredits()
const { confirm } = useDialog()
const toast = useToast()

const STEP_COMPONENTS = {
  post: PromptStepPost,
  arte: PromptStepArt,
  revisao: PromptStepReview,
} as const

const blocked = computed(() => !canGenerate.value)

/** Aviso de rascunho recuperado — só na montagem, e só se havia algo salvo. */
const restored = ref(false)
onMounted(() => {
  restored.value = generator.isDirty && generator.stepIndex === 0 && Boolean(draft.value.product)
})

function onNext() {
  if (!generator.next()) {
    toast.warning('Revise os campos destacados para continuar.')
  }
}

function onSubmit() {
  if (props.submitting) return

  if (!generator.validateAll()) {
    toast.warning('Alguns campos precisam de atenção antes de gerar.')
    return
  }
  if (blocked.value) {
    toast.error(blockMessage.value ?? 'Não é possível gerar agora.')
    return
  }

  const input = generator.input
  if (!input) return

  emit('submit', {
    input,
    projectId: draft.value.projectId,
    parentId: draft.value.parentId,
  })
}

async function onClear() {
  const ok = await confirm({
    title: 'Limpar o formulário?',
    description: 'Tudo que você preencheu neste rascunho será apagado.',
    confirmLabel: 'Limpar',
    tone: 'danger',
    icon: 'lucide:eraser',
  })
  if (!ok) return

  generator.reset()
  restored.value = false
  toast.info('Formulário limpo.')
}
</script>

<template>
  <form class="space-y-6" @submit.prevent="onSubmit">
    <!-- Stepper -->
    <ol class="flex items-center gap-1 overflow-x-auto pb-1">
      <li v-for="(step, index) in generator.steps" :key="step.id" class="flex items-center gap-1">
        <button
          type="button"
          :aria-current="index === generator.stepIndex ? 'step' : undefined"
          :class="
            cn(
              'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm whitespace-nowrap',
              'transition-colors duration-150 ease-out-soft',
              'focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2',
              index === generator.stepIndex
                ? 'bg-brand-50 font-medium text-brand-700'
                : 'text-ink-muted hover:bg-muted hover:text-ink',
            )
          "
          @click="generator.goTo(index)"
        >
          <span
            :class="
              cn(
                'grid size-5 shrink-0 place-items-center rounded-full text-xs font-semibold',
                index === generator.stepIndex
                  ? 'bg-brand-600 text-white'
                  : generator.isStepComplete(step.id)
                    ? 'bg-success-soft text-success'
                    : 'bg-muted text-ink-subtle',
              )
            "
          >
            <Icon
              v-if="generator.isStepComplete(step.id) && index !== generator.stepIndex"
              name="lucide:check"
              class="size-3"
            />
            <template v-else>{{ index + 1 }}</template>
          </span>
          {{ step.label }}
        </button>

        <span
          v-if="index < generator.steps.length - 1"
          class="h-px w-4 shrink-0 bg-line"
          aria-hidden="true"
        />
      </li>
    </ol>

    <div
      v-if="restored"
      class="flex items-center gap-3 rounded-lg border border-line bg-subtle p-3 text-sm"
    >
      <Icon name="lucide:history" class="size-4 shrink-0 text-ink-subtle" />
      <p class="flex-1 text-ink-muted">Recuperamos o rascunho que você tinha começado.</p>
      <UiButton variant="ghost" size="sm" @click="restored = false">Ok</UiButton>
    </div>

    <UiCard>
      <template #header>
        <div class="flex items-start gap-3">
          <span class="grid size-9 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-600">
            <Icon :name="generator.currentStep.icon" class="size-5" />
          </span>
          <div>
            <h2 class="font-medium tracking-tight text-ink">{{ generator.currentStep.title }}</h2>
            <p class="mt-0.5 text-sm text-ink-muted">{{ generator.currentStep.description }}</p>
          </div>
        </div>
      </template>

      <!--
        `<KeepAlive>` mantém cada etapa montada: sem ele, voltar remonta o passo
        e perde estado local que não vive no store — o texto pela metade no
        campo hexadecimal, o arquivo escolhido mas ainda não enviado.
      -->
      <KeepAlive>
        <component :is="STEP_COMPONENTS[generator.currentStep.id]" :key="generator.currentStep.id" />
      </KeepAlive>
    </UiCard>

    <!-- Rodapé de ações -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <UiButton
          v-if="!generator.isFirstStep"
          variant="secondary"
          icon="lucide:arrow-left"
          :disabled="submitting"
          @click="generator.back()"
        >
          Voltar
        </UiButton>

        <UiButton
          v-if="generator.isDirty"
          variant="ghost"
          size="sm"
          icon="lucide:eraser"
          :disabled="submitting"
          @click="onClear"
        >
          Limpar
        </UiButton>
      </div>

      <div class="flex items-center gap-4">
        <p class="text-sm text-ink-muted">
          <span class="font-medium text-ink">{{ cost }}</span>
          {{ cost === 1 ? 'crédito' : 'créditos' }}
          <span class="text-ink-subtle">· saldo {{ ready ? balance : '—' }}</span>
        </p>

        <UiButton
          v-if="!generator.isLastStep"
          icon-right="lucide:arrow-right"
          @click="onNext"
        >
          Continuar
        </UiButton>

        <UiButton
          v-else
          type="submit"
          size="lg"
          icon="lucide:sparkles"
          :loading="submitting"
          :disabled="blocked || submitting"
        >
          Gerar arte
        </UiButton>
      </div>
    </div>

    <p
      v-if="generator.isLastStep && blockMessage"
      class="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning-soft p-3 text-sm text-ink-muted"
      role="status"
    >
      <Icon name="lucide:alert-triangle" class="mt-0.5 size-4 shrink-0 text-warning" />
      <span class="flex-1">{{ blockMessage }}</span>
      <NuxtLink
        to="/app/creditos"
        class="shrink-0 font-medium text-brand-600 underline-offset-4 hover:underline"
      >
        Comprar créditos
      </NuxtLink>
    </p>
  </form>
</template>
