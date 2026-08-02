<script setup lang="ts">
import { STYLE_LIST } from '#shared/constants'

// Amostra fixa de estilos no painel lateral — nada aleatório, para o prerender
// e o cliente renderizarem exatamente a mesma coisa.
const showcase = STYLE_LIST.slice(0, 6)
</script>

<template>
  <div class="grid min-h-dvh lg:grid-cols-2">
    <!-- Formulário -->
    <div class="flex flex-col px-6 py-8 sm:px-12">
      <header>
        <LayoutAppLogo to="/" />
      </header>

      <main class="flex flex-1 items-center justify-center py-12">
        <div class="w-full max-w-sm">
          <slot />
        </div>
      </main>

      <footer class="text-center text-xs text-ink-subtle">
        Ao continuar, você concorda com os
        <NuxtLink to="/termos" class="underline underline-offset-2 hover:text-ink-muted">
          Termos de Uso
        </NuxtLink>
        e a
        <NuxtLink to="/privacidade" class="underline underline-offset-2 hover:text-ink-muted">
          Política de Privacidade
        </NuxtLink>
        .
      </footer>
    </div>

    <!--
      Painel decorativo só no desktop. `aria-hidden` porque é ilustração pura:
      repetir isso num leitor de tela atrasa quem só quer chegar ao formulário.
    -->
    <aside
      class="relative hidden overflow-hidden border-l border-line bg-subtle lg:flex lg:flex-col lg:justify-center lg:px-16"
      aria-hidden="true"
    >
      <div
        class="pointer-events-none absolute -top-32 -right-24 size-96 rounded-full bg-brand-100/60 blur-3xl"
      />
      <div
        class="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-info-soft blur-3xl"
      />

      <div class="relative">
        <h2 class="max-w-md text-3xl font-semibold tracking-tight text-balance">
          Artes que parecem feitas por
          <span class="text-gradient-brand">um designer</span>.
        </h2>
        <p class="mt-3 max-w-sm text-ink-muted">
          Você descreve o produto. A IA cria a arte, a legenda e as hashtags — prontas para
          publicar.
        </p>

        <div class="mt-10 grid max-w-md grid-cols-3 gap-3">
          <div v-for="style in showcase" :key="style.id" class="space-y-2">
            <div
              :class="
                cn(
                  'aspect-square rounded-lg border border-line bg-gradient-to-br shadow-soft',
                  style.preview,
                )
              "
            />
            <p class="text-xs font-medium text-ink-muted">{{ style.label }}</p>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>
