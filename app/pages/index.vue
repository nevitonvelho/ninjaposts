<script setup lang="ts">
/**
 * Placeholder da Etapa 1 — substituído pela landing real na Etapa 12.
 *
 * Serve como smoke test da fundação: se esta página renderiza, então os design
 * tokens, o Tailwind v4, os ícones e o auto-import de `shared/` estão de pé.
 */
import { FORMAT_LIST, PACK_LIST, STYLE_LIST, pricePerCredit } from '#shared/constants'

// `formatPriceCents` vem de shared/utils — auto-importado, sem import explícito.
const packs = PACK_LIST
</script>

<template>
  <main class="mx-auto max-w-5xl px-6 py-24">
    <header class="mb-16">
      <span
        class="inline-flex items-center gap-2 rounded-full border border-line bg-subtle px-3 py-1 text-xs font-medium text-ink-muted"
      >
        <Icon name="lucide:hammer" class="size-3.5" />
        Etapa 1 — fundação
      </span>

      <h1 class="mt-6 text-5xl font-semibold tracking-tight text-balance">
        Artes profissionais para redes sociais,
        <span class="text-gradient-brand">geradas por IA</span>
      </h1>

      <p class="mt-4 max-w-xl text-lg text-ink-muted">
        Design tokens, tipos e constantes estão no lugar. A interface de verdade vem nas
        próximas etapas.
      </p>
    </header>

    <section class="mb-14">
      <h2 class="mb-4 text-sm font-medium tracking-wide text-ink-subtle uppercase">
        Pacotes de crédito
      </h2>
      <div class="grid gap-4 sm:grid-cols-3">
        <article
          v-for="pack in packs"
          :key="pack.id"
          class="surface-card p-5 transition-shadow duration-150 hover:shadow-lifted"
          :class="pack.highlighted && 'ring-1 ring-brand-500'"
        >
          <h3 class="font-medium">{{ pack.name }}</h3>
          <p class="mt-1 text-2xl font-semibold tracking-tight">
            {{ formatPriceCents(pack.priceCents) }}
          </p>
          <p class="mt-2 text-sm text-ink-muted">
            {{ formatNumber(pack.credits) }} créditos ·
            {{ formatPriceCents(pricePerCredit(pack)) }} por arte
          </p>
        </article>
      </div>
      <p class="mt-3 text-sm text-ink-subtle">
        Sem mensalidade. Os créditos não expiram.
      </p>
    </section>

    <section class="mb-14">
      <h2 class="mb-4 text-sm font-medium tracking-wide text-ink-subtle uppercase">Formatos</h2>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="format in FORMAT_LIST"
          :key="format.id"
          class="rounded-md border border-line bg-subtle px-3 py-1.5 text-sm"
        >
          {{ format.label }}
          <span class="text-ink-subtle">{{ format.ratio }}</span>
        </span>
      </div>
    </section>

    <section>
      <h2 class="mb-4 text-sm font-medium tracking-wide text-ink-subtle uppercase">Estilos</h2>
      <div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div v-for="style in STYLE_LIST" :key="style.id" class="text-sm">
          <div class="mb-2 h-16 rounded-md bg-gradient-to-br" :class="style.preview" />
          {{ style.label }}
        </div>
      </div>
    </section>
  </main>
</template>
