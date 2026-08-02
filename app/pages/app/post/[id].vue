<script setup lang="ts">
import { GENERATION_RETENTION_HOURS, hoursUntilExpiry } from '#shared/constants'

definePageMeta({ layout: 'app', middleware: 'auth' })

const route = useRoute()
const id = computed(() => String(route.params.id))

const { generation, status, error, isActive, copy } = useGeneration(id)

const api = useApi()
const toast = useToast()
const dialog = useDialog()
const generator = useGeneratorStore()

const output = computed(() => generation.value?.output ?? null)
const { url: imageUrl } = useStorageUrl(() => output.value?.imagePath ?? null)

useHead({
  title: () => `${generation.value?.input.product ?? 'Post'} — NinjaPosts`,
})

/**
 * Job ainda rodando manda para a tela de progresso.
 *
 * Chegar aqui com a arte inacabada é normal — o card do histórico aponta para
 * cá assim que o status sai de "ativo", e uma reentrega de evento pode inverter
 * a ordem. Mostrar "sem resultado" seria mentira; a tela de progresso é a que
 * tem o que dizer.
 */
watch(
  isActive,
  (active) => {
    if (active) navigateTo(`/app/gerando/${id.value}`, { replace: true })
  },
  { immediate: true },
)

const expiresIn = computed(() => {
  const expiresAt = toDate(generation.value?.expiresAt)
  return expiresAt ? hoursUntilExpiry(expiresAt) : GENERATION_RETENTION_HOURS
})

const hashtagText = computed(() => formatHashtags(output.value?.hashtags ?? []))

// --- download ---------------------------------------------------------------

const downloading = ref<'png' | 'jpg' | null>(null)

/**
 * Baixa pelo nosso endpoint e salva com nome de verdade.
 *
 * O arquivo vem como blob porque o token de autenticação vive no header, e
 * navegação de `<a href>` não carrega header. Como o blob é da própria origem,
 * o atributo `download` finalmente é respeitado — que é justamente o que um
 * link direto para o Storage não conseguia.
 */
async function download(format: 'png' | 'jpg') {
  if (downloading.value || !generation.value) return
  downloading.value = format

  try {
    const blob = await api.blob(`/api/generations/${id.value}/download`, { format })

    const href = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.download = downloadFileName(
      generation.value.input.product,
      format,
      toDate(generation.value.createdAt) ?? new Date(),
    )
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()

    // Revogar no próximo tick: revogar na mesma volta do laço cancela o
    // download em alguns navegadores antes de ele começar.
    setTimeout(() => URL.revokeObjectURL(href), 0)
  } catch (requestError) {
    const failure = requestError instanceof ApiRequestError ? requestError : null
    toast.error(failure?.message ?? 'Não foi possível baixar a arte. Tente de novo.')
  } finally {
    downloading.value = null
  }
}

// --- gerar novamente / excluir ----------------------------------------------

/**
 * Reabre o formulário com os mesmos dados, marcando a origem.
 *
 * `parentId` é o que liga as duas gerações: sem ele, "gerar novamente" viraria
 * um post solto e a linhagem de uma arte que foi refeita cinco vezes se perde.
 */
function regenerate() {
  if (!generation.value) return
  generator.hydrateFrom(generation.value.input, { parentId: generation.value.id })
  navigateTo('/app/criar')
}

const removing = ref(false)

async function remove() {
  if (removing.value || !generation.value) return

  const confirmed = await dialog.confirmDelete({
    title: 'Excluir esta arte?',
    description: 'Ela sai do seu histórico e esta ação não pode ser desfeita. O crédito já usado não volta.',
  })
  if (!confirmed) return

  removing.value = true
  try {
    await api.del(`/api/generations/${id.value}`)
    toast.success('Arte excluída.')
    await navigateTo('/app/historico')
  } catch (requestError) {
    const failure = requestError instanceof ApiRequestError ? requestError : null
    toast.error(failure?.message ?? 'Não foi possível excluir. Tente de novo.')
  } finally {
    removing.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <div v-if="status === 'loading'" class="space-y-4">
      <UiSkeleton :lines="2" />
      <UiSkeleton shape="rect" height="320px" />
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
      <!-- Falhou -->
      <UiCard v-if="generation.status === 'failed' || generation.status === 'canceled'">
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
          <UiButton icon="lucide:rotate-ccw" @click="regenerate">Tentar de novo</UiButton>
          <UiButton to="/app/historico" variant="secondary">Ver histórico</UiButton>
        </div>
      </UiCard>

      <!-- Pronta -->
      <template v-else>
        <header class="flex flex-wrap items-end justify-between gap-4">
          <div class="min-w-0">
            <h1 class="truncate text-2xl font-semibold tracking-tight">
              {{ generation.input.product }}
            </h1>
            <p class="mt-1 text-sm text-ink-muted">{{ generation.input.niche }}</p>
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
            icon="lucide:download"
            :loading="downloading === 'png'"
            :disabled="Boolean(downloading)"
            @click="download('png')"
          >
            Baixar PNG
          </UiButton>
          <UiButton
            variant="secondary"
            icon="lucide:download"
            :loading="downloading === 'jpg'"
            :disabled="Boolean(downloading)"
            @click="download('jpg')"
          >
            Baixar JPG
          </UiButton>
          <UiButton variant="secondary" icon="lucide:sparkles" @click="regenerate">
            Gerar novamente
          </UiButton>
          <UiButton
            variant="ghost"
            icon="lucide:trash-2"
            :loading="removing"
            class="ms-auto text-danger"
            @click="remove"
          >
            Excluir
          </UiButton>
        </div>

        <UiCard v-if="output?.caption" title="Legenda">
          <p class="text-sm whitespace-pre-line text-ink-muted">{{ output.caption }}</p>
          <template #footer>
            <UiCopyButton :text="output.caption" size="sm" label="Copiar legenda" toast />
          </template>
        </UiCard>

        <UiCard v-if="output?.hashtags.length" title="Hashtags">
          <p class="text-sm text-ink-muted">{{ hashtagText }}</p>
          <template #footer>
            <UiCopyButton :text="hashtagText" size="sm" label="Copiar hashtags" toast />
          </template>
        </UiCard>

        <!--
          Texto alternativo com botão de copiar, e não só exibido: ele existe
          para ser colado no campo de acessibilidade da rede na hora de
          publicar. Sem o botão, ninguém o transcreve à mão.
        -->
        <UiCard v-if="output?.altText" title="Texto alternativo">
          <p class="text-sm text-ink-muted">{{ output.altText }}</p>
          <template #footer>
            <UiCopyButton :text="output.altText" size="sm" label="Copiar texto alternativo" toast />
          </template>
        </UiCard>
      </template>
    </template>
  </div>
</template>
