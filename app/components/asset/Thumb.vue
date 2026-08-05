<script setup lang="ts">
/**
 * Miniatura de um asset a partir do caminho no Storage.
 *
 * Componente próprio porque `useStorageUrl` é por instância: chamado dentro de
 * um `v-for` no componente pai, o `watchEffect` de um item sobrescreveria o
 * estado do outro. Um componente por item dá a cada um o próprio escopo.
 */
const props = defineProps<{ path: string; label: string }>()

const { url, pending } = useStorageUrl(() => props.path)
</script>

<template>
  <div class="grid aspect-square place-items-center overflow-hidden border-b border-line bg-checkerboard">
    <UiSpinner v-if="pending" size="sm" class="text-ink-subtle" />
    <img
      v-else-if="url"
      :src="url"
      :alt="label"
      loading="lazy"
      class="size-full object-contain"
    >
    <Icon v-else name="lucide:image-off" class="size-6 text-ink-subtle" />
  </div>
</template>
