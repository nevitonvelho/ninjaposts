<script setup lang="ts">
const ui = useUiStore()
const route = useRoute()
const auth = useAuthStore()
const toast = useToast()
const { claim } = usePurchaseClaim()

/**
 * Compras feitas antes do cadastro são reivindicadas assim que o perfil carrega.
 *
 * Mora no layout, e não numa página: quem comprou e depois se cadastrou pode
 * entrar por qualquer rota do app, e esperar que ele visite `/app/creditos`
 * para receber o que já pagou seria péssimo. É idempotente no servidor, então
 * a única garantia necessária aqui é não disparar duas vezes por sessão.
 */
const claimed = ref(false)
watch(
  () => auth.profileStatus,
  async (status) => {
    if (status !== 'ready' || claimed.value) return
    claimed.value = true

    const result = await claim()
    if (result && result.credits > 0) {
      toast.success({
        title: `${result.credits} ${result.credits === 1 ? 'crédito liberado' : 'créditos liberados'}`,
        description: 'Sua compra foi vinculada a esta conta.',
      })
    }
  },
  { immediate: true },
)

// Trocar de rota no mobile fecha o drawer — senão ele fica sobre a página nova.
watch(() => route.fullPath, () => ui.toggleSidebar(false))

onKeyStroke('Escape', () => {
  if (ui.sidebarOpen) ui.toggleSidebar(false)
})

// Trava o scroll do fundo enquanto o drawer está aberto.
watch(
  () => ui.sidebarOpen,
  (open) => {
    if (import.meta.client) document.documentElement.classList.toggle('overflow-hidden', open)
  },
)
onUnmounted(() => {
  if (import.meta.client) document.documentElement.classList.remove('overflow-hidden')
})
</script>

<template>
  <div class="min-h-dvh bg-canvas">
    <!--
      Link de pular navegação: primeiro elemento focável da página. Para quem
      navega por teclado, é o que evita percorrer a sidebar inteira a cada
      troca de rota.
    -->
    <a
      href="#conteudo"
      class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink-inverse"
    >
      Pular para o conteúdo
    </a>

    <!-- Sidebar fixa no desktop -->
    <aside
      class="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-line bg-subtle lg:block"
    >
      <LayoutAppSidebar />
    </aside>

    <!-- Drawer no mobile -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-if="ui.sidebarOpen"
        class="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm lg:hidden"
        @click="ui.toggleSidebar(false)"
      />
    </Transition>

    <Transition
      enter-active-class="transition-transform duration-250 ease-spring"
      enter-from-class="-translate-x-full"
      leave-active-class="transition-transform duration-200 ease-out-soft"
      leave-to-class="-translate-x-full"
    >
      <aside
        v-if="ui.sidebarOpen"
        class="fixed inset-y-0 left-0 z-50 w-72 border-r border-line bg-canvas lg:hidden"
      >
        <LayoutAppSidebar />
      </aside>
    </Transition>

    <div class="lg:pl-64">
      <LayoutAppNavbar />

      <main id="conteudo" class="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <slot />
      </main>
    </div>
  </div>
</template>
