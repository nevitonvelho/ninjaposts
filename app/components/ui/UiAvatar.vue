<script setup lang="ts">
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const props = withDefaults(defineProps<{ src?: string | null; name?: string; size?: Size }>(), {
  size: 'md',
  name: '',
})

const SIZES: Record<Size, string> = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-16 text-xl',
}

// Falha de carregamento cai para as iniciais em vez de deixar um quadrado quebrado.
const failed = ref(false)
watch(() => props.src, () => (failed.value = false))

const showImage = computed(() => Boolean(props.src) && !failed.value)
</script>

<template>
  <span
    :class="
      cn(
        'inline-grid shrink-0 place-items-center overflow-hidden rounded-full',
        'border border-line bg-brand-50 font-medium text-brand-700 select-none',
        SIZES[props.size],
      )
    "
  >
    <img
      v-if="showImage"
      :src="src!"
      :alt="name ? `Foto de ${name}` : ''"
      class="size-full object-cover"
      loading="lazy"
      @error="failed = true"
    >
    <span v-else aria-hidden="true">{{ initialsOf(name) }}</span>
  </span>
</template>
