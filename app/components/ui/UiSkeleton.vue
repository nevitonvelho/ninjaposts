<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Número de linhas — a última sai mais curta, como texto real. */
    lines?: number
    shape?: 'text' | 'rect' | 'circle'
    height?: string
  }>(),
  { lines: 1, shape: 'text' },
)
</script>

<template>
  <!--
    `aria-hidden`: o esqueleto é ruído para leitor de tela. Quem anuncia o
    carregamento é o container, com `aria-busy`.
  -->
  <div v-if="shape === 'text'" class="space-y-2" aria-hidden="true">
    <div
      v-for="line in lines"
      :key="line"
      class="skeleton-shimmer h-4 rounded-sm"
      :class="line === lines && lines > 1 ? 'w-3/5' : 'w-full'"
    />
  </div>

  <div
    v-else
    aria-hidden="true"
    :class="cn('skeleton-shimmer', shape === 'circle' ? 'rounded-full' : 'rounded-lg')"
    :style="{ height }"
  />
</template>
