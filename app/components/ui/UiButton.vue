<script setup lang="ts">
import { NuxtLink } from '#components'

/**
 * Variantes como mapas de lookup, não como uma dependência tipo `cva`.
 * São 5 variantes e 4 tamanhos — um objeto resolve, é tipado de graça pelo
 * TypeScript e não adiciona 3KB ao bundle.
 */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    size?: Size
    loading?: boolean
    disabled?: boolean
    block?: boolean
    icon?: string
    iconRight?: string
    type?: 'button' | 'submit' | 'reset'
    /** Presente = renderiza `<NuxtLink>` em vez de `<button>`. */
    to?: string
    href?: string
  }>(),
  { variant: 'primary', size: 'md', type: 'button' },
)

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white shadow-soft hover:bg-brand-700 active:bg-brand-800 focus-visible:outline-brand-600',
  secondary:
    'bg-canvas text-ink border border-line shadow-soft hover:bg-subtle hover:border-line-strong active:bg-muted',
  ghost: 'text-ink-muted hover:bg-muted hover:text-ink active:bg-inset',
  danger: 'bg-danger text-white shadow-soft hover:brightness-110 active:brightness-95',
  link: 'text-brand-600 hover:text-brand-700 hover:underline underline-offset-4',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-md',
  lg: 'h-12 px-6 text-base gap-2 rounded-lg',
  icon: 'size-10 rounded-md',
}

const isDisabled = computed(() => props.disabled || props.loading)

const classes = computed(() =>
  cn(
    'relative inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap',
    'transition-[background-color,border-color,color,box-shadow,filter] duration-150 ease-out-soft',
    'disabled:pointer-events-none disabled:opacity-50',
    props.variant === 'link' ? 'h-auto p-0' : SIZES[props.size],
    VARIANTS[props.variant],
    props.block && 'w-full',
  ),
)

const component = computed(() => (props.to || props.href ? NuxtLink : 'button'))
</script>

<template>
  <component
    :is="component"
    :to="to"
    :href="href"
    :type="to || href ? undefined : type"
    :disabled="to || href ? undefined : isDisabled"
    :aria-disabled="isDisabled || undefined"
    :aria-busy="loading || undefined"
    :class="classes"
  >
    <!--
      O conteúdo some visualmente mas continua ocupando espaço durante o loading.
      Trocar o texto pelo spinner faria o botão mudar de largura e o cursor do
      usuário cair fora do alvo no meio do clique.
    -->
    <span
      v-if="loading"
      class="absolute inset-0 grid place-items-center"
      aria-hidden="true"
    >
      <UiSpinner :size="size === 'lg' ? 'md' : 'sm'" />
    </span>

    <span
      :class="cn('inline-flex items-center', SIZES[size].includes('gap') && 'gap-2', loading && 'invisible')"
    >
      <Icon v-if="icon" :name="icon" :class="size === 'sm' ? 'size-4' : 'size-[1.125rem]'" />
      <slot />
      <Icon v-if="iconRight" :name="iconRight" :class="size === 'sm' ? 'size-4' : 'size-[1.125rem]'" />
    </span>
  </component>
</template>
