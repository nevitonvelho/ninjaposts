<script setup lang="ts">
// Import explícito em vez de `resolveComponent('NuxtLink')` no template:
// o resolver de runtime não enxerga o NuxtLink neste ponto e o Vue avisa
// "Failed to resolve component", renderizando um elemento vazio.
import { NuxtLink } from '#components'

withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg'; showText?: boolean; to?: string }>(), {
  size: 'md',
  showText: true,
})

const MARK = { sm: 'size-7 rounded-lg', md: 'size-9 rounded-xl', lg: 'size-11 rounded-xl' } as const
const TEXT = { sm: 'text-base', md: 'text-lg', lg: 'text-xl' } as const
const ICON = { sm: 'size-4', md: 'size-5', lg: 'size-6' } as const
</script>

<template>
  <component :is="to ? NuxtLink : 'span'" :to="to" class="inline-flex items-center gap-2.5">
    <span
      :class="
        cn(
          'grid place-items-center bg-gradient-to-br from-brand-600 to-info text-white shadow-soft',
          MARK[size],
        )
      "
    >
      <Icon name="lucide:sparkles" :class="ICON[size]" />
    </span>

    <span v-if="showText" :class="cn('font-semibold tracking-tight text-ink', TEXT[size])">
      CriaPosts
    </span>
  </component>
</template>
