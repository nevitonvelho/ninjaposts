<script setup lang="ts">
import { CTA_SUGGESTIONS, INPUT_LIMITS } from '#shared/constants'

const generator = useGeneratorStore()
const { draft } = storeToRefs(generator)

/** Placeholder que muda com o nicho: exemplo real vale mais que "Ex.: produto". */
const productPlaceholder = computed(
  () => generator.nicheSuggestion?.sampleProduct ?? 'Ex.: combo família, corte masculino, plano anual',
)

/**
 * Preço, promoção e chamada ficam recolhidos.
 *
 * Eram uma etapa inteira, e os três são opcionais — post institucional e de
 * agendamento costumam sair melhor sem nenhum deles. Como etapa própria, davam
 * a três campos dispensáveis o mesmo peso do nome do produto; recolhidos,
 * quem precisa abre em um clique e quem não precisa nem para para pensar.
 */
const hasOffer = computed(() =>
  Boolean(draft.value.priceInput || draft.value.promotion || draft.value.cta),
)

const showOffer = ref(hasOffer.value)

// Rascunho recuperado com preço preenchido não pode esconder o preço.
watch(hasOffer, (value) => {
  if (value) showOffer.value = true
})

const pricePreview = computed(() =>
  generator.priceCents === null ? null : formatPriceCents(generator.priceCents),
)

/** A chamada do nicho vem primeiro: é a mais provável de servir. */
const ctaOptions = computed(() => {
  const sample = generator.nicheSuggestion?.sampleCta
  if (!sample) return CTA_SUGGESTIONS
  return [sample, ...CTA_SUGGESTIONS.filter(cta => cta !== sample)]
})

/** Sinaliza no botão recolhido o que já está preenchido lá dentro. */
const offerSummary = computed(() => {
  const parts: string[] = []
  if (pricePreview.value) parts.push(pricePreview.value)
  if (draft.value.promotion) parts.push(draft.value.promotion)
  if (draft.value.cta) parts.push(draft.value.cta)
  return parts.join(' · ')
})
</script>

<template>
  <div class="space-y-6">
    <UiField
      label="Qual é o seu negócio?"
      required
      hint="Pode escrever livremente — os atalhos são só sugestões."
      :error="generator.errorFor('niche')"
    >
      <GeneratorNicheSelect v-model="draft.niche" @select="generator.applyNiche" />
    </UiField>

    <UiField
      label="O que você quer divulgar?"
      required
      hint="O produto, serviço ou promoção que é o assunto deste post."
      :error="generator.errorFor('product')"
      :count="draft.product.length"
      :max="INPUT_LIMITS.product.max"
    >
      <UiInput v-model="draft.product" :placeholder="productPlaceholder" />
    </UiField>

    <UiField
      label="Quer dar mais detalhes?"
      hint="Ingredientes, diferenciais, público. Quanto mais específico, melhor a arte."
      :error="generator.errorFor('description')"
      :count="draft.description.length"
      :max="INPUT_LIMITS.description.max"
    >
      <UiTextarea
        v-model="draft.description"
        autoresize
        :rows="3"
        placeholder="Ex.: pão brioche artesanal, blend 180g, cheddar inglês e bacon crocante. Servido com fritas rústicas."
      />
    </UiField>

    <!--
      O rótulo mora dentro do componente: quando não há banco de produtos, o
      bloco inteiro some — um `UiField` com título e dica sobre uma grade vazia
      seria pior que não ter a seção.
    -->
    <GeneratorProductAssetPicker
      v-model="draft.productAssetIds"
      :niche="draft.niche"
      :error="generator.errorFor('productAssetIds')"
    />

    <!-- Oferta -->
    <div class="rounded-lg border border-line">
      <button
        type="button"
        class="flex w-full items-center gap-3 p-4 text-left focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2"
        :aria-expanded="showOffer"
        @click="showOffer = !showOffer"
      >
        <Icon
          name="lucide:tag"
          :class="cn('size-4 shrink-0', showOffer ? 'text-brand-600' : 'text-ink-subtle')"
        />
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-medium text-ink">Preço, promoção e chamada</span>
          <span class="block truncate text-xs text-ink-subtle">
            {{ offerSummary || 'Opcional — post sem preço funciona bem para institucional e agendamento.' }}
          </span>
        </span>
        <Icon
          name="lucide:chevron-down"
          :class="cn('size-4 shrink-0 text-ink-subtle transition-transform duration-200 ease-out-soft', showOffer && 'rotate-180')"
        />
      </button>

      <div v-if="showOffer" class="space-y-6 border-t border-line p-4">
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
      </div>
    </div>
  </div>
</template>
