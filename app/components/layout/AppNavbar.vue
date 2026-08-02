<script setup lang="ts">
const auth = useAuthStore()
const ui = useUiStore()
const { logout } = useAuth()

const profileReady = computed(() => auth.profileStatus === 'ready')

const menuItems = computed(() => [
  { label: 'Perfil', icon: 'lucide:user', to: '/app/perfil' },
  { label: 'Créditos', icon: 'lucide:zap', to: '/app/creditos' },
  ...(auth.isAdmin
    ? [{ label: 'Administração', icon: 'lucide:shield', to: '/admin', separated: true }]
    : []),
  { label: 'Sair', icon: 'lucide:log-out', danger: true, separated: true, onClick: logout },
])
</script>

<template>
  <header
    class="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-canvas/80 px-4 backdrop-blur-md"
  >
    <UiButton
      variant="ghost"
      size="icon"
      class="lg:hidden"
      aria-label="Abrir menu"
      :aria-expanded="ui.sidebarOpen"
      @click="ui.toggleSidebar()"
    >
      <Icon name="lucide:menu" class="size-5" />
    </UiButton>

    <div class="lg:hidden">
      <LayoutAppLogo to="/app" size="sm" :show-text="false" />
    </div>

    <div class="ml-auto flex items-center gap-2">
      <!-- Créditos ficam sempre visíveis: é a informação que decide se a
           pessoa pode gerar agora, e escondê-la num menu gera frustração. -->
      <UiTooltip
        :text="
          profileReady
            ? `${auth.credits} ${auth.credits === 1 ? 'crédito disponível' : 'créditos disponíveis'}`
            : 'Carregando seus créditos…'
        "
      >
        <NuxtLink
          to="/app/creditos"
          class="flex items-center gap-1.5 rounded-md border border-line bg-subtle px-2.5 py-1.5 text-sm font-medium transition-colors hover:border-line-strong hover:bg-muted"
        >
          <Icon name="lucide:zap" class="size-4 text-brand-600" />
          <span class="tabular-nums">{{ profileReady ? auth.credits : '—' }}</span>
          <span class="sr-only">créditos restantes</span>
        </NuxtLink>
      </UiTooltip>

      <UiDropdown :items="menuItems" label="Menu da conta">
        <template #trigger="{ toggle }">
          <button
            type="button"
            class="rounded-full transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2"
            aria-label="Menu da conta"
            @click="toggle"
          >
            <UiAvatar :src="auth.photoURL" :name="auth.displayName" size="sm" />
          </button>
        </template>
      </UiDropdown>
    </div>
  </header>
</template>
