<script setup lang="ts">
import { registerSchema } from '#shared/utils/validation'
import { SIGNUP_BONUS_CREDITS } from '#shared/constants'

definePageMeta({ layout: 'auth', middleware: 'guest' })
useHead({ title: 'Criar conta — NinjaPosts' })

const { register, loginWithGoogle, redirectTarget } = useAuth()

const displayName = ref('')
const email = ref('')
const password = ref('')
const showPassword = ref(false)

const errors = ref<Record<string, string[]>>({})
const formError = ref<string | null>(null)
const pendingEmail = ref(false)
const pendingGoogle = ref(false)

/** Feedback de força enquanto digita — evita descobrir o problema só no submit. */
const passwordStrength = computed(() => {
  const value = password.value
  if (!value) return null

  let score = 0
  if (value.length >= 8) score++
  if (value.length >= 12) score++
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++
  if (/\d/.test(value)) score++
  if (/[^\w\s]/.test(value)) score++

  if (score <= 2) return { label: 'Fraca', tone: 'danger' as const, value: 33 }
  if (score === 3) return { label: 'Média', tone: 'brand' as const, value: 66 }
  return { label: 'Forte', tone: 'success' as const, value: 100 }
})

async function onSubmit() {
  formError.value = null

  const parsed = registerSchema.safeParse({
    displayName: displayName.value,
    email: email.value,
    password: password.value,
  })
  if (!parsed.success) {
    errors.value = fieldErrors(parsed.error)
    return
  }
  errors.value = {}

  pendingEmail.value = true
  const result = await register(parsed.data.displayName, parsed.data.email, parsed.data.password)
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
  formError.value = result.message
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold tracking-tight">Criar sua conta</h1>
    <p class="mt-1.5 text-sm text-ink-muted">
      Ganhe {{ SIGNUP_BONUS_CREDITS }} créditos para testar. Sem cartão de crédito.
    </p>

    <div class="mt-8 space-y-5">
      <AuthGoogleButton :loading="pendingGoogle" label="Cadastrar com Google" @click="onGoogle" />

      <AuthDivider />

      <form class="space-y-4" novalidate @submit.prevent="onSubmit">
        <UiField label="Seu nome" :error="errors.displayName">
          <UiInput
            v-model="displayName"
            placeholder="Como podemos te chamar?"
            icon="lucide:user"
            autocomplete="name"
            autofocus
          />
        </UiField>

        <UiField label="E-mail" :error="errors.email">
          <UiInput
            v-model="email"
            type="email"
            placeholder="voce@empresa.com.br"
            icon="lucide:mail"
            autocomplete="email"
          />
        </UiField>

        <UiField label="Senha" :error="errors.password" hint="Pelo menos 8 caracteres">
          <div class="relative">
            <UiInput
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Crie uma senha"
              icon="lucide:lock"
              autocomplete="new-password"
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

        <div v-if="passwordStrength" class="flex items-center gap-3">
          <UiProgress
            :value="passwordStrength.value"
            :tone="passwordStrength.tone"
            size="sm"
            label="Força da senha"
          />
          <span class="w-12 shrink-0 text-xs font-medium text-ink-muted">
            {{ passwordStrength.label }}
          </span>
        </div>

        <p
          v-if="formError"
          class="flex items-start gap-2 rounded-md border border-danger/20 bg-danger-soft px-3 py-2.5 text-sm text-danger"
          role="alert"
        >
          <Icon name="lucide:alert-circle" class="mt-0.5 size-4 shrink-0" />
          {{ formError }}
        </p>

        <UiButton type="submit" block size="lg" :loading="pendingEmail">
          Criar conta grátis
        </UiButton>
      </form>
    </div>

    <p class="mt-8 text-center text-sm text-ink-muted">
      Já tem conta?
      <NuxtLink to="/login" class="font-medium text-brand-600 underline-offset-4 hover:underline">
        Entrar
      </NuxtLink>
    </p>
  </div>
</template>
