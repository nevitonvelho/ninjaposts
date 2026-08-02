<script setup lang="ts">
import { FORMATS, NETWORK_LIST } from '#shared/constants'
import type { SocialNetwork } from '#shared/types/generation'

/**
 * Escolha de redes (múltipla). A rede não é decoração: ela define os formatos
 * possíveis e o limite de legenda mais adiante. Por isso mostramos, em cada
 * card, o formato padrão daquela rede — a consequência da escolha fica visível
 * antes de o usuário avançar.
 */

const model = defineModel<SocialNetwork[]>({ required: true })

function toggle(id: SocialNetwork) {
  model.value = model.value.includes(id)
    ? model.value.filter(n => n !== id)
    : [...model.value, id]
}
</script>

<template>
  <div role="group" aria-label="Redes sociais" class="grid grid-cols-2 gap-3 sm:grid-cols-3">
    <button
      v-for="network in NETWORK_LIST"
      :key="network.id"
      type="button"
      :aria-pressed="model.includes(network.id)"
      :class="
        cn(
          'flex items-start gap-3 rounded-lg border p-3 text-left',
          'transition-[border-color,background-color,box-shadow] duration-150 ease-out-soft',
          'focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2',
          model.includes(network.id)
            ? 'border-brand-500 bg-brand-50 shadow-soft'
            : 'border-line bg-canvas hover:border-line-strong hover:bg-subtle',
        )
      "
      @click="toggle(network.id)"
    >
      <Icon
        :name="network.icon"
        :class="cn('mt-0.5 size-5 shrink-0', model.includes(network.id) ? 'text-brand-600' : 'text-ink-subtle')"
      />
      <span class="min-w-0">
        <span class="block truncate text-sm font-medium text-ink">{{ network.label }}</span>
        <span class="block text-xs text-ink-subtle">
          {{ FORMATS[network.defaultFormat].ratio }} por padrão
        </span>
      </span>
    </button>
  </div>
</template>
