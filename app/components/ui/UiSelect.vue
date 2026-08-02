<script setup lang="ts">
export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    id?: string
    options: SelectOption[]
    placeholder?: string
    disabled?: boolean
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { size: 'md' },
)

const model = defineModel<string | null>()
const { id, describedBy, invalid, required } = useFormField(props)

const SIZES = { sm: 'h-8 text-sm', md: 'h-10 text-sm', lg: 'h-12 text-base' } as const
</script>

<template>
  <!--
    `<select>` nativo de propósito. Um dropdown custom só se justifica quando há
    busca, ícone por opção ou multi-seleção — para escolha simples, o nativo
    ganha em teclado, leitor de tela e, principalmente, no mobile, onde abre o
    seletor do sistema.
  -->
  <div class="relative">
    <select
      :id="id"
      v-model="model"
      :disabled="disabled"
      :required="required"
      :aria-invalid="invalid || undefined"
      :aria-describedby="describedBy"
      :class="
        cn(
          'w-full appearance-none rounded-md border bg-canvas pr-9 pl-3 text-ink shadow-soft',
          'transition-[border-color,box-shadow] duration-150 ease-out-soft',
          'focus:outline-none focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:bg-muted disabled:text-ink-subtle',
          SIZES[props.size],
          !model && 'text-ink-subtle',
          invalid
            ? 'border-danger focus:border-danger focus:ring-2 focus:ring-danger/25'
            : 'border-line focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25',
        )
      "
    >
      <option v-if="placeholder" value="" disabled :selected="!model">{{ placeholder }}</option>
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </option>
    </select>

    <Icon
      name="lucide:chevron-down"
      class="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-subtle"
    />
  </div>
</template>
