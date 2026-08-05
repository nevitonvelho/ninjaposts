<script setup lang="ts">
import { ASSET_LIMITS, UNIVERSAL_NICHE } from '#shared/constants'
import type { AssetDoc } from '#shared/types/asset'

/**
 * Escolha de produtos do banco.
 *
 * O ganho é o modelo desenhar **a garrafa de verdade** em vez de inventar um
 * rótulo parecido — que é o defeito mais caro de uma peça publicada: rótulo
 * inventado num anúncio real é problema de marca, não de estética.
 *
 * Some da tela quando o banco está vazio: um seletor sem nada para selecionar
 * é só mais um campo para o usuário processar.
 */

const model = defineModel<string[]>({ required: true })
const props = defineProps<{ niche: string; error?: string[] | null }>()

const { items, pending } = useAssets('product', { activeOnly: true })

const search = ref('')

const visible = computed(() => {
  const ordered = sortAssetsForNiche(items.value, props.niche)
  const term = slugify(search.value)
  if (!term) return ordered
  return ordered.filter(asset => slugify(asset.name).includes(term))
})

const full = computed(() => model.value.length >= ASSET_LIMITS.perGeneration)

function isOn(id: string) {
  return model.value.includes(id)
}

function toggle(asset: AssetDoc) {
  if (isOn(asset.id)) {
    model.value = model.value.filter(id => id !== asset.id)
    return
  }
  if (full.value) return
  model.value = [...model.value, asset.id]
}

/** Rótulo do porquê aquele item está na lista — ajuda a entender a ordem. */
function reason(asset: AssetDoc) {
  const slug = slugify(props.niche)
  if (slug && asset.niches.includes(slug)) return 'Do seu nicho'
  if (asset.niches.includes(UNIVERSAL_NICHE)) return 'Serve a qualquer nicho'
  return null
}
</script>

<template>
  <UiField
    v-if="pending || items.length"
    label="Produtos do banco"
    hint="O modelo desenha o objeto real, com rótulo e proporções — sem inventar um parecido."
    :error="error"
  >
    <div class="space-y-3">
      <UiInput
        v-if="items.length > 6"
        v-model="search"
        icon="lucide:search"
        size="sm"
        placeholder="Buscar produto"
        aria-label="Buscar no banco de produtos"
      />

      <div v-if="pending" class="grid grid-cols-3 gap-3 sm:grid-cols-4">
        <UiSkeleton v-for="i in 4" :key="i" shape="rect" height="6rem" />
      </div>

      <p v-else-if="!visible.length" class="text-sm text-ink-subtle">
        Nenhum produto encontrado com esse nome.
      </p>

      <ul v-else class="grid grid-cols-3 gap-3 sm:grid-cols-4">
        <li v-for="asset in visible" :key="asset.id">
          <label
            :class="
              cn(
                'flex cursor-pointer flex-col overflow-hidden rounded-lg border text-center',
                'transition-[border-color,box-shadow] duration-150 ease-out-soft',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500 has-[:focus-visible]:outline-offset-2',
                isOn(asset.id)
                  ? 'border-brand-500 shadow-soft'
                  : 'border-line hover:border-line-strong',
                !isOn(asset.id) && full && 'cursor-not-allowed opacity-50',
              )
            "
          >
            <input
              type="checkbox"
              class="sr-only"
              :checked="isOn(asset.id)"
              :disabled="!isOn(asset.id) && full"
              @change="toggle(asset)"
            >

            <span class="relative block">
              <AssetThumb :path="asset.path" :label="asset.name" />
              <span
                v-if="isOn(asset.id)"
                class="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-brand-600 text-white"
                aria-hidden="true"
              >
                <Icon name="lucide:check" class="size-3.5" />
              </span>
            </span>

            <span class="truncate p-2 text-xs font-medium text-ink">{{ asset.name }}</span>
            <span v-if="reason(asset)" class="-mt-1 truncate px-2 pb-2 text-[10px] text-ink-subtle">
              {{ reason(asset) }}
            </span>
          </label>
        </li>
      </ul>

      <p v-if="full" class="flex items-start gap-2 text-xs text-ink-subtle">
        <Icon name="lucide:info" class="mt-0.5 size-3.5 shrink-0" />
        <span>
          Máximo de {{ ASSET_LIMITS.perGeneration }} por arte — acima disso os objetos
          começam a disputar espaço com o produto principal.
        </span>
      </p>
    </div>
  </UiField>
</template>
