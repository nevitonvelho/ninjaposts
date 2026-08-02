<script setup lang="ts">
import { NuxtLink } from '#components'

withDefaults(
  defineProps<{
    label: string
    value: string | number
    icon: string
    hint?: string
    to?: string
    tone?: 'neutral' | 'brand' | 'warning'
    loading?: boolean
  }>(),
  { tone: 'neutral' },
)

const TONES = {
  neutral: 'bg-muted text-ink-muted',
  brand: 'bg-brand-50 text-brand-600',
  warning: 'bg-warning-soft text-warning',
} as const
</script>

<template>
  <component
    :is="to ? NuxtLink : 'div'"
    :to="to"
    :class="
      cn(
        'surface-card block p-5',
        to &&
          'transition-[box-shadow,border-color] duration-200 ease-out-soft hover:border-line-strong hover:shadow-lifted',
      )
    "
  >
    <div class="flex items-start justify-between gap-3">
      <p class="text-sm text-ink-muted">{{ label }}</p>
      <span :class="cn('grid size-8 shrink-0 place-items-center rounded-lg', TONES[tone])">
        <Icon :name="icon" class="size-4" />
      </span>
    </div>

    <!-- Esqueleto com a altura final do número: sem isso o card encolhe e
         empurra o layout quando o dado chega. -->
    <UiSkeleton v-if="loading" shape="rect" height="2rem" class="mt-3 w-20" />
    <p v-else class="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{{ value }}</p>

    <p v-if="hint" class="mt-1 text-xs text-ink-subtle">{{ hint }}</p>
  </component>
</template>
