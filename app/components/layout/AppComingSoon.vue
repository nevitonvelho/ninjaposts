<script setup lang="ts">
/**
 * Marcador honesto para rota que ainda não foi construída.
 *
 * Existe porque link morto é pior que tela vazia: quebra a navegação, gera
 * aviso do router e deixa o usuário sem saber se falhou ou se não existe.
 * Dizer qual etapa entrega a tela evita a dúvida.
 */
defineProps<{
  title: string
  description: string
  stage: string
  icon: string
}>()
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <UiCard padding="lg">
      <div class="flex flex-col items-center py-8 text-center">
        <div class="grid size-12 place-items-center rounded-xl border border-line bg-subtle">
          <Icon :name="icon" class="size-5 text-ink-subtle" />
        </div>

        <UiBadge tone="brand" class="mt-5">{{ stage }}</UiBadge>
        <h1 class="mt-3 text-xl font-semibold tracking-tight">{{ title }}</h1>
        <p class="mt-2 max-w-sm text-sm text-ink-muted">{{ description }}</p>

        <UiButton to="/app" variant="secondary" icon="lucide:arrow-left" class="mt-6">
          Voltar ao início
        </UiButton>
      </div>
    </UiCard>
  </div>
</template>
