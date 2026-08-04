<script setup lang="ts">
import { BUSINESS_FIELDS, MAX_CONTACT_ITEMS } from '#shared/constants'
import type { BusinessInfo } from '#shared/types/user'

/**
 * Os dados do estabelecimento, digitados uma vez.
 *
 * Nenhum campo é obrigatório e nenhum aparece sozinho na arte: preencher aqui
 * é **ter disponível**, escolher na hora de gerar é o que imprime. A distinção
 * está escrita na tela porque, sem ela, ninguém preenche o endereço com medo de
 * carimbá-lo em todo post.
 */

const model = defineModel<BusinessInfo>({ required: true })

const filled = computed(() => BUSINESS_FIELDS.filter(spec => model.value[spec.id]?.trim()).length)

/** Pré-visualização da grafia final — é assim que o valor chega na arte. */
function preview(id: (typeof BUSINESS_FIELDS)[number]['id']): string | null {
  const raw = model.value[id]?.trim()
  if (!raw) return null
  const formatted = BUSINESS_FIELDS.find(spec => spec.id === id)!.format(raw)
  return formatted && formatted !== raw ? formatted : null
}
</script>

<template>
  <div class="space-y-5">
    <div class="grid gap-5 sm:grid-cols-2">
      <UiField
        v-for="spec in BUSINESS_FIELDS"
        :key="spec.id"
        :label="spec.label"
        :hint="preview(spec.id) ? `Na arte: ${preview(spec.id)}` : spec.hint"
        :class="spec.id === 'address' ? 'sm:col-span-2' : undefined"
      >
        <UiInput
          :model-value="model[spec.id] ?? ''"
          :type="spec.inputType"
          :icon="spec.icon"
          :placeholder="spec.placeholder"
          :maxlength="spec.max"
          :autocomplete="spec.autocomplete"
          @update:model-value="model = { ...model, [spec.id]: String($event ?? '') || null }"
        />
      </UiField>
    </div>

    <p class="flex items-start gap-2 rounded-lg border border-line bg-subtle p-3 text-sm text-ink-muted">
      <Icon name="lucide:info" class="mt-0.5 size-4 shrink-0 text-ink-subtle" />
      <span>
        Preencher aqui não coloca nada na arte.
        <template v-if="filled">
          Em cada post você marca quais dessas {{ filled }}
          {{ filled === 1 ? 'informação aparece' : 'informações aparecem' }} —
          até {{ MAX_CONTACT_ITEMS }} por peça, para o rodapé continuar legível.
        </template>
        <template v-else>
          O que você preencher fica disponível para marcar na hora de gerar cada post.
        </template>
      </span>
    </p>
  </div>
</template>
