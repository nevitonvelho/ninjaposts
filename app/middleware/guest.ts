/**
 * Impede que alguém já logado veja login/cadastro.
 * Sem isto, voltar no navegador depois de entrar mostra o formulário de login
 * de novo, o que parece que a sessão caiu.
 */
export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) return

  const auth = useAuthStore()
  await auth.waitUntilReady()

  if (auth.isLoggedIn) return navigateTo('/app')
})
