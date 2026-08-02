<script setup lang="ts">
import type { ToastTone } from '~/stores/ui'

const ui = useUiStore()

const TONES: Record<ToastTone, { icon: string; classes: string }> = {
  success: { icon: 'lucide:check-circle-2', classes: 'text-success' },
  error: { icon: 'lucide:alert-circle', classes: 'text-danger' },
  warning: { icon: 'lucide:alert-triangle', classes: 'text-warning' },
  info: { icon: 'lucide:info', classes: 'text-info' },
}
</script>

<template>
  <Teleport to="body">
    <!--
      `aria-live="polite"` no container, não em cada toast: a região precisa
      existir no DOM *antes* do conteúdo chegar, senão o leitor de tela não
      anuncia a inserção. Erros usam `assertive` no item.
    -->
    <div
      class="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:bottom-0 sm:items-end"
      role="region"
      aria-label="Notificações"
    >
      <TransitionGroup
        enter-active-class="transition duration-250 ease-spring"
        enter-from-class="opacity-0 translate-y-2 sm:translate-x-4 sm:translate-y-0"
        leave-active-class="transition duration-150 ease-out-soft absolute"
        leave-to-class="opacity-0 scale-95"
        move-class="transition duration-200 ease-out-soft"
      >
        <div
          v-for="toast in ui.toasts"
          :key="toast.id"
          :role="toast.tone === 'error' ? 'alert' : 'status'"
          :aria-live="toast.tone === 'error' ? 'assertive' : 'polite'"
          class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-line bg-canvas p-4 shadow-lifted"
        >
          <Icon
            :name="TONES[toast.tone].icon"
            :class="cn('mt-0.5 size-5 shrink-0', TONES[toast.tone].classes)"
          />

          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-ink">{{ toast.title }}</p>
            <p v-if="toast.description" class="mt-0.5 text-sm text-ink-muted">
              {{ toast.description }}
            </p>

            <button
              v-if="toast.action"
              type="button"
              class="mt-2 text-sm font-medium text-brand-600 underline-offset-4 hover:underline"
              @click="toast.action.onClick(); ui.dismissToast(toast.id)"
            >
              {{ toast.action.label }}
            </button>
          </div>

          <button
            type="button"
            class="-mt-1 -mr-1 shrink-0 rounded-md p-1 text-ink-subtle transition-colors hover:bg-muted hover:text-ink"
            aria-label="Fechar notificação"
            @click="ui.dismissToast(toast.id)"
          >
            <Icon name="lucide:x" class="size-4" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
