<script setup lang="ts">
import { STYLE_LIST } from '#shared/constants'
import type { StyleId } from '#shared/types/generation'

/**
 * Galeria de estilos.
 *
 * `<input type="radio">` de verdade, escondido com `sr-only`: setas navegam
 * entre as opções, o grupo recebe um único Tab e o leitor de tela anuncia
 * "opção 3 de 10" sem nenhum ARIA escrito à mão. Um grid de `<button>` com
 * `aria-checked` daria o mesmo visual e nenhuma dessas garantias.
 */

const model = defineModel<StyleId>({ required: true })

const props = defineProps<{
  /** Estilo sugerido pelo nicho — sinalizado, nunca imposto. */
  suggested?: StyleId | null
}>()

const name = useId()
</script>

<template>
  <fieldset class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
    <legend class="sr-only">Estilo visual</legend>

    <label
      v-for="style in STYLE_LIST"
      :key="style.id"
      :class="
        cn(
          'group relative cursor-pointer rounded-lg border p-2 text-left',
          'transition-[border-color,box-shadow,transform] duration-150 ease-out-soft',
          'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500 has-[:focus-visible]:outline-offset-2',
          model === style.id
            ? 'border-brand-500 shadow-soft'
            : 'border-line hover:border-line-strong hover:shadow-soft',
        )
      "
    >
      <input
        v-model="model"
        type="radio"
        :name="name"
        :value="style.id"
        class="sr-only"
      >

      <span :class="cn('block h-16 rounded-md bg-gradient-to-br', style.preview)" aria-hidden="true" />

      <span class="mt-2 flex items-center justify-between gap-1">
        <span class="truncate text-sm font-medium text-ink">{{ style.label }}</span>
        <Icon
          v-if="model === style.id"
          name="lucide:check-circle-2"
          class="size-4 shrink-0 text-brand-600"
        />
      </span>
      <span class="mt-0.5 block truncate text-xs text-ink-subtle">{{ style.description }}</span>

      <UiBadge
        v-if="props.suggested === style.id && model !== style.id"
        tone="brand"
        size="sm"
        class="absolute top-3 right-3"
      >
        Sugerido
      </UiBadge>
    </label>
  </fieldset>
</template>
