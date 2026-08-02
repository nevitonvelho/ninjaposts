<script setup lang="ts">
import { INPUT_LIMITS } from '#shared/constants'

const generator = useGeneratorStore()
const { draft } = storeToRefs(generator)

/** Placeholder que muda com o nicho: exemplo real vale mais que "Ex.: produto". */
const productPlaceholder = computed(
  () => generator.nicheSuggestion?.sampleProduct ?? 'Ex.: combo família, corte masculino, plano anual',
)
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
  </div>
</template>
