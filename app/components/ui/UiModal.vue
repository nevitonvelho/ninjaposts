<script setup lang="ts">
type Size = 'sm' | 'md' | 'lg' | 'xl' | 'full'

const props = withDefaults(
  defineProps<{
    title?: string
    description?: string
    size?: Size
    /** Impede fechar por Escape ou clique fora — use em operação destrutiva em andamento. */
    persistent?: boolean
    hideClose?: boolean
  }>(),
  { size: 'md' },
)

const open = defineModel<boolean>('open', { default: false })

const dialog = ref<HTMLDialogElement>()
const closing = ref(false)
const titleId = useId()
const descriptionId = useId()

const SIZES: Record<Size, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[calc(100vw-2rem)]',
}

/**
 * `<dialog>` nativo em vez de um overlay próprio.
 *
 * Ele entrega de graça o que costuma sair errado à mão: prender o foco dentro
 * do modal, devolver o foco ao elemento de origem ao fechar, fechar no Escape,
 * tornar o resto da página inerte para leitores de tela e renderizar na
 * top-layer — acima de qualquer `z-index`, sem guerra de camadas.
 */
watch(open, async (value) => {
  await nextTick()
  const el = dialog.value
  if (!el) return

  if (value) {
    if (!el.open) el.showModal()
    closing.value = false
  } else if (el.open) {
    // Espera a animação de saída antes de tirar da top-layer.
    closing.value = true
    setTimeout(() => {
      el.close()
      closing.value = false
    }, 150)
  }
})

// O Escape fecha via API nativa, não pelo nosso `v-model` — este handler
// mantém o estado do Vue em sincronia com o que o navegador já fez.
function onNativeClose() {
  open.value = false
}

function onCancel(event: Event) {
  if (props.persistent) event.preventDefault()
}

/** Fecha só quando o clique começa e termina no backdrop. */
const pressedBackdrop = ref(false)

function onPointerDown(event: PointerEvent) {
  pressedBackdrop.value = event.target === dialog.value
}

function onPointerUp(event: PointerEvent) {
  if (!props.persistent && pressedBackdrop.value && event.target === dialog.value) {
    open.value = false
  }
  pressedBackdrop.value = false
}

// Impede a página de rolar atrás do modal.
watch(open, (value) => {
  if (import.meta.client) document.documentElement.classList.toggle('overflow-hidden', value)
})
onUnmounted(() => {
  if (import.meta.client) document.documentElement.classList.remove('overflow-hidden')
})
</script>

<template>
  <dialog
    ref="dialog"
    :aria-labelledby="title ? titleId : undefined"
    :aria-describedby="description ? descriptionId : undefined"
    class="ui-modal m-auto w-full rounded-xl border border-line bg-canvas p-0 text-ink shadow-lifted backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
    :class="[SIZES[size], closing && 'is-closing']"
    @close="onNativeClose"
    @cancel="onCancel"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
  >
    <!-- Wrapper interno: cliques aqui dentro nunca são confundidos com o backdrop. -->
    <div class="flex max-h-[85vh] flex-col">
      <header
        v-if="title || $slots.header || !hideClose"
        class="flex items-start justify-between gap-4 px-6 pt-6"
      >
        <div class="space-y-1">
          <h2 v-if="title" :id="titleId" class="text-lg font-medium tracking-tight">
            {{ title }}
          </h2>
          <p v-if="description" :id="descriptionId" class="text-sm text-ink-muted">
            {{ description }}
          </p>
          <slot name="header" />
        </div>

        <UiButton
          v-if="!hideClose"
          variant="ghost"
          size="icon"
          class="-mt-1 -mr-2 shrink-0"
          aria-label="Fechar"
          @click="open = false"
        >
          <Icon name="lucide:x" class="size-4" />
        </UiButton>
      </header>

      <div class="overflow-y-auto px-6 py-5">
        <slot />
      </div>

      <footer
        v-if="$slots.footer"
        class="flex items-center justify-end gap-2 border-t border-line bg-subtle px-6 py-4"
      >
        <slot name="footer" />
      </footer>
    </div>
  </dialog>
</template>

<style scoped>
.ui-modal[open] {
  animation: modal-in 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}

.ui-modal[open]::backdrop {
  animation: backdrop-in 0.2s ease-out;
}

.ui-modal.is-closing,
.ui-modal.is-closing::backdrop {
  animation: fade-out 0.15s ease-in forwards;
}

@keyframes modal-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
}

@keyframes backdrop-in {
  from {
    opacity: 0;
  }
}

@keyframes fade-out {
  to {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ui-modal[open],
  .ui-modal[open]::backdrop,
  .ui-modal.is-closing,
  .ui-modal.is-closing::backdrop {
    animation: none;
  }
}
</style>
