<script setup lang="ts">
import { BRAND_PALETTES, INPUT_LIMITS } from '#shared/constants'
import type { PaletteSpec } from '#shared/constants'

/**
 * Cores da marca, com leitura de contraste.
 *
 * O aviso de contraste não bloqueia nada: a cor da marca é da marca. Mas é a
 * diferença entre o usuário descobrir que o preço ficou ilegível agora ou
 * depois de gastar um crédito.
 */

const model = defineModel<string[]>({ required: true })

const MAX = INPUT_LIMITS.colors.max
const DEFAULT_COLOR = '#7c3aed'

/**
 * Texto do campo hex por linha, separado do modelo.
 *
 * Enquanto o usuário digita "#7c3", o valor é inválido — e escrever isso no
 * rascunho faria o formulário acusar erro a cada tecla. O modelo só recebe
 * cores já normalizadas.
 */
const raw = ref<string[]>([])

watch(
  model,
  (colors) => {
    raw.value = colors.map((color, index) => {
      // Preserva o que está sendo digitado se a cor não mudou por fora.
      const current = raw.value[index]
      return current && normalizeHex(current) === color ? current : color
    })
  },
  { immediate: true, deep: true },
)

const canAdd = computed(() => model.value.length < MAX)

function add() {
  if (!canAdd.value) return
  model.value = [...model.value, DEFAULT_COLOR]
}

function removeAt(index: number) {
  model.value = model.value.filter((_, i) => i !== index)
}

function setAt(index: number, value: string) {
  const hex = normalizeHex(value)
  if (!hex) return
  model.value = model.value.map((color, i) => (i === index ? hex : color))
}

function onRawInput(index: number, value: string) {
  raw.value = raw.value.map((text, i) => (i === index ? value : text))
  setAt(index, value)
}

function applyPalette(palette: PaletteSpec) {
  model.value = palette.colors.slice(0, MAX)
}

const readability = computed(() => model.value.map(color => checkReadability(color)))

/** Um aviso por vez: repetir "contraste baixo" em três linhas vira ruído. */
const firstWarning = computed(() => {
  const index = readability.value.findIndex(item => item.warning)
  if (index === -1) return null
  return { index, message: readability.value[index]!.warning! }
})
</script>

<template>
  <div class="space-y-4">
    <ul v-if="model.length" class="space-y-2">
      <li v-for="(color, index) in model" :key="`${index}-${color}`" class="flex items-center gap-2">
        <!--
          `<input type="color">` nativo: abre o seletor do sistema operacional,
          com conta-gotas e histórico de cores de graça.
        -->
        <label
          class="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-md border border-line shadow-soft"
          :style="{ backgroundColor: color }"
        >
          <span class="sr-only">Cor {{ index + 1 }}</span>
          <input
            type="color"
            :value="color"
            class="absolute inset-0 cursor-pointer opacity-0"
            @input="setAt(index, ($event.target as HTMLInputElement).value)"
          >
        </label>

        <UiInput
          :model-value="raw[index] ?? color"
          class="flex-1"
          size="sm"
          :aria-label="`Código hexadecimal da cor ${index + 1}`"
          spellcheck="false"
          @update:model-value="onRawInput(index, String($event ?? ''))"
        />

        <UiBadge v-if="index === 0" tone="brand" size="sm">Principal</UiBadge>

        <UiButton
          variant="ghost"
          size="icon"
          icon="lucide:x"
          :aria-label="`Remover cor ${index + 1}`"
          @click="removeAt(index)"
        />
      </li>
    </ul>

    <p v-else class="rounded-lg border border-dashed border-line bg-subtle p-4 text-sm text-ink-muted">
      Nenhuma cor definida — a IA escolhe uma paleta que combine com o estilo escolhido.
    </p>

    <p v-if="firstWarning" class="flex items-start gap-2 text-sm text-warning">
      <Icon name="lucide:alert-triangle" class="mt-0.5 size-4 shrink-0" />
      <span>Cor {{ firstWarning.index + 1 }}: {{ firstWarning.message }}</span>
    </p>

    <div class="flex flex-wrap items-center gap-2">
      <UiButton
        variant="secondary"
        size="sm"
        icon="lucide:plus"
        :disabled="!canAdd"
        @click="add"
      >
        Adicionar cor
      </UiButton>
      <UiButton
        v-if="model.length"
        variant="ghost"
        size="sm"
        icon="lucide:eraser"
        @click="model = []"
      >
        Limpar
      </UiButton>
      <span class="text-xs text-ink-subtle">Até {{ MAX }} cores</span>
    </div>

    <div class="space-y-2">
      <p class="text-xs text-ink-subtle">Paletas prontas</p>
      <ul class="flex flex-wrap gap-2">
        <li v-for="palette in BRAND_PALETTES" :key="palette.id">
          <button
            type="button"
            class="flex items-center gap-2 rounded-full border border-line bg-canvas py-1 pr-3 pl-1.5 text-xs font-medium text-ink-muted transition-colors duration-150 ease-out-soft hover:border-line-strong hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2"
            @click="applyPalette(palette)"
          >
            <span class="flex" aria-hidden="true">
              <span
                v-for="color in palette.colors"
                :key="color"
                class="size-4 rounded-full border border-canvas -ml-1 first:ml-0"
                :style="{ backgroundColor: color }"
              />
            </span>
            {{ palette.label }}
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
