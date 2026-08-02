<script setup lang="ts">
import { UPLOAD_LIMITS } from '#shared/constants'

/**
 * Envio da logo. O modelo é o **caminho no Storage**, nunca a URL (§2.2):
 * URL de download expira e não sobrevive a troca de bucket.
 */

const model = defineModel<string | null>({ required: true })

const { status, progress, error, accept, upload, cancel, remove } = useLogoUpload()
const { url: previewUrl, pending: previewPending } = useStorageUrl(model)

const input = useTemplateRef<HTMLInputElement>('input')
const dragging = ref(false)

/**
 * Caminhos criados nesta sessão. Só eles podem ser apagados do bucket ao
 * remover: o rascunho pode ter herdado a logo do perfil (§ padrões de marca),
 * e apagá-la aqui deixaria o perfil inteiro sem logo.
 */
const sessionPaths = new Set<string>()

async function handleFile(file: File | undefined | null) {
  if (!file) return

  const previous = model.value
  const path = await upload(file)
  if (!path) return

  model.value = path
  sessionPaths.add(path)

  if (previous && sessionPaths.has(previous)) {
    sessionPaths.delete(previous)
    void remove(previous)
  }
}

function onPick(event: Event) {
  const target = event.target as HTMLInputElement
  void handleFile(target.files?.[0])
  // Permite reenviar o mesmo arquivo depois de removê-lo.
  target.value = ''
}

function onDrop(event: DragEvent) {
  dragging.value = false
  void handleFile(event.dataTransfer?.files?.[0])
}

function clear() {
  const path = model.value
  model.value = null
  if (path && sessionPaths.has(path)) {
    sessionPaths.delete(path)
    void remove(path)
  }
}

const maxMb = UPLOAD_LIMITS.logoMaxBytes / 1024 / 1024
</script>

<template>
  <div class="space-y-3">
    <!-- Com logo -->
    <div v-if="model" class="flex items-center gap-4 rounded-lg border border-line bg-subtle p-3">
      <div class="grid size-16 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-checkerboard">
        <UiSpinner v-if="previewPending" size="sm" class="text-ink-subtle" />
        <img
          v-else-if="previewUrl"
          :src="previewUrl"
          alt="Pré-visualização da logo enviada"
          class="size-full object-contain p-1"
        >
        <Icon v-else name="lucide:image-off" class="size-5 text-ink-subtle" />
      </div>

      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink">Logo enviada</p>
        <p class="truncate text-xs text-ink-subtle">
          Ela entra na arte como referência visual.
        </p>
      </div>

      <div class="flex shrink-0 gap-1">
        <UiButton variant="ghost" size="sm" icon="lucide:repeat" @click="input?.click()">
          Trocar
        </UiButton>
        <UiButton variant="ghost" size="icon" icon="lucide:trash-2" aria-label="Remover logo" @click="clear" />
      </div>
    </div>

    <!-- Enviando -->
    <div v-else-if="status === 'uploading'" class="rounded-lg border border-line p-4">
      <div class="mb-3 flex items-center justify-between gap-4">
        <p class="text-sm text-ink-muted">Enviando logo…</p>
        <UiButton variant="ghost" size="sm" @click="cancel">Cancelar</UiButton>
      </div>
      <UiProgress :value="progress" label="Progresso do envio da logo" />
    </div>

    <!-- Vazio -->
    <div
      v-else
      :class="
        cn(
          'rounded-lg border border-dashed p-6 text-center transition-colors duration-150 ease-out-soft',
          dragging ? 'border-brand-500 bg-brand-50' : 'border-line bg-subtle',
        )
      "
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <Icon name="lucide:image-up" class="mx-auto size-6 text-ink-subtle" />
      <p class="mt-2 text-sm text-ink-muted">
        Arraste a logo aqui ou
        <button
          type="button"
          class="font-medium text-brand-600 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2"
          @click="input?.click()"
        >
          escolha um arquivo
        </button>
      </p>
      <p class="mt-1 text-xs text-ink-subtle">PNG, JPG, WebP ou SVG · até {{ maxMb }}MB</p>
    </div>

    <p v-if="error" class="flex items-start gap-2 text-sm text-danger" role="alert">
      <Icon name="lucide:alert-circle" class="mt-0.5 size-4 shrink-0" />
      <span>{{ error }}</span>
    </p>

    <input
      ref="input"
      type="file"
      :accept="accept"
      class="sr-only"
      @change="onPick"
    >
  </div>
</template>
