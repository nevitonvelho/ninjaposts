<script setup lang="ts">
withDefaults(defineProps<{ label?: string }>(), { label: 'ou' })
</script>

<template>
  <div class="flex items-center gap-3" role="separator">
    <span class="h-px flex-1 bg-line" />
    <span class="text-xs font-medium tracking-wide text-ink-subtle uppercase">{{ label }}</span>
    <span class="h-px flex-1 bg-line" />
  </div>
</template>
