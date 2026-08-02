<script setup lang="ts">
import { emailSchema } from '#shared/utils/validation'

definePageMeta({ layout: 'auth', middleware: 'guest' })
useHead({ title: 'Recuperar senha — CriaPosts' })

const { resetPassword } = useAuth()

const email = ref('')
const errors = ref<Record<string, string[]>>({})
const formError = ref<string | null>(null)
const pending = ref(false)
const sent = ref(false)

async function onSubmit() {
  formError.value = null

  const parsed = emailSchema.safeParse(email.value)
  if (!parsed.success) {
    errors.value = { email: parsed.error.issues.map(i => i.message) }
    return
  }
  errors.value = {}

  pending.value = true
  const result = await resetPassword(parsed.data)
  pending.value = false

  if (result.ok) sent.value = true
  else formError.value = result.message
}
</script>

<template>
  <div>
    <!--
      A confirmação é a mesma tenha o e-mail conta ou não. Dizer "este e-mail
      não está cadastrado" entregaria a lista de clientes para quem testasse
      endereços em sequência.
    -->
    <template v-if="sent">
      <div class="grid size-11 place-items-center rounded-xl bg-success-soft text-success">
        <Icon name="lucide:mail-check" class="size-5" />
      </div>

      <h1 class="mt-5 text-2xl font-semibold tracking-tight">Verifique seu e-mail</h1>
      <p class="mt-2 text-sm text-ink-muted">
        Se houver uma conta associada a <strong class="text-ink">{{ email }}</strong>, enviamos um
        link para redefinir a senha. O link vale por 1 hora.
      </p>

      <div class="mt-8 space-y-3">
        <UiButton to="/login" block size="lg">Voltar para o login</UiButton>
        <UiButton variant="ghost" block @click="sent = false">
          Usar outro e-mail
        </UiButton>
      </div>

      <p class="mt-6 text-center text-xs text-ink-subtle">
        Não recebeu? Verifique a caixa de spam antes de tentar de novo.
      </p>
    </template>

    <template v-else>
      <h1 class="text-2xl font-semibold tracking-tight">Recuperar senha</h1>
      <p class="mt-1.5 text-sm text-ink-muted">
        Informe seu e-mail e enviamos um link para você criar uma nova senha.
      </p>

      <form class="mt-8 space-y-4" novalidate @submit.prevent="onSubmit">
        <UiField label="E-mail" :error="errors.email">
          <UiInput
            v-model="email"
            type="email"
            placeholder="voce@empresa.com.br"
            icon="lucide:mail"
            autocomplete="email"
            autofocus
          />
        </UiField>

        <p
          v-if="formError"
          class="flex items-start gap-2 rounded-md border border-danger/20 bg-danger-soft px-3 py-2.5 text-sm text-danger"
          role="alert"
        >
          <Icon name="lucide:alert-circle" class="mt-0.5 size-4 shrink-0" />
          {{ formError }}
        </p>

        <UiButton type="submit" block size="lg" :loading="pending">
          Enviar link de recuperação
        </UiButton>
      </form>

      <p class="mt-8 text-center text-sm text-ink-muted">
        Lembrou a senha?
        <NuxtLink to="/login" class="font-medium text-brand-600 underline-offset-4 hover:underline">
          Entrar
        </NuxtLink>
      </p>
    </template>
  </div>
</template>
