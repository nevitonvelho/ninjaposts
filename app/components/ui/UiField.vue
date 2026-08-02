<script setup lang="ts">
import { FormFieldKey } from '~/composables/useFormField'

const props = withDefaults(
  defineProps<{
    label?: string
    hint?: string
    /** Aceita string única ou a lista vinda de `fieldErrors()` do Zod. */
    error?: string | string[] | null
    required?: boolean
    /** Contador de caracteres, ex.: quando há limite da rede social. */
    count?: number
    max?: number
  }>(),
  {},
)

const id = useId()
const hintId = `${id}-hint`
const errorId = `${id}-error`

const errorMessage = computed(() => {
  if (!props.error) return null
  return Array.isArray(props.error) ? (props.error[0] ?? null) : props.error
})

const invalid = computed(() => Boolean(errorMessage.value))

// Erro substitui a dica na descrição: anunciar os dois confunde o leitor de tela.
const describedBy = computed(() => {
  if (invalid.value) return errorId
  return props.hint ? hintId : undefined
})

provide(FormFieldKey, {
  id: computed(() => id),
  describedBy,
  invalid,
  required: computed(() => Boolean(props.required)),
})

const overLimit = computed(
  () => props.max !== undefined && props.count !== undefined && props.count > props.max,
)
</script>

<template>
  <div class="space-y-1.5">
    <div v-if="label || max !== undefined" class="flex items-baseline justify-between gap-3">
      <label v-if="label" :for="id" class="text-sm font-medium text-ink">
        {{ label }}
        <span v-if="required" class="text-danger" aria-hidden="true">*</span>
      </label>

      <span
        v-if="max !== undefined"
        :class="cn('text-xs tabular-nums', overLimit ? 'text-danger' : 'text-ink-subtle')"
      >
        {{ count ?? 0 }}/{{ max }}
      </span>
    </div>

    <slot />

    <!--
      `aria-live` no erro faz o leitor de tela anunciar a validação assim que
      ela aparece, sem o usuário precisar navegar de volta até o campo.
    -->
    <p v-if="errorMessage" :id="errorId" class="text-sm text-danger" role="alert" aria-live="polite">
      {{ errorMessage }}
    </p>
    <p v-else-if="hint" :id="hintId" class="text-sm text-ink-subtle">
      {{ hint }}
    </p>
  </div>
</template>
