<script setup lang="ts">
type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'

withDefaults(
  defineProps<{
    tone?: Tone
    icon?: string
    /** Ponto colorido à esquerda — bom para status em tabela. */
    dot?: boolean
    size?: 'sm' | 'md'
  }>(),
  { tone: 'neutral', size: 'md' },
)

const TONES: Record<Tone, string> = {
  neutral: 'bg-muted text-ink-muted border-line',
  brand: 'bg-brand-50 text-brand-700 border-brand-100',
  success: 'bg-success-soft text-success border-success/20',
  warning: 'bg-warning-soft text-warning border-warning/20',
  danger: 'bg-danger-soft text-danger border-danger/20',
  info: 'bg-info-soft text-info border-info/20',
}

const DOTS: Record<Tone, string> = {
  neutral: 'bg-ink-subtle',
  brand: 'bg-brand-500',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
}
</script>

<template>
  <span
    :class="
      cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        TONES[tone],
      )
    "
  >
    <span v-if="dot" :class="cn('size-1.5 rounded-full', DOTS[tone])" aria-hidden="true" />
    <Icon v-if="icon" :name="icon" class="size-3.5" />
    <slot />
  </span>
</template>
