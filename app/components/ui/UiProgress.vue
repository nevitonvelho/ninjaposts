<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    /** 0–100. */
    value?: number
    /** Sem valor definido — barra em movimento contínuo. */
    indeterminate?: boolean
    label?: string
    size?: 'sm' | 'md'
    tone?: 'brand' | 'success' | 'danger'
  }>(),
  { value: 0, size: 'md', tone: 'brand' },
)

const clamped = computed(() => Math.min(100, Math.max(0, props.value)))

const TONES = {
  brand: 'bg-brand-600',
  success: 'bg-success',
  danger: 'bg-danger',
} as const
</script>

<template>
  <div
    role="progressbar"
    :aria-valuenow="indeterminate ? undefined : clamped"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-label="label"
    :class="
      cn('w-full overflow-hidden rounded-full bg-muted', size === 'sm' ? 'h-1.5' : 'h-2')
    "
  >
    <div
      :class="
        cn(
          'h-full rounded-full',
          TONES[tone],
          // 500ms: o progresso vem em saltos discretos entre etapas do job, e
          // uma transição longa faz o movimento parecer contínuo.
          indeterminate
            ? 'w-1/3 animate-[shimmer_1.2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-current to-transparent'
            : 'transition-[width] duration-500 ease-out-soft',
        )
      "
      :style="indeterminate ? undefined : { width: `${clamped}%` }"
    />
  </div>
</template>
