<script setup lang="ts">
/**
 * Renderiza o diálogo de confirmação pedido por `useDialog().confirm()`.
 * Montado uma única vez no layout — nenhuma página precisa saber que existe.
 */
const ui = useUiStore()

const state = computed(() => ui.confirmState)

const open = computed({
  get: () => state.value.open,
  // Fechar pelo Escape, pelo X ou pelo backdrop equivale a cancelar.
  set: (value) => {
    if (!value) ui.settleConfirm(false)
  },
})
</script>

<template>
  <UiModal v-model:open="open" size="sm" hide-close>
    <div class="flex gap-4">
      <div
        v-if="state.icon"
        :class="
          cn(
            'grid size-10 shrink-0 place-items-center rounded-full',
            state.tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-brand-50 text-brand-600',
          )
        "
      >
        <Icon :name="state.icon" class="size-5" />
      </div>

      <div class="min-w-0 space-y-1.5">
        <h2 class="font-medium tracking-tight text-ink">{{ state.title }}</h2>
        <p v-if="state.description" class="text-sm text-ink-muted">{{ state.description }}</p>
      </div>
    </div>

    <template #footer>
      <UiButton variant="secondary" @click="ui.settleConfirm(false)">
        {{ state.cancelLabel ?? 'Cancelar' }}
      </UiButton>
      <UiButton
        :variant="state.tone === 'danger' ? 'danger' : 'primary'"
        @click="ui.settleConfirm(true)"
      >
        {{ state.confirmLabel ?? 'Confirmar' }}
      </UiButton>
    </template>
  </UiModal>
</template>
