<script setup lang="ts">
import {
  ASSET_KINDS,
  ASSET_LIMITS,
  NICHE_SUGGESTIONS,
  UNIVERSAL_NICHE,
} from '#shared/constants'
import type { AssetKind } from '#shared/types/asset'

/**
 * Formulário de entrada da biblioteca.
 *
 * O arquivo sobe **antes** do documento existir: o Storage é quem valida tipo,
 * tamanho e permissão de verdade, e descobrir na hora de salvar que o upload
 * seria negado desperdiçaria todo o preenchimento.
 */

const props = defineProps<{ kind: AssetKind }>()
const emit = defineEmits<{ created: [] }>()

const spec = computed(() => ASSET_KINDS[props.kind])

const draft = ref(emptyAssetDraft(props.kind))
const { saving, errorFor, create } = useAssetLibrary()
const { status, progress, error: uploadError, accept, upload, cancel, remove } = useAssetUpload(
  () => props.kind,
)
const { url: previewUrl } = useStorageUrl(() => draft.value.path)

const fileInput = useTemplateRef<HTMLInputElement>('fileInput')

// Trocar a aba de tipo recomeça o formulário: os campos não são os mesmos.
watch(() => props.kind, (kind) => { draft.value = emptyAssetDraft(kind) })

const universal = computed({
  get: () => draft.value.niches.includes(UNIVERSAL_NICHE),
  set: (value: boolean) => {
    draft.value.niches = value ? [UNIVERSAL_NICHE] : []
  },
})

function toggleNiche(label: string) {
  const slug = slugify(label)
  const current = draft.value.niches.filter(n => n !== UNIVERSAL_NICHE)
  draft.value.niches = current.includes(slug)
    ? current.filter(n => n !== slug)
    : [...current, slug].slice(0, ASSET_LIMITS.niches.max)
}

function isNicheOn(label: string) {
  return draft.value.niches.includes(slugify(label))
}

async function handleFile(file: File | undefined | null) {
  if (!file) return
  const previous = draft.value.path
  const path = await upload(file)
  if (!path) return
  draft.value.path = path
  // O arquivo anterior deste mesmo formulário vira órfão no bucket se ficar.
  if (previous) void remove(previous)
}

async function onSubmit() {
  if (await create(draft.value)) {
    draft.value = emptyAssetDraft(props.kind)
    emit('created')
  }
}

function clearFile() {
  const path = draft.value.path
  draft.value.path = ''
  if (path) void remove(path)
}

const maxMb = ASSET_LIMITS.maxBytes / 1024 / 1024
</script>

<template>
  <UiCard>
    <template #header>
      <div class="flex items-start gap-3">
        <span class="grid size-9 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-600">
          <Icon :name="spec.icon" class="size-5" />
        </span>
        <div>
          <h2 class="font-medium tracking-tight text-ink">Adicionar {{ spec.label.toLowerCase() }}</h2>
          <p class="mt-0.5 text-sm text-ink-muted">{{ spec.description }}</p>
        </div>
      </div>
    </template>

    <form class="space-y-6" @submit.prevent="onSubmit">
      <!-- Arquivo -->
      <UiField label="Arquivo" required :error="errorFor('path')">
        <div class="space-y-3">
          <div v-if="draft.path" class="flex items-center gap-4 rounded-lg border border-line bg-subtle p-3">
            <div class="grid size-20 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-checkerboard">
              <img v-if="previewUrl" :src="previewUrl" alt="" class="size-full object-contain p-1">
              <UiSpinner v-else size="sm" class="text-ink-subtle" />
            </div>
            <p class="flex-1 text-sm text-ink-muted">Arquivo enviado.</p>
            <UiButton variant="ghost" size="sm" icon="lucide:trash-2" @click="clearFile">Trocar</UiButton>
          </div>

          <div v-else-if="status === 'uploading'" class="rounded-lg border border-line p-4">
            <div class="mb-3 flex items-center justify-between gap-4">
              <p class="text-sm text-ink-muted">Enviando…</p>
              <UiButton variant="ghost" size="sm" @click="cancel">Cancelar</UiButton>
            </div>
            <UiProgress :value="progress" label="Progresso do envio" />
          </div>

          <div v-else class="rounded-lg border border-dashed border-line bg-subtle p-6 text-center">
            <Icon name="lucide:image-up" class="mx-auto size-6 text-ink-subtle" />
            <p class="mt-2 text-sm text-ink-muted">
              <button
                type="button"
                class="font-medium text-brand-600 underline-offset-4 hover:underline"
                @click="fileInput?.click()"
              >
                Escolha um arquivo
              </button>
            </p>
            <p class="mt-1 text-xs text-ink-subtle">
              PNG, JPG ou WebP · até {{ maxMb }}MB
              <template v-if="kind === 'product'"> · PNG com fundo transparente rende melhor</template>
            </p>
          </div>

          <p v-if="uploadError" class="flex items-start gap-2 text-sm text-danger" role="alert">
            <Icon name="lucide:alert-circle" class="mt-0.5 size-4 shrink-0" />
            <span>{{ uploadError }}</span>
          </p>

          <input
            ref="fileInput"
            type="file"
            :accept="accept"
            class="sr-only"
            @change="handleFile(($event.target as HTMLInputElement).files?.[0]); ($event.target as HTMLInputElement).value = ''"
          >
        </div>
      </UiField>

      <UiField
        label="Nome"
        required
        hint="Só para você achar na grade — não vai para o prompt."
        :error="errorFor('name')"
      >
        <UiInput
          v-model="draft.name"
          :maxlength="ASSET_LIMITS.name.max"
          :placeholder="kind === 'product' ? 'Ex.: Coca-Cola 2L' : 'Ex.: Promo hamburgueria fundo escuro'"
        />
      </UiField>

      <UiField
        v-if="kind === 'product'"
        label="O que é este objeto"
        hint="Vai para o prompt. Descreva embalagem e rótulo — é o que impede o modelo de tratar o PNG como elemento de fundo."
        :error="errorFor('description')"
        :count="draft.description.length"
        :max="ASSET_LIMITS.description.max"
      >
        <UiInput v-model="draft.description" placeholder="Ex.: garrafa de Coca-Cola 2L, rótulo vermelho" />
      </UiField>

      <UiField
        label="Nichos"
        required
        hint="Define onde este asset é usado."
        :error="errorFor('niches')"
      >
        <div class="space-y-3">
          <UiSwitch
            v-model="universal"
            label="Serve a qualquer nicho"
            description="Use para objetos genéricos, como refrigerante ou embalagem de entrega."
          />

          <ul v-if="!universal" class="flex flex-wrap gap-2">
            <li v-for="niche in NICHE_SUGGESTIONS" :key="niche.label">
              <button
                type="button"
                :class="
                  cn(
                    'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium',
                    'transition-colors duration-150 ease-out-soft',
                    'focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2',
                    isNicheOn(niche.label)
                      ? 'border-brand-200 bg-brand-50 text-brand-700'
                      : 'border-line bg-canvas text-ink-muted hover:border-line-strong hover:bg-subtle hover:text-ink',
                  )
                "
                @click="toggleNiche(niche.label)"
              >
                <Icon :name="niche.icon" class="size-3.5" />
                {{ niche.label }}
              </button>
            </li>
          </ul>
        </div>
      </UiField>

      <div class="flex items-center justify-between gap-4">
        <UiSwitch v-model="draft.isActive" label="Ativo" />
        <UiButton type="submit" icon="lucide:plus" :loading="saving" :disabled="!draft.path">
          Adicionar
        </UiButton>
      </div>
    </form>
  </UiCard>
</template>
