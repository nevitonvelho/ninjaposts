<script setup lang="ts">
import { GENERATION_RETENTION_HOURS, hoursUntilExpiry } from '#shared/constants'

definePageMeta({ layout: 'app', middleware: 'auth' })

const route = useRoute()
const id = computed(() => String(route.params.id))

const { generation, status, error, isActive, copy, progress } = useGeneration(id)

const output = computed(() => generation.value?.output ?? null)
const { url: imageUrl } = useStorageUrl(() => output.value?.imagePath ?? null)

const expiresIn = computed(() => {
  const expiresAt = toDate(generation.value?.expiresAt)
  return expiresAt ? hoursUntilExpiry(expiresAt) : GENERATION_RETENTION_HOURS
})

/**
 * A aba costuma ir para segundo plano durante a geração — são de 20s a 90s de
 * espera. O título vira o canal de aviso: o usuário vê o progresso na barra de
 * abas sem precisar voltar.
 */
useHead({
  title: () =>
    isActive.value
      ? `${progress.value}% — Gerando sua arte`
      : `${copy.value.title} — CriaPosts`,
})
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <div v-if="status === 'loading'" class="space-y-4">
      <UiSkeleton :lines="2" />
      <UiSkeleton shape="rect" height="240px" />
    </div>

    <UiCard v-else-if="status === 'not_found'" flush padding="none">
      <UiEmptyState
        icon="lucide:timer-off"
        title="Esta arte não está mais disponível"
        :description="`As artes ficam guardadas por ${GENERATION_RETENTION_HOURS} horas e depois são apagadas. Se você acabou de gerar, confira o link.`"
      >
        <UiButton to="/app/criar" icon="lucide:sparkles">Criar outra</UiButton>
      </UiEmptyState>
    </UiCard>

    <div
      v-else-if="status === 'error'"
      class="flex gap-3 rounded-lg border border-danger/20 bg-danger-soft p-4 text-sm"
      role="alert"
    >
      <Icon name="lucide:alert-circle" class="mt-0.5 size-4 shrink-0 text-danger" />
      <p class="text-ink-muted">{{ error }}</p>
    </div>

    <template v-else-if="generation">
      <!-- Em andamento -->
      <UiCard v-if="isActive">
        <div class="flex items-start gap-4">
          <UiSpinner size="md" class="mt-1 text-brand-600" />
          <div class="min-w-0 flex-1">
            <h1 class="font-medium tracking-tight">{{ copy.title }}</h1>
            <p class="mt-1 text-sm text-ink-muted">{{ copy.hint }}</p>
          </div>
          <span class="text-sm font-medium tabular-nums text-ink-muted">{{ progress }}%</span>
        </div>

        <UiProgress :value="progress" label="Progresso da geração" class="mt-5" />

        <p class="mt-4 text-sm text-ink-subtle">
          Pode fechar esta aba — o trabalho continua no servidor e a arte fica no seu histórico.
        </p>
      </UiCard>

      <!-- Falhou -->
      <UiCard v-else-if="generation.status === 'failed' || generation.status === 'canceled'">
        <div class="flex items-start gap-4">
          <span class="grid size-10 shrink-0 place-items-center rounded-lg bg-danger-soft text-danger">
            <Icon name="lucide:x" class="size-5" />
          </span>
          <div class="min-w-0 flex-1">
            <h1 class="font-medium tracking-tight">{{ copy.title }}</h1>
            <p class="mt-1 text-sm text-ink-muted">
              {{ generation.error?.message ?? copy.hint }}
            </p>
          </div>
        </div>

        <div class="mt-5 flex flex-wrap gap-2">
          <UiButton to="/app/criar" icon="lucide:rotate-ccw">Tentar de novo</UiButton>
          <UiButton to="/app/historico" variant="secondary">Ver histórico</UiButton>
        </div>
      </UiCard>

      <!-- Pronta -->
      <template v-else>
        <header class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 class="text-2xl font-semibold tracking-tight">{{ copy.title }}</h1>
            <p class="mt-1 text-sm text-ink-muted">{{ copy.hint }}</p>
          </div>
          <UiBadge tone="warning" icon="lucide:timer">Some em {{ expiresIn }}h</UiBadge>
        </header>

        <UiCard flush padding="none">
          <div class="grid place-items-center bg-checkerboard p-4">
            <img
              v-if="imageUrl"
              :src="imageUrl"
              :alt="output?.altText ?? 'Arte gerada'"
              class="max-h-[70vh] w-auto rounded-md shadow-lifted"
            >
            <UiSkeleton v-else shape="rect" height="320px" class="w-full" />
          </div>
        </UiCard>

        <div class="flex flex-wrap gap-2">
          <UiButton
            v-if="imageUrl"
            :href="imageUrl"
            target="_blank"
            rel="noopener"
            icon="lucide:download"
          >
            Abrir imagem
          </UiButton>
          <UiButton to="/app/criar" variant="secondary" icon="lucide:sparkles">
            Criar outra
          </UiButton>
        </div>

        <!--
          Legenda e hashtags em versão simples. A tela de resultado completa —
          download em PNG/JPG com nome certo, copiar com um clique, gerar
          novamente — é a Etapa 8.
        -->
        <UiCard v-if="output?.caption" title="Legenda">
          <p class="text-sm whitespace-pre-line text-ink-muted">{{ output.caption }}</p>
        </UiCard>

        <UiCard v-if="output?.hashtags.length" title="Hashtags">
          <p class="text-sm text-ink-muted">{{ formatHashtags(output.hashtags) }}</p>
        </UiCard>
      </template>
    </template>
  </div>
</template>
