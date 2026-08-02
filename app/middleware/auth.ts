/**
 * Exige sessão ativa. Aplicado nas rotas de `/app`.
 *
 * `waitUntilReady()` é obrigatório: no F5 o middleware roda antes de o SDK
 * restaurar a sessão do IndexedDB. Sem a espera, o usuário logado vê um flash
 * da tela de login a cada recarga — e perde a rota em que estava.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  // Rotas de `/app` são `ssr: false`; no servidor não há sessão para checar.
  if (import.meta.server) return

  const auth = useAuthStore()
  await auth.waitUntilReady()

  if (!auth.isLoggedIn) {
    return navigateTo({
      path: '/login',
      // Preserva o destino para voltar exatamente onde o usuário queria ir.
      query: to.fullPath === '/app' ? undefined : { redirect: to.fullPath },
    })
  }
})
