<script setup lang="ts">
import type { CreateGenerationBody, CreateGenerationResponse } from '#shared/types/api'

definePageMeta({ layout: 'app', middleware: 'auth' })
useHead({ title: 'Criar post — CriaPosts' })

const generator = useGeneratorStore()
const auth = useAuthStore()
const api = useApi()
const toast = useToast()

/**
 * Puxa cores e logo do perfil, mas só em rascunho novo.
 *
 * Em rascunho já mexido, reaplicar seria desfazer escolha do usuário: quem
 * apagou as cores de propósito e deu F5 as veria voltar sozinhas.
 */
watch(
  () => auth.profileStatus,
  (status) => {
    if (status !== 'ready' || generator.isDirty) return
    const brand = auth.userDoc?.brand
    if (brand) generator.applyBrandDefaults(brand)
  },
  { immediate: true },
)

const submitting = ref(false)

/**
 * Cria o job e sai da tela.
 *
 * A resposta é 202, não a arte: o trabalho pesado roda no worker e o progresso
 * chega por `onSnapshot` na próxima rota (§0.3). O rascunho só é limpo depois
 * do sucesso — se a API recusar, o usuário volta para o formulário preenchido,
 * que é o mínimo depois de preencher seis campos.
 */
async function onSubmit(body: CreateGenerationBody) {
  if (submitting.value) return
  submitting.value = true

  try {
    const result = await api.post<CreateGenerationResponse>('/api/generations', body)

    generator.reset()
    await navigateTo(`/app/gerando/${result.id}`)
  } catch (error) {
    const apiFailure = error instanceof ApiRequestError ? error : null

    if (apiFailure?.code === 'insufficient_credits') {
      toast.error({
        title: 'Sem créditos',
        description: apiFailure.message,
        action: { label: 'Comprar', onClick: () => navigateTo('/app/creditos') },
      })
    } else {
      toast.error(apiFailure?.message ?? 'Não foi possível iniciar a geração. Tente de novo.')
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold tracking-tight">Criar post</h1>
      <p class="text-sm text-ink-muted">
        Preencha o essencial e a IA cria a arte, a legenda e as hashtags.
      </p>
    </header>

    <GeneratorPromptForm :submitting="submitting" @submit="onSubmit" />
  </div>
</template>
