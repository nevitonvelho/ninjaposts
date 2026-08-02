<script setup lang="ts">
import { NICHE_SUGGESTIONS } from '#shared/constants'
import type { NicheSuggestion } from '#shared/constants'

/**
 * Campo de nicho: texto livre com sugestões clicáveis.
 *
 * Não é um combobox custom de propósito. Um listbox flutuante sobre um `<input>`
 * precisa de `aria-activedescendant`, navegação por setas, gestão de foco e
 * comportamento próprio no mobile — e entrega, no fim, a mesma coisa que um
 * campo normal com atalhos abaixo. Os chips ficam sempre visíveis, funcionam
 * com Tab e não escondem nada atrás de um popup.
 */

const model = defineModel<string>({ required: true })

const emit = defineEmits<{ select: [suggestion: NicheSuggestion] }>()

const VISIBLE = 8

const filtered = computed(() => {
  const term = slugify(model.value.trim())
  if (!term) return NICHE_SUGGESTIONS.slice(0, VISIBLE)

  return NICHE_SUGGESTIONS.filter((item) => {
    const slug = slugify(item.label)
    // Sugerir exatamente o que já está escrito é ruído.
    return slug !== term && slug.includes(term)
  }).slice(0, VISIBLE)
})

function choose(suggestion: NicheSuggestion) {
  model.value = suggestion.label
  emit('select', suggestion)
}
</script>

<template>
  <div class="space-y-3">
    <UiInput
      v-model="model"
      placeholder="Ex.: hamburgueria, barbearia, loja de roupas…"
      icon="lucide:search"
      autocomplete="organization"
    />

    <div v-if="filtered.length" class="space-y-2">
      <p class="text-xs text-ink-subtle">
        {{ model.trim() ? 'Sugestões parecidas' : 'Ou escolha um atalho' }}
      </p>

      <ul class="flex flex-wrap gap-2">
        <li v-for="suggestion in filtered" :key="suggestion.label">
          <button
            type="button"
            :class="
              cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium',
                'transition-colors duration-150 ease-out-soft',
                'focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2',
                model.trim().toLowerCase() === suggestion.label.toLowerCase()
                  ? 'border-brand-200 bg-brand-50 text-brand-700'
                  : 'border-line bg-canvas text-ink-muted hover:border-line-strong hover:bg-subtle hover:text-ink',
              )
            "
            @click="choose(suggestion)"
          >
            <Icon :name="suggestion.icon" class="size-3.5" />
            {{ suggestion.label }}
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
