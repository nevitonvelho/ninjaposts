<script setup lang="ts">
import { CTA_SUGGESTIONS, INPUT_LIMITS } from '#shared/constants'

const generator = useGeneratorStore()
const { draft } = storeToRefs(generator)

/**
 * O campo aceita o que o usuário digitar ("29,90", "R$ 29.90", "29") e mostra
 * ao lado como ficou entendido. Isso resolve a ambiguidade de separador decimal
 * sem impor máscara — máscara com cursor no meio do número é o pior dos mundos
 * no mobile.
 */
const pricePreview = computed(() =>
  generator.priceCents === null ? null : formatPriceCents(generator.priceCents),
)

/** A chamada do nicho vem primeiro: é a mais provável de servir. */
const ctaOptions = computed(() => {
  const sample = generator.nicheSuggestion?.sampleCta
  if (!sample) return CTA_SUGGESTIONS
  return [sample, ...CTA_SUGGESTIONS.filter(cta => cta !== sample)]
})
</script>

<template>
  <div class="space-y-6">
    <UiField
      label="Preço"
      :hint="pricePreview ? `Vai aparecer como ${pricePreview}` : 'Deixe em branco se o post não mostra preço.'"
      :error="generator.errorFor('priceCents')"
    >
      <UiInput
        v-model="draft.priceInput"
        prefix="R$"
        inputmode="decimal"
        placeholder="29,90"
      />
    </UiField>

    <UiField
      label="Promoção ou destaque"
      hint="A frase de impacto da peça."
      :error="generator.errorFor('promotion')"
      :count="draft.promotion.length"
      :max="INPUT_LIMITS.promotion.max"
    >
      <UiInput v-model="draft.promotion" placeholder="Ex.: 2 por R$ 39,90 só hoje" />
    </UiField>

    <UiField
      label="Chamada para ação"
      hint="O que a pessoa deve fazer depois de ver o post."
      :error="generator.errorFor('cta')"
      :count="draft.cta.length"
      :max="INPUT_LIMITS.cta.max"
    >
      <div class="space-y-3">
        <UiInput v-model="draft.cta" placeholder="Ex.: Peça pelo WhatsApp" />

        <ul class="flex flex-wrap gap-2">
          <li v-for="cta in ctaOptions" :key="cta">
            <button
              type="button"
              :class="
                cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150 ease-out-soft',
                  'focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2',
                  draft.cta === cta
                    ? 'border-brand-200 bg-brand-50 text-brand-700'
                    : 'border-line bg-canvas text-ink-muted hover:border-line-strong hover:bg-subtle hover:text-ink',
                )
              "
              @click="draft.cta = draft.cta === cta ? '' : cta"
            >
              {{ cta }}
            </button>
          </li>
        </ul>
      </div>
    </UiField>

    <p class="flex items-start gap-2 rounded-lg border border-line bg-subtle p-3 text-sm text-ink-muted">
      <Icon name="lucide:info" class="mt-0.5 size-4 shrink-0 text-ink-subtle" />
      <span>Nada aqui é obrigatório. Post sem preço costuma funcionar bem para institucional e agendamento.</span>
    </p>
  </div>
</template>
