<script setup lang="ts">
const route = useRoute()
const auth = useAuthStore()
const ui = useUiStore()

/**
 * Sem perfil carregado, `credits` é o default 0 — anunciar "seus créditos
 * acabaram" com base nisso seria alarme falso.
 */
const profileReady = computed(() => auth.profileStatus === 'ready')

const noCredits = computed(() => profileReady.value && auth.credits === 0)
/** Sem cota mensal para comparar, "pouco" é um número absoluto. */
const lowCredits = computed(() => profileReady.value && auth.credits > 0 && auth.credits <= 2)
</script>

<template>
  <nav class="flex h-full flex-col gap-1 p-3" aria-label="Navegação principal">
    <div class="px-2 py-3">
      <LayoutAppLogo to="/app" size="sm" />
    </div>

    <UiButton to="/app/criar" icon="lucide:plus" block class="mb-2" @click="ui.toggleSidebar(false)">
      Criar post
    </UiButton>

    <ul class="space-y-0.5">
      <li v-for="item in APP_NAV" :key="item.to">
        <NuxtLink
          :to="item.to"
          :aria-current="isNavActive(item, route.path) ? 'page' : undefined"
          :class="
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
              'transition-colors duration-150 ease-out-soft',
              isNavActive(item, route.path)
                ? 'bg-muted text-ink'
                : 'text-ink-muted hover:bg-subtle hover:text-ink',
            )
          "
          @click="ui.toggleSidebar(false)"
        >
          <Icon :name="item.icon" class="size-[18px] shrink-0" />
          {{ item.label }}
        </NuxtLink>
      </li>
    </ul>

    <div class="mt-auto space-y-0.5 pt-4">
      <ul class="space-y-0.5">
        <li v-for="item in APP_NAV_SECONDARY" :key="item.to">
          <NuxtLink
            :to="item.to"
            :aria-current="isNavActive(item, route.path) ? 'page' : undefined"
            :class="
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                'transition-colors duration-150 ease-out-soft',
                isNavActive(item, route.path)
                  ? 'bg-muted text-ink'
                  : 'text-ink-muted hover:bg-subtle hover:text-ink',
              )
            "
            @click="ui.toggleSidebar(false)"
          >
            <Icon :name="item.icon" class="size-[18px] shrink-0" />
            {{ item.label }}
            <UiBadge
              v-if="item.badge === 'credits'"
              size="sm"
              :tone="lowCredits ? 'warning' : 'neutral'"
              class="ml-auto tabular-nums"
            >
              {{ profileReady ? auth.credits : '—' }}
            </UiBadge>
          </NuxtLink>
        </li>
      </ul>

      <!--
        O CTA só aparece quando o saldo acabou ou está no fim. Um banner
        permanente vira ruído e some da percepção exatamente quando importaria.
      -->
      <div
        v-if="noCredits || lowCredits"
        class="mt-3 rounded-lg border border-brand-100 bg-brand-50 p-3.5"
      >
        <p class="text-sm font-medium text-brand-900">
          {{ noCredits ? 'Você está sem créditos' : 'Seus créditos estão acabando' }}
        </p>
        <p class="mt-1 text-xs text-brand-700">
          {{
            noCredits
              ? 'Compre um pacote para voltar a criar. Créditos não expiram.'
              : `Resta${auth.credits === 1 ? '' : 'm'} ${auth.credits} crédito${auth.credits === 1 ? '' : 's'}.`
          }}
        </p>
        <UiButton
          to="/app/creditos"
          size="sm"
          block
          class="mt-3"
          @click="ui.toggleSidebar(false)"
        >
          Comprar créditos
        </UiButton>
      </div>
    </div>
  </nav>
</template>
