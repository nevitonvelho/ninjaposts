<script setup lang="ts">
export interface TabItem {
  value: string
  label: string
  icon?: string
  badge?: string | number
  disabled?: boolean
}

const props = defineProps<{ items: TabItem[]; ariaLabel?: string }>()
const model = defineModel<string>({ required: true })

const baseId = useId()
const tabId = (value: string) => `${baseId}-tab-${value}`
const panelId = (value: string) => `${baseId}-panel-${value}`

const enabled = computed(() => props.items.filter(i => !i.disabled))

/**
 * Setas navegam entre as abas — comportamento esperado do padrão ARIA de tabs.
 * Sem isto, o Tab do teclado percorre cada aba uma a uma em vez de pular para
 * o conteúdo, que é o motivo de `tabindex="-1"` nas abas inativas.
 */
function onKeydown(event: KeyboardEvent) {
  const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End']
  if (!keys.includes(event.key)) return
  event.preventDefault()

  const list = enabled.value
  const current = list.findIndex(i => i.value === model.value)

  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? list.length - 1
        : event.key === 'ArrowRight'
          ? (current + 1) % list.length
          : (current - 1 + list.length) % list.length

  const target = list[next]
  if (!target) return
  model.value = target.value
  nextTick(() => document.getElementById(tabId(target.value))?.focus())
}
</script>

<template>
  <div>
    <div
      role="tablist"
      :aria-label="ariaLabel"
      class="flex gap-1 overflow-x-auto border-b border-line"
      @keydown="onKeydown"
    >
      <button
        v-for="item in items"
        :id="tabId(item.value)"
        :key="item.value"
        type="button"
        role="tab"
        :aria-selected="model === item.value"
        :aria-controls="panelId(item.value)"
        :tabindex="model === item.value ? 0 : -1"
        :disabled="item.disabled"
        :class="
          cn(
            'relative -mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap',
            'transition-colors duration-150 ease-out-soft',
            'disabled:cursor-not-allowed disabled:opacity-50',
            model === item.value
              ? 'border-brand-600 text-ink'
              : 'border-transparent text-ink-muted hover:border-line-strong hover:text-ink',
          )
        "
        @click="model = item.value"
      >
        <Icon v-if="item.icon" :name="item.icon" class="size-4" />
        {{ item.label }}
        <UiBadge v-if="item.badge !== undefined" size="sm">{{ item.badge }}</UiBadge>
      </button>
    </div>

    <div
      v-for="item in items"
      v-show="model === item.value"
      :id="panelId(item.value)"
      :key="item.value"
      role="tabpanel"
      :aria-labelledby="tabId(item.value)"
      tabindex="0"
      class="pt-5 focus-visible:outline-none"
    >
      <slot :name="item.value" :item="item" />
    </div>
  </div>
</template>
