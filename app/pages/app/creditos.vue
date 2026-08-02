<script setup lang="ts">
import { CREDIT_COST_PER_GENERATION, PACK_LIST, packSavings, pricePerCredit } from '#shared/constants'

definePageMeta({ layout: 'app', middleware: 'auth' })
useHead({ title: 'Créditos — CriaPosts' })

const auth = useAuthStore()
const { balance, ready } = useCredits()
const { result: claimResult, blockedByVerification, claim } = usePurchaseClaim()
const { resendVerification, pending: authPending } = useAuth()
const toast = useToast()

/**
 * Reconsulta ao entrar na tela.
 *
 * O layout já tenta reivindicar uma vez por sessão, mas esta é a página em que
 * a pessoa aterrissa depois de comprar — e o webhook pode ter chegado depois
 * daquela primeira tentativa.
 */
onMounted(() => void claim())

async function onResend() {
  const result = await resendVerification()
  if (result.ok) {
    toast.success({
      title: 'E-mail de confirmação enviado',
      description: 'Confirme e volte aqui — seus créditos entram na hora.',
    })
  } else if (result.message) {
    toast.error(result.message)
  }
}

/**
 * O checkout é hospedado pela Kiwify: saímos do app com um link direto.
 *
 * `target="_blank"` de propósito — voltar do pagamento para a mesma aba com o
 * saldo já atualizado é melhor que perder a sessão do app no meio da compra.
 * O crédito entra pelo webhook, não pelo retorno do navegador, então não
 * dependemos de o usuário voltar.
 */
const packs = PACK_LIST
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-8">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold tracking-tight">Créditos</h1>
      <p class="text-sm text-ink-muted">
        Compre uma vez, use quando quiser. Créditos não expiram.
      </p>
    </header>

    <!--
      Compra travada por e-mail não confirmado. É o pior estado possível do
      produto — a pessoa pagou e não recebeu — então vem antes do saldo, com a
      ação de resolver do lado.
    -->
    <div
      v-if="blockedByVerification"
      class="flex flex-wrap items-center gap-4 rounded-lg border border-warning/20 bg-warning-soft p-4"
      role="alert"
    >
      <Icon name="lucide:mail-warning" class="size-5 shrink-0 text-warning" />
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink">
          {{ claimResult?.pending }}
          {{ claimResult?.pending === 1 ? 'crédito esperando' : 'créditos esperando' }}
          por você
        </p>
        <p class="mt-0.5 text-sm text-ink-muted">
          Encontramos sua compra. Confirme o e-mail
          <strong class="font-medium text-ink">{{ auth.userDoc?.email }}</strong>
          para liberar — é o que impede outra pessoa de reivindicar a sua compra.
        </p>
      </div>
      <UiButton variant="secondary" :loading="authPending" @click="onResend">
        Reenviar e-mail
      </UiButton>
    </div>

    <UiCard>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <span class="grid size-12 place-items-center rounded-lg bg-brand-50 text-brand-600">
            <Icon name="lucide:zap" class="size-6" />
          </span>
          <div>
            <p class="text-sm text-ink-muted">Seu saldo</p>
            <p class="text-2xl font-semibold tracking-tight tabular-nums">
              {{ ready ? balance : '—' }}
              <span class="text-base font-normal text-ink-muted">
                {{ balance === 1 ? 'crédito' : 'créditos' }}
              </span>
            </p>
          </div>
        </div>

        <p class="text-sm text-ink-muted">
          Cada arte custa
          <strong class="font-medium text-ink">{{ CREDIT_COST_PER_GENERATION }} crédito</strong>.
          Gerar de novo custa o mesmo.
        </p>
      </div>
    </UiCard>

    <section aria-label="Pacotes de crédito" class="grid gap-4 md:grid-cols-3">
      <UiCard
        v-for="pack in packs"
        :key="pack.id"
        :class="pack.highlighted && 'ring-1 ring-brand-500'"
      >
        <div class="flex h-full flex-col">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="font-medium tracking-tight">{{ pack.name }}</h2>
              <p class="mt-1 text-sm text-ink-muted">{{ pack.description }}</p>
            </div>
            <UiBadge v-if="pack.highlighted" tone="brand" size="sm">Mais escolhido</UiBadge>
          </div>

          <p class="mt-5 text-3xl font-semibold tracking-tight">
            {{ formatPriceCents(pack.priceCents) }}
          </p>
          <p class="mt-1 text-sm text-ink-muted">
            {{ pack.credits }} créditos ·
            {{ formatPriceCents(pricePerCredit(pack)) }} por arte
          </p>

          <UiBadge v-if="packSavings(pack)" tone="success" size="sm" class="mt-3 self-start">
            Economize {{ packSavings(pack) }}%
          </UiBadge>

          <UiButton
            :href="pack.checkoutUrl"
            target="_blank"
            rel="noopener"
            :variant="pack.highlighted ? 'primary' : 'secondary'"
            block
            class="mt-6"
            icon-right="lucide:external-link"
          >
            Comprar
          </UiButton>
        </div>
      </UiCard>
    </section>

    <UiCard title="Como funciona">
      <ul class="space-y-3 text-sm text-ink-muted">
        <li class="flex gap-3">
          <Icon name="lucide:infinity" class="mt-0.5 size-4 shrink-0 text-ink-subtle" />
          <span>
            <strong class="font-medium text-ink">Créditos não expiram.</strong>
            Eles acumulam a cada compra e ficam na conta até você usar.
          </span>
        </li>
        <li class="flex gap-3">
          <Icon name="lucide:mail-check" class="mt-0.5 size-4 shrink-0 text-ink-subtle" />
          <span>
            <strong class="font-medium text-ink">Compre com o mesmo e-mail da conta</strong>
            ({{ auth.userDoc?.email || 'o e-mail deste cadastro' }}) — é por ele que os créditos
            entram automaticamente.
          </span>
        </li>
        <li class="flex gap-3">
          <Icon name="lucide:timer" class="mt-0.5 size-4 shrink-0 text-ink-subtle" />
          <span>
            <strong class="font-medium text-ink">As artes ficam disponíveis por 24 horas.</strong>
            Depois disso são apagadas — baixe o arquivo assim que ficar pronto.
          </span>
        </li>
      </ul>
    </UiCard>

    <!-- Extrato e histórico de compras entram na Etapa 10, com o webhook. -->
  </div>
</template>
