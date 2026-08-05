<script setup lang="ts">
import { ASSET_KIND_LIST } from '#shared/constants'
import type { AssetKind } from '#shared/types/asset'

definePageMeta({ layout: 'app', middleware: 'admin' })
useHead({ title: 'Biblioteca — NinjaPosts' })

/**
 * Curadoria das duas bibliotecas que alimentam o render.
 *
 * As abas separam coisas com naturezas opostas: referência de estilo é escolhida
 * pelo sistema e serve à direção de arte; produto é escolhido pelo usuário e
 * precisa sair fiel na peça. Misturar as duas numa grade só faria você perder
 * tempo distinguindo qual é qual.
 */

const kind = ref<AssetKind>('style')

const tabs = computed(() =>
  ASSET_KIND_LIST.map(spec => ({ value: spec.id, label: spec.label, icon: spec.icon })),
)
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold tracking-tight">Biblioteca</h1>
      <p class="text-sm text-ink-muted">
        O que você sobe aqui entra nas artes de todos os clientes. É a curadoria do produto.
      </p>
    </header>

    <UiTabs v-model="kind" :items="tabs" aria-label="Tipo de asset" />

    <div class="grid gap-6 lg:grid-cols-[22rem_1fr] lg:items-start">
      <AdminAssetUploader :kind="kind" />
      <AdminAssetGrid :kind="kind" />
    </div>
  </div>
</template>
