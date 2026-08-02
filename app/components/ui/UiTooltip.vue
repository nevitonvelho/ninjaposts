<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    text: string
    placement?: 'top' | 'bottom' | 'left' | 'right'
    delay?: number
  }>(),
  { placement: 'top', delay: 300 },
)

const visible = ref(false)
const id = useId()
let timer: ReturnType<typeof setTimeout> | undefined

function show() {
  clearTimeout(timer)
  timer = setTimeout(() => (visible.value = true), props.delay)
}

function hide() {
  clearTimeout(timer)
  visible.value = false
}

onUnmounted(() => clearTimeout(timer))

const POSITIONS = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
} as const
</script>

<template>
  <!--
    Foco também abre o tooltip, não só o hover: quem navega por teclado precisa
    da mesma informação que quem usa mouse.
  -->
  <span
    class="relative inline-flex"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
  >
    <slot :aria-describedby="id" />

    <Transition
      enter-active-class="transition duration-150 ease-out-soft"
      enter-from-class="opacity-0 scale-95"
      leave-active-class="transition duration-100"
      leave-to-class="opacity-0"
    >
      <span
        v-if="visible"
        :id="id"
        role="tooltip"
        :class="
          cn(
            'pointer-events-none absolute z-50 w-max max-w-56 rounded-md bg-ink px-2.5 py-1.5',
            'text-xs font-medium text-ink-inverse shadow-lifted',
            POSITIONS[placement],
          )
        "
      >
        {{ text }}
      </span>
    </Transition>
  </span>
</template>
