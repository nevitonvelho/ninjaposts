<script setup lang="ts">
withDefaults(
  defineProps<{
    icon?: string
    title: string
    description?: string
    compact?: boolean
  }>(),
  { icon: 'lucide:inbox' },
)
</script>

<template>
  <div :class="cn('flex flex-col items-center text-center', compact ? 'px-6 py-10' : 'px-6 py-16')">
    <div class="grid size-12 place-items-center rounded-xl border border-line bg-subtle">
      <Icon :name="icon" class="size-5 text-ink-subtle" />
    </div>

    <h3 class="mt-4 font-medium tracking-tight text-ink">{{ title }}</h3>
    <p v-if="description" class="mt-1.5 max-w-sm text-sm text-ink-muted">{{ description }}</p>

    <div v-if="$slots.default" class="mt-5">
      <slot />
    </div>
  </div>
</template>
