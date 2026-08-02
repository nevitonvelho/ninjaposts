/**
 * Restringe as rotas de `/admin` a quem tem a custom claim `role: 'admin'`.
 *
 * Isto é UX, não segurança. Qualquer pessoa pode editar o JS no navegador e
 * renderizar a tela — o que protege os dados de verdade são as Security Rules
 * e a checagem de claim na API (`requireAdmin`). O middleware só evita que um
 * usuário comum chegue a uma tela quebrada e cheia de erros de permissão.
 */
export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) return

  const auth = useAuthStore()
  await auth.waitUntilReady()

  if (!auth.isLoggedIn) return navigateTo('/login')

  if (!auth.isAdmin) {
    return abortNavigation({
      statusCode: 403,
      statusMessage: 'Você não tem acesso a esta área.',
    })
  }
})
