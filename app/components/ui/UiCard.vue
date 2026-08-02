<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
    description?: string
    /** Remove o padding interno — para cards que abrem com imagem sangrando na borda. */
    flush?: boolean
    /** Eleva no hover. Só use quando o card inteiro for clicável. */
    interactive?: boolean
    padding?: 'none' | 'sm' | 'md' | 'lg'
  }>(),
  { padding: 'md' },
)

const PADDING = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6 sm:p-8' } as const
</script>

<template>
  <div
    :class="
      cn(
        'surface-card overflow-hidden',
        interactive &&
          'cursor-pointer transition-[box-shadow,border-color,transform] duration-200 ease-out-soft hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lifted',
      )
    "
  >
    <div v-if="title || description || $slots.header" :class="cn(!flush && PADDING[padding], 'pb-0')">
      <slot name="header">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-1">
            <h3 v-if="title" class="font-medium tracking-tight text-ink">{{ title }}</h3>
            <p v-if="description" class="text-sm text-ink-muted">{{ description }}</p>
          </div>
          <slot name="actions" />
        </div>
      </slot>
    </div>

    <div :class="cn(!flush && PADDING[padding], (title || description || $slots.header) && !flush && 'pt-4')">
      <slot />
    </div>

    <div
      v-if="$slots.footer"
      :class="cn('border-t border-line bg-subtle', flush ? 'p-5' : PADDING[padding])"
    >
      <slot name="footer" />
    </div>
  </div>
</template>
