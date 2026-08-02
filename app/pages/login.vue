<script setup lang="ts">
import { loginSchema } from '#shared/utils/validation'

definePageMeta({ layout: 'auth', middleware: 'guest' })
useHead({ title: 'Entrar — NinjaPosts' })

const { loginWithEmail, loginWithGoogle, redirectTarget } = useAuth()

const email = ref('')
const password = ref('')
const showPassword = ref(false)

const errors = ref<Record<string, string[]>>({})
const formError = ref<string | null>(null)
const pendingEmail = ref(false)
const pendingGoogle = ref(false)

async function onSubmit() {
  formError.value = null

  const parsed = loginSchema.safeParse({ email: email.value, password: password.value })
  if (!parsed.success) {
    errors.value = fieldErrors(parsed.error)
    return
  }
  errors.value = {}

  pendingEmail.value = true
  const result = await loginWithEmail(parsed.data.email, parsed.data.password)
  pendingEmail.value = false

  if (result.ok) return navigateTo(redirectTarget())
  formError.value = result.message
}

async function onGoogle() {
  formError.value = null
  pendingGoogle.value = true
  const result = await loginWithGoogle()
  pendingGoogle.value = false

  if (result.ok) return navigateTo(redirectTarget())
  // `message: null` = o usuário fechou o pop-up. Não é erro, não avisa nada.
  formError.value = result.message
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold tracking-tight">Entrar na sua conta</h1>
    <p class="mt-1.5 text-sm text-ink-muted">
      Bom te ver de novo. Vamos criar mais alguns posts?
    </p>

    <div class="mt-8 space-y-5">
      <AuthGoogleButton :loading="pendingGoogle" @click="onGoogle" />

      <AuthDivider />

      <form class="space-y-4" novalidate @submit.prevent="onSubmit">
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

        <UiField label="Senha" :error="errors.password">
          <div class="relative">
            <UiInput
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Sua senha"
              icon="lucide:lock"
              autocomplete="current-password"
              class="pr-10"
            />
            <button
              type="button"
              class="absolute top-1/2 right-1 -translate-y-1/2 rounded-md p-2 text-ink-subtle transition-colors hover:text-ink"
              :aria-label="showPassword ? 'Ocultar senha' : 'Mostrar senha'"
              @click="showPassword = !showPassword"
            >
              <Icon :name="showPassword ? 'lucide:eye-off' : 'lucide:eye'" class="size-4" />
            </button>
          </div>
        </UiField>

        <!--
          Erro de credencial fica no formulário, não em toast: ele precisa
          continuar visível enquanto o usuário corrige o campo.
        -->
        <p
          v-if="formError"
          class="flex items-start gap-2 rounded-md border border-danger/20 bg-danger-soft px-3 py-2.5 text-sm text-danger"
          role="alert"
        >
          <Icon name="lucide:alert-circle" class="mt-0.5 size-4 shrink-0" />
          {{ formError }}
        </p>

        <div class="flex justify-end">
          <NuxtLink
            to="/recuperar-senha"
            class="text-sm font-medium text-brand-600 underline-offset-4 hover:underline"
          >
            Esqueci minha senha
          </NuxtLink>
        </div>

        <UiButton type="submit" block size="lg" :loading="pendingEmail">Entrar</UiButton>
      </form>
    </div>

    <p class="mt-8 text-center text-sm text-ink-muted">
      Ainda não tem conta?
      <NuxtLink to="/cadastro" class="font-medium text-brand-600 underline-offset-4 hover:underline">
        Criar conta grátis
      </NuxtLink>
    </p>
  </div>
</template>
