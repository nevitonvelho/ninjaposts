<script setup lang="ts">
import { UNIVERSAL_NICHE } from '#shared/constants'
import type { AssetDoc, AssetKind } from '#shared/types/asset'

/**
 * Grade da biblioteca. Renderiza o arquivo original — não há pipeline de
 * thumbnail, e com o teto de 4MB por asset e `loading="lazy"` isso se paga
 * numa tela que só o admin abre.
 */

const props = defineProps<{ kind: AssetKind }>()

const { items, pending, error } = useAssets(() => props.kind)
const { setActive, remove } = useAssetLibrary()
const { confirmDelete } = useDialog()

const filter = ref('')

const filtered = computed(() => {
  const term = slugify(filter.value)
  if (!term) return items.value
  return items.value.filter(
    asset => slugify(asset.name).includes(term) || asset.niches.some(n => n.includes(term)),
  )
})

function nicheLabel(asset: AssetDoc) {
  if (asset.niches.includes(UNIVERSAL_NICHE)) return 'Qualquer nicho'
  return asset.niches.join(', ')
}

async function onRemove(asset: AssetDoc) {
  const ok = await confirmDelete({
    title: `Excluir "${asset.name}"?`,
    description:
      'O arquivo sai do bucket e o asset deixa de ser usado em novas artes. '
      + 'Se a intenção é só parar de usar, desative em vez de excluir.',
  })
  if (ok) await remove(asset)
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-4">
      <UiInput
        v-model="filter"
        icon="lucide:search"
        placeholder="Filtrar por nome ou nicho"
        class="max-w-xs"
        aria-label="Filtrar biblioteca"
      />
      <p class="shrink-0 text-sm text-ink-subtle">
        {{ filtered.length }} {{ filtered.length === 1 ? 'item' : 'itens' }}
      </p>
    </div>

    <p v-if="error" class="rounded-lg border border-danger/20 bg-danger-soft p-3 text-sm text-ink-muted">
      {{ error }}
    </p>

    <div v-else-if="pending" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <UiSkeleton v-for="i in 3" :key="i" shape="rect" height="14rem" />
    </div>

    <UiEmptyState
      v-else-if="!filtered.length"
      icon="lucide:image-off"
      title="Nada na biblioteca ainda"
      description="Suba o primeiro arquivo no formulário ao lado."
    />

    <ul v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <li
        v-for="asset in filtered"
        :key="asset.id"
        :class="
          cn(
            'flex flex-col overflow-hidden rounded-lg border border-line',
            !asset.isActive && 'opacity-60',
          )
        "
      >
        <AssetThumb :path="asset.path" :label="asset.name" />

        <div class="flex flex-1 flex-col gap-2 p-3">
          <div class="flex items-start justify-between gap-2">
            <p class="min-w-0 flex-1 truncate text-sm font-medium text-ink">{{ asset.name }}</p>
            <UiBadge v-if="!asset.isActive" tone="neutral" size="sm">Inativo</UiBadge>
          </div>

          <p class="truncate text-xs text-ink-subtle">{{ nicheLabel(asset) }}</p>
          <p v-if="asset.description" class="line-clamp-2 text-xs text-ink-muted">
            {{ asset.description }}
          </p>

          <div class="mt-auto flex items-center justify-between gap-2 pt-2">
            <UiButton
              variant="ghost"
              size="sm"
              :icon="asset.isActive ? 'lucide:eye-off' : 'lucide:eye'"
              @click="setActive(asset, !asset.isActive)"
            >
              {{ asset.isActive ? 'Desativar' : 'Ativar' }}
            </UiButton>
            <UiButton
              variant="ghost"
              size="icon"
              icon="lucide:trash-2"
              :aria-label="`Excluir ${asset.name}`"
              @click="onRemove(asset)"
            />
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
