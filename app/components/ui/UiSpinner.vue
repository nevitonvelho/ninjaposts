<script setup lang="ts">
type Size = 'xs' | 'sm' | 'md' | 'lg'

const props = withDefaults(defineProps<{ size?: Size; label?: string }>(), {
  size: 'md',
  label: 'Carregando',
})

const SIZES: Record<Size, string> = {
  xs: 'size-3 border',
  sm: 'size-4 border-2',
  md: 'size-5 border-2',
  lg: 'size-8 border-[3px]',
}
</script>

<template>
  <span
    role="status"
    :aria-label="label"
    :class="
      cn(
        'inline-block animate-spin rounded-full border-current border-t-transparent',
        SIZES[props.size],
      )
    "
  />
</template>
