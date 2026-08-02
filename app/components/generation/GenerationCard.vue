<script setup lang="ts">
import { FORMATS, STATUS_COPY, STATUS_PROGRESS } from '#shared/constants'
import type { GenerationDoc, GenerationStatus } from '#shared/types/generation'

const props = defineProps<{ generation: GenerationDoc }>()

const { url, pending } = useStorageUrl(() => props.generation.output?.thumbPath ?? null)

const isDone = computed(() => props.generation.status === 'completed')
const isFailed = computed(
  () => props.generation.status === 'failed' || props.generation.status === 'canceled',
)
const isWorking = computed(() => !isDone.value && !isFailed.value)

const progress = computed(
  () => props.generation.progress || STATUS_PROGRESS[props.generation.status],
)

const TONES: Record<GenerationStatus, 'neutral' | 'info' | 'success' | 'danger'> = {
  queued: 'neutral',
  briefing: 'info',
  rendering: 'info',
  finishing: 'info',
  completed: 'success',
  failed: 'danger',
  canceled: 'neutral',
}

// Job em andamento leva à tela de progresso; concluído, ao resultado.
const target = computed(() =>
  isWorking.value ? `/app/gerando/${props.generation.id}` : `/app/post/${props.generation.id}`,
)

const aspect = computed(() => {
  const format = FORMATS[props.generation.input.format]
  return `${format.output.width} / ${format.output.height}`
})
</script>

<template>
  <NuxtLink
    :to="target"
    class="group block overflow-hidden rounded-lg border border-line bg-canvas shadow-soft transition-[box-shadow,border-color,transform] duration-200 ease-out-soft hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lifted"
  >
    <div class="relative bg-checkerboard" :style="{ aspectRatio: aspect }">
      <img
        v-if="url"
        :src="url"
        :alt="generation.output?.altText ?? `Arte de ${generation.input.product}`"
        class="size-full object-cover"
        loading="lazy"
      >

      <div v-else-if="pending || isWorking" class="absolute inset-0 skeleton-shimmer" />

      <div
        v-else-if="isFailed"
        class="absolute inset-0 grid place-items-center bg-danger-soft text-danger"
      >
        <Icon name="lucide:image-off" class="size-6" />
      </div>

      <!-- Progresso sobreposto: no histórico o card é o único lugar onde o
           usuário vê que aquele job ainda está rodando. -->
      <div v-if="isWorking" class="absolute inset-x-0 bottom-0 space-y-2 bg-canvas/90 p-3 backdrop-blur-sm">
        <div class="flex items-center justify-between text-xs font-medium">
          <span>{{ STATUS_COPY[generation.status].title }}</span>
          <span class="text-ink-subtle tabular-nums">{{ progress }}%</span>
        </div>
        <UiProgress :value="progress" size="sm" :label="STATUS_COPY[generation.status].title" />
      </div>
    </div>

    <div class="space-y-2 p-3.5">
      <div class="flex items-start justify-between gap-2">
        <p class="truncate text-sm font-medium text-ink">{{ generation.input.product }}</p>
        <UiBadge v-if="!isDone" :tone="TONES[generation.status]" size="sm" dot>
          {{ STATUS_COPY[generation.status].title }}
        </UiBadge>
      </div>

      <p class="flex items-center gap-2 text-xs text-ink-subtle">
        <span class="truncate">{{ generation.input.niche }}</span>
        <span aria-hidden="true">·</span>
        <span class="shrink-0">{{ formatRelative(generation.createdAt) }}</span>
      </p>
    </div>
  </NuxtLink>
</template>
