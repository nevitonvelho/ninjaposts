<script setup lang="ts">
import { FORMATS, NETWORKS } from '#shared/constants'
import type { PostFormat } from '#shared/types/generation'

const generator = useGeneratorStore()
const { draft } = storeToRefs(generator)

const formatName = useId()

const formatOptions = computed(() => generator.availableFormats.map(id => FORMATS[id]))

/**
 * Aviso quando a combinação de redes derruba formatos. Sem isto, escolher
 * TikTok faz três opções sumirem da tela sem explicação — parece bug.
 */
const restricted = computed(() => {
  if (draft.value.networks.length < 1) return null
  const hidden = Object.keys(FORMATS).length - generator.availableFormats.length
  if (hidden <= 0) return null
  return draft.value.networks.map(n => NETWORKS[n].label).join(', ')
})

/** Caixinha proporcional ao formato — comunica melhor que "4:5". */
function previewStyle(format: PostFormat) {
  const { width, height } = FORMATS[format].output
  const scale = 44 / Math.max(width, height)
  return { width: `${width * scale}px`, height: `${height * scale}px` }
}
</script>

<template>
  <div class="space-y-8">
    <UiField
      label="Onde você vai publicar?"
      required
      hint="Pode escolher mais de uma. Isso define os formatos disponíveis."
      :error="generator.errorFor('networks')"
    >
      <GeneratorSocialNetworkPicker v-model="draft.networks" />
    </UiField>

    <UiField label="Formato da arte" required :error="generator.errorFor('format')">
      <div class="space-y-3">
        <p v-if="restricted" class="flex items-start gap-2 text-sm text-ink-subtle">
          <Icon name="lucide:filter" class="mt-0.5 size-4 shrink-0" />
          <span>Mostrando só os formatos que funcionam em {{ restricted }}.</span>
        </p>

        <fieldset class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <legend class="sr-only">Formato da arte</legend>

          <label
            v-for="format in formatOptions"
            :key="format.id"
            :class="
              cn(
                'flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-3 text-center',
                'transition-[border-color,box-shadow] duration-150 ease-out-soft',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500 has-[:focus-visible]:outline-offset-2',
                draft.format === format.id
                  ? 'border-brand-500 bg-brand-50 shadow-soft'
                  : 'border-line hover:border-line-strong hover:bg-subtle',
              )
            "
          >
            <input
              v-model="draft.format"
              type="radio"
              :name="formatName"
              :value="format.id"
              class="sr-only"
            >
            <span class="grid h-12 place-items-center">
              <span
                :class="
                  cn(
                    'block rounded-sm border-2',
                    draft.format === format.id ? 'border-brand-500 bg-brand-100' : 'border-line-strong bg-muted',
                  )
                "
                :style="previewStyle(format.id)"
                aria-hidden="true"
              />
            </span>
            <span class="text-sm font-medium text-ink">{{ format.label }}</span>
            <span class="text-xs text-ink-subtle">{{ format.ratio }} · {{ format.description }}</span>
          </label>
        </fieldset>
      </div>
    </UiField>

    <UiField
      label="Estilo visual"
      required
      hint="Define a direção de arte: luz, textura e composição."
      :error="generator.errorFor('style')"
    >
      <!--
        `templateId` (presets curados) fica fora por enquanto: a coleção
        `templates` só é populada no seed pendente da Etapa 5. O campo continua
        no input, sempre `null`, para não mudar o contrato depois.
      -->
      <GeneratorStyleGallery
        :model-value="draft.style"
        :suggested="generator.nicheSuggestion?.suggestedStyle ?? null"
        @update:model-value="generator.setStyle"
      />
    </UiField>
  </div>
</template>
