<script setup lang="ts">
import { STYLE_LIST } from '#shared/constants'
import type { StyleId } from '#shared/types/generation'

definePageMeta({ layout: 'app', middleware: 'auth' })
useHead({ title: 'Perfil — NinjaPosts' })

const auth = useAuthStore()
const { form, dirty, saving, errorFor, save, reset } = useProfileForm()
const { confirm } = useDialog()

const styleOptions = computed(() => [
  { value: '', label: 'Deixar a IA escolher' },
  ...STYLE_LIST.map(style => ({ value: style.id, label: `${style.label} — ${style.description}` })),
])

const defaultStyle = computed({
  get: () => form.value.brand.defaultStyle ?? '',
  set: (value: string | null) => {
    form.value.brand.defaultStyle = (value || null) as StyleId | null
  },
})

/**
 * Sair com alteração pendente é a forma mais fácil de perder o número do
 * WhatsApp que a pessoa acabou de digitar — e o formulário não é salvo
 * automaticamente porque cada gravação vale uma escrita no Firestore.
 */
onBeforeRouteLeave(async () => {
  if (!dirty.value) return true
  return await confirm({
    title: 'Sair sem salvar?',
    description: 'As alterações que você fez no perfil serão perdidas.',
    confirmLabel: 'Sair sem salvar',
    tone: 'danger',
    icon: 'lucide:triangle-alert',
  })
})
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6 pb-24">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold tracking-tight">Perfil</h1>
      <p class="text-sm text-ink-muted">
        O que você configura aqui vira o padrão de todo post — sem redigitar nada.
      </p>
    </header>

    <!-- Conta -->
    <UiCard>
      <template #header>
        <div class="flex items-center gap-3">
          <UiAvatar :src="auth.photoURL" :name="auth.displayName" size="lg" />
          <div class="min-w-0">
            <h2 class="font-medium tracking-tight text-ink">Sua conta</h2>
            <p class="truncate text-sm text-ink-muted">{{ auth.userDoc?.email }}</p>
          </div>
        </div>
      </template>

      <div class="grid gap-5 sm:grid-cols-2">
        <UiField label="Seu nome" required :error="errorFor('displayName')">
          <UiInput v-model="form.displayName" autocomplete="name" placeholder="Como te chamamos" />
        </UiField>

        <UiField
          label="Empresa"
          hint="Uso interno. O nome que aparece na arte é o do estabelecimento, abaixo."
          :error="errorFor('company')"
        >
          <UiInput v-model="form.company" autocomplete="organization" placeholder="Opcional" />
        </UiField>
      </div>
    </UiCard>

    <!-- Estabelecimento -->
    <UiCard>
      <template #header>
        <div class="flex items-start gap-3">
          <span class="grid size-9 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-600">
            <Icon name="lucide:store" class="size-5" />
          </span>
          <div>
            <h2 class="font-medium tracking-tight text-ink">Seu estabelecimento</h2>
            <p class="mt-0.5 text-sm text-ink-muted">
              Contato, endereço e redes. Você escolhe em cada post o que aparece na arte.
            </p>
          </div>
        </div>
      </template>

      <ProfileBusinessFields v-model="form.brand.business" />
    </UiCard>

    <!-- Marca -->
    <UiCard>
      <template #header>
        <div class="flex items-start gap-3">
          <span class="grid size-9 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-600">
            <Icon name="lucide:palette" class="size-5" />
          </span>
          <div>
            <h2 class="font-medium tracking-tight text-ink">Sua marca</h2>
            <p class="mt-0.5 text-sm text-ink-muted">
              Logo, cores e estilo que a IA usa por padrão em cada arte.
            </p>
          </div>
        </div>
      </template>

      <div class="space-y-8">
        <UiField label="Logo" hint="PNG com fundo transparente é o que rende a melhor aplicação.">
          <BrandLogoUpload v-model="form.brand.logoPath" />
        </UiField>

        <UiField
          label="Cores da marca"
          hint="A primeira é a dominante da arte."
          :error="errorFor('brand.colors')"
        >
          <BrandColorPicker v-model="form.brand.colors" />
        </UiField>

        <UiField label="Estilo padrão" hint="Dá para trocar em qualquer post.">
          <UiSelect v-model="defaultStyle" :options="styleOptions" />
        </UiField>
      </div>
    </UiCard>

    <!--
      Barra fixa em vez de botão no fim da página: com três cartões, quem editar
      o primeiro campo teria de rolar tudo para descobrir que existe um Salvar.
    -->
    <Transition
      enter-active-class="transition duration-200 ease-out-soft"
      enter-from-class="translate-y-4 opacity-0"
      leave-active-class="transition duration-150 ease-out-soft"
      leave-to-class="translate-y-4 opacity-0"
    >
      <div
        v-if="dirty"
        class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/95 p-4 backdrop-blur"
      >
        <div class="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <p class="text-sm text-ink-muted">Você tem alterações não salvas.</p>
          <div class="flex items-center gap-2">
            <UiButton variant="ghost" :disabled="saving" @click="reset">Descartar</UiButton>
            <UiButton icon="lucide:check" :loading="saving" @click="save">Salvar</UiButton>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
