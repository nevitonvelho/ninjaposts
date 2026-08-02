<script setup lang="ts">
import { INPUT_LIMITS } from '#shared/constants'

const generator = useGeneratorStore()
const { draft } = storeToRefs(generator)
const auth = useAuthStore()

/** Só oferece "usar minha marca" se houver marca salva para usar. */
const profileBrand = computed(() => auth.userDoc?.brand ?? null)
const hasProfileBrand = computed(
  () => Boolean(profileBrand.value?.colors.length || profileBrand.value?.logoPath),
)

function useProfileBrand() {
  if (profileBrand.value) generator.applyBrandDefaults(profileBrand.value)
}
</script>

<template>
  <div class="space-y-8">
    <UiField
      label="Cores da marca"
      hint="A primeira cor é a dominante da arte."
      :error="generator.errorFor('colors')"
    >
      <div class="space-y-3">
        <UiButton
          v-if="hasProfileBrand"
          variant="secondary"
          size="sm"
          icon="lucide:wand-2"
          @click="useProfileBrand"
        >
          Usar a marca do meu perfil
        </UiButton>

        <GeneratorBrandColorPicker v-model="draft.colors" />
      </div>
    </UiField>

    <UiField
      label="Logo"
      hint="Opcional. Entra na arte como referência visual."
      :error="generator.errorFor('logoPath')"
    >
      <GeneratorLogoUpload v-model="draft.logoPath" />
    </UiField>

    <UiField
      label="Instruções extras"
      hint="Algo que a IA precisa saber e não coube nos campos acima."
      :error="generator.errorFor('extraInstructions')"
      :count="draft.extraInstructions.length"
      :max="INPUT_LIMITS.extraInstructions.max"
    >
      <UiTextarea
        v-model="draft.extraInstructions"
        autoresize
        :rows="3"
        placeholder="Ex.: não usar fundo escuro, mostrar o produto de cima, deixar espaço à direita para o logo."
      />
    </UiField>
  </div>
</template>
