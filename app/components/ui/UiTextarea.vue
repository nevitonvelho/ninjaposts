<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    id?: string
    placeholder?: string
    disabled?: boolean
    rows?: number
    /** Cresce com o conteúdo em vez de rolar. */
    autoresize?: boolean
    maxHeight?: number
  }>(),
  { rows: 4, maxHeight: 320 },
)

const model = defineModel<string | null>()
const { id, describedBy, invalid, required } = useFormField(props)

const el = ref<HTMLTextAreaElement>()

function resize() {
  const node = el.value
  if (!node || !props.autoresize) return
  node.style.height = 'auto'
  node.style.height = `${Math.min(node.scrollHeight, props.maxHeight)}px`
}

// Reage ao valor, não só ao input: preenchimento programático (duplicar um post,
// restaurar rascunho) também precisa reajustar a altura.
watch(model, () => nextTick(resize), { immediate: true })
onMounted(resize)
</script>

<template>
  <textarea
    :id="id"
    ref="el"
    v-model="model"
    :rows="rows"
    :placeholder="placeholder"
    :disabled="disabled"
    :required="required"
    :aria-invalid="invalid || undefined"
    :aria-describedby="describedBy"
    :class="
      cn(
        'w-full rounded-md border bg-canvas px-3 py-2.5 text-sm text-ink shadow-soft',
        'placeholder:text-ink-subtle',
        'transition-[border-color,box-shadow] duration-150 ease-out-soft',
        'focus:outline-none focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:bg-muted disabled:text-ink-subtle',
        autoresize ? 'resize-none overflow-y-auto' : 'resize-y',
        invalid
          ? 'border-danger focus:border-danger focus:ring-2 focus:ring-danger/25'
          : 'border-line focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25',
      )
    "
    @input="resize"
  />
</template>
