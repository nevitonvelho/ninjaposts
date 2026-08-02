<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    text: string
    label?: string
    copiedLabel?: string
    variant?: 'primary' | 'secondary' | 'ghost'
    size?: 'sm' | 'md' | 'lg' | 'icon'
    /** Também dispara um toast. Desligue quando houver vários botões juntos. */
    toast?: boolean
  }>(),
  { label: 'Copiar', copiedLabel: 'Copiado!', variant: 'secondary', size: 'md', toast: false },
)

// `copiedDuring` já cuida do timer de volta ao estado normal.
const { copy, copied, isSupported } = useClipboard({ copiedDuring: 2000, legacy: true })
const { success, error } = useToast()

async function onClick() {
  try {
    await copy(props.text)
    if (props.toast) success(props.copiedLabel)
  } catch {
    error('Não foi possível copiar. Selecione o texto e copie manualmente.')
  }
}
</script>

<template>
  <UiButton
    :variant="variant"
    :size="size"
    :disabled="!isSupported || !text"
    :aria-label="size === 'icon' ? label : undefined"
    @click="onClick"
  >
    <!-- Ícone com largura fixa: trocar copy↔check não pode mexer no layout. -->
    <Icon
      :name="copied ? 'lucide:check' : 'lucide:copy'"
      :class="cn('size-4 transition-colors duration-150', copied && 'text-success')"
    />
    <span v-if="size !== 'icon'">{{ copied ? copiedLabel : label }}</span>
  </UiButton>
</template>
