<script setup lang="ts">
import { CREDIT_COST_PER_GENERATION } from '#shared/constants'

definePageMeta({ layout: 'app', middleware: 'auth' })
useHead({ title: 'Início — NinjaPosts' })

const auth = useAuthStore()
const { items, status, isEmpty, missingIndex, error } = useRecentGenerations(6)

/**
 * Sem documento de perfil, `credits` cai para o default 0 — e todo número
 * derivado dele passa a mentir: "você ficou sem créditos" para quem sequer tem
 * conta provisionada ainda.
 *
 * Número errado com ar de certeza é pior que ausência de número. Enquanto o
 * perfil não está `ready`, mostramos travessão e calamos os alertas.
 */
const profileReady = computed(() => auth.profileStatus === 'ready')
const profileLoading = computed(
  () => auth.profileStatus === 'loading' || auth.profileStatus === 'provisioning',
)

const credits = computed(() => auth.credits)
const purchased = computed(() => auth.userDoc?.stats.creditsPurchased ?? 0)
const lowCredits = computed(() => profileReady.value && credits.value <= 2)

/** `—` enquanto o valor real não é conhecido. */
function known<T>(value: T): T | string {
  return profileReady.value ? value : '—'
}

/** Saudação pelo horário — pequeno toque que faz o painel parecer vivo. */
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
})

const firstName = computed(() => auth.displayName.split(' ')[0] ?? auth.displayName)
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-8">
    <!-- Cabeçalho -->
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">
          {{ greeting }}, {{ firstName }}
        </h1>
        <p class="mt-1 text-sm text-ink-muted">
          {{
            isEmpty
              ? 'Vamos criar sua primeira arte?'
              : 'Aqui está o resumo da sua conta.'
          }}
        </p>
      </div>

      <UiButton to="/app/criar" size="lg" icon="lucide:sparkles">Criar post</UiButton>
    </header>

    <!-- Avisos de estado da conta -->
    <div
      v-if="auth.profileStatus === 'error'"
      class="flex gap-3 rounded-lg border border-danger/20 bg-danger-soft p-4 text-sm"
      role="alert"
    >
      <Icon name="lucide:alert-circle" class="mt-0.5 size-4 shrink-0 text-danger" />
      <div class="space-y-1">
        <p class="font-medium text-ink">Não foi possível carregar seu perfil</p>
        <p class="text-ink-muted">{{ auth.profileError }}</p>
      </div>
    </div>

    <div
      v-else-if="auth.profileStatus === 'provisioning'"
      class="flex items-center gap-3 rounded-lg border border-line bg-subtle p-4 text-sm"
    >
      <UiSpinner size="sm" class="text-ink-subtle" />
      <p class="text-ink-muted">Preparando sua conta…</p>
    </div>

    <!-- Métricas -->
    <section aria-label="Resumo da conta">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardStatCard
          label="Créditos disponíveis"
          :value="known(credits)"
          icon="lucide:zap"
          :tone="lowCredits ? 'warning' : 'brand'"
          :hint="profileReady ? 'não expiram' : undefined"
          :loading="profileLoading"
          to="/app/creditos"
        />
        <DashboardStatCard
          label="Artes geradas"
          :value="known(auth.userDoc?.stats.generations ?? 0)"
          icon="lucide:image"
          :hint="profileReady ? 'desde o início' : undefined"
          :loading="profileLoading"
          to="/app/historico"
        />
        <DashboardStatCard
          label="Créditos comprados"
          :value="known(purchased)"
          icon="lucide:shopping-bag"
          :hint="profileReady ? 'total acumulado' : undefined"
          :loading="profileLoading"
          to="/app/creditos"
        />
      </div>
    </section>

    <!--
      Sem saldo não há o que fazer no app: o aviso vira a ação principal, não
      uma barra de progresso decorativa.
    -->
    <UiCard v-if="profileReady && lowCredits">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="font-medium tracking-tight">
            {{ credits === 0 ? 'Você está sem créditos' : 'Seus créditos estão acabando' }}
          </h2>
          <p class="mt-0.5 text-sm text-ink-muted">
            Cada arte custa {{ CREDIT_COST_PER_GENERATION }} crédito. Compre uma vez e use quando quiser.
          </p>
        </div>
        <UiButton to="/app/creditos" icon="lucide:shopping-bag">Comprar créditos</UiButton>
      </div>
    </UiCard>

    <!--
      As artes expiram em 24h (§ retenção). Dizer isso no painel, e não só na
      tela de resultado, é o que evita o suporte "sumiu minha imagem".
    -->
    <p class="flex items-start gap-2 text-sm text-ink-subtle">
      <Icon name="lucide:timer" class="mt-0.5 size-4 shrink-0" />
      <span>As artes geradas ficam disponíveis por 24 horas — baixe o arquivo assim que ficar pronto.</span>
    </p>

    <!-- Últimas artes -->
    <section aria-label="Últimas artes">
      <div class="mb-4 flex items-center justify-between gap-4">
        <h2 class="font-medium tracking-tight">Últimas artes</h2>
        <UiButton
          v-if="!isEmpty && status === 'ready'"
          to="/app/historico"
          variant="ghost"
          size="sm"
          icon-right="lucide:arrow-right"
        >
          Ver tudo
        </UiButton>
      </div>

      <!-- Índice ausente é erro de setup, não de código. A mensagem diz
           exatamente qual comando resolve. -->
      <div
        v-if="missingIndex"
        class="flex gap-3 rounded-lg border border-warning/20 bg-warning-soft p-4 text-sm"
      >
        <Icon name="lucide:database" class="mt-0.5 size-4 shrink-0 text-warning" />
        <div class="space-y-1">
          <p class="font-medium text-ink">Índice do Firestore ainda não foi criado</p>
          <p class="text-ink-muted">
            Rode <code class="rounded bg-canvas px-1.5 py-0.5">npm run firebase:indexes</code> e
            aguarde alguns minutos até o índice ficar pronto.
          </p>
        </div>
      </div>

      <div
        v-else-if="status === 'error'"
        class="flex gap-3 rounded-lg border border-danger/20 bg-danger-soft p-4 text-sm"
        role="alert"
      >
        <Icon name="lucide:alert-circle" class="mt-0.5 size-4 shrink-0 text-danger" />
        <p class="text-ink-muted">{{ error }}</p>
      </div>

      <!-- `idle` entra aqui junto com `loading`: é o instante antes de a
           assinatura começar, e sem isto a seção fica em branco sem explicação. -->
      <div
        v-else-if="status === 'loading' || status === 'idle'"
        class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div v-for="n in 3" :key="n" class="space-y-3">
          <UiSkeleton shape="rect" height="180px" />
          <UiSkeleton :lines="2" />
        </div>
      </div>

      <UiCard v-else-if="isEmpty" flush padding="none">
        <UiEmptyState
          icon="lucide:image-plus"
          title="Nenhuma arte por aqui ainda"
          description="Informe o produto e o preço, escolha um estilo, e a IA cria a arte, a legenda e as hashtags."
        >
          <UiButton to="/app/criar" icon="lucide:sparkles">Criar primeiro post</UiButton>
        </UiEmptyState>
      </UiCard>

      <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <GenerationCard v-for="item in items" :key="item.id" :generation="item" />
      </div>
    </section>
  </div>
</template>
