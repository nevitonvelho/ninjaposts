<script setup lang="ts">
// Ver AppLogo.vue: `resolveComponent('NuxtLink')` no template não resolve.
import { NuxtLink } from '#components'

export interface DropdownItem {
  label: string
  icon?: string
  danger?: boolean
  disabled?: boolean
  onClick?: () => void
  to?: string
  /** Linha divisória acima deste item. */
  separated?: boolean
}

const props = withDefaults(
  defineProps<{
    items: DropdownItem[]
    align?: 'start' | 'end'
    label?: string
  }>(),
  { align: 'end', label: 'Abrir menu' },
)

const open = ref(false)
const root = ref<HTMLElement>()
const menu = ref<HTMLElement>()

onClickOutside(root, () => (open.value = false))

// Escape fecha e devolve o foco ao gatilho — sem isso o usuário de teclado
// fica preso navegando um menu invisível.
const trigger = ref<HTMLElement>()
function close(focusTrigger = true) {
  open.value = false
  if (focusTrigger) nextTick(() => trigger.value?.querySelector('button')?.focus())
}

onKeyStroke('Escape', () => {
  if (open.value) close()
})

function focusItem(index: number) {
  const nodes = menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')
  if (!nodes?.length) return
  const target = nodes[(index + nodes.length) % nodes.length]
  target?.focus()
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    open.value = true
    nextTick(() => focusItem(0))
  }
}

function onMenuKeydown(event: KeyboardEvent) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  event.preventDefault()

  const nodes = [...(menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])]
  const current = nodes.indexOf(document.activeElement as HTMLElement)
  focusItem(event.key === 'ArrowDown' ? current + 1 : current - 1)
}

function select(item: DropdownItem) {
  if (item.disabled) return
  item.onClick?.()
  close(false)
}
</script>

<template>
  <div ref="root" class="relative inline-block">
    <div ref="trigger" @keydown="onTriggerKeydown">
      <slot name="trigger" :open="open" :toggle="() => (open = !open)">
        <UiButton variant="secondary" size="icon" :aria-label="label" @click="open = !open">
          <Icon name="lucide:more-horizontal" class="size-4" />
        </UiButton>
      </slot>
    </div>

    <Transition
      enter-active-class="transition duration-150 ease-spring"
      enter-from-class="opacity-0 scale-95 -translate-y-1"
      leave-active-class="transition duration-100 ease-out-soft"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="open"
        ref="menu"
        role="menu"
        :class="
          cn(
            'absolute z-50 mt-1.5 min-w-52 origin-top overflow-hidden rounded-lg border border-line bg-canvas p-1 shadow-lifted',
            props.align === 'end' ? 'right-0' : 'left-0',
          )
        "
        @keydown="onMenuKeydown"
      >
        <template v-for="(item, index) in items" :key="index">
          <div v-if="item.separated" class="my-1 h-px bg-line" role="separator" />

          <component
            :is="item.to ? NuxtLink : 'button'"
            :to="item.to"
            :type="item.to ? undefined : 'button'"
            role="menuitem"
            :disabled="item.disabled || undefined"
            :class="
              cn(
                'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm',
                'transition-colors duration-100 focus-visible:outline-none',
                item.disabled && 'pointer-events-none opacity-50',
                item.danger
                  ? 'text-danger hover:bg-danger-soft focus:bg-danger-soft'
                  : 'text-ink-muted hover:bg-muted hover:text-ink focus:bg-muted focus:text-ink',
              )
            "
            @click="select(item)"
          >
            <Icon v-if="item.icon" :name="item.icon" class="size-4 shrink-0" />
            {{ item.label }}
          </component>
        </template>
      </div>
    </Transition>
  </div>
</template>
