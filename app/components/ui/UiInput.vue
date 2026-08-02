<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    id?: string
    type?: string
    placeholder?: string
    disabled?: boolean
    readonly?: boolean
    icon?: string
    /** Texto fixo à esquerda, ex.: `R$`. */
    prefix?: string
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { type: 'text', size: 'md' },
)

// `defineModel` (Vue 3.4+) elimina o par prop/emit e o boilerplate de update.
const model = defineModel<string | number | null>()

const { id, describedBy, invalid, required } = useFormField(props)

/**
 * O componente tem um wrapper (para o ícone), então o fallthrough padrão
 * mandaria `autocomplete`, `inputmode` e `aria-label` para a `<div>` — onde não
 * fazem nada. Separamos: layout (`class`/`style`) fica no wrapper, todo o resto
 * vai para o `<input>`, que é quem o navegador e o leitor de tela leem.
 */
defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const wrapperAttrs = computed(() => ({ class: attrs.class, style: attrs.style }))
const inputAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})

const SIZES = {
  sm: 'h-8 text-sm',
  md: 'h-10 text-sm',
  lg: 'h-12 text-base',
} as const
</script>

<template>
  <div v-bind="wrapperAttrs" class="relative">
    <Icon
      v-if="icon"
      :name="icon"
      class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle"
    />
    <span
      v-else-if="prefix"
      class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-subtle"
    >
      {{ prefix }}
    </span>

    <input
      :id="id"
      v-bind="inputAttrs"
      v-model="model"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :required="required"
      :aria-invalid="invalid || undefined"
      :aria-describedby="describedBy"
      :class="
        cn(
          'w-full rounded-md border bg-canvas px-3 text-ink shadow-soft',
          'placeholder:text-ink-subtle',
          'transition-[border-color,box-shadow] duration-150 ease-out-soft',
          'focus:outline-none focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:bg-muted disabled:text-ink-subtle',
          SIZES[size],
          (icon || prefix) && 'pl-9',
          invalid
            ? 'border-danger focus:border-danger focus:ring-2 focus:ring-danger/25'
            : 'border-line focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25',
        )
      "
    >
  </div>
</template>
