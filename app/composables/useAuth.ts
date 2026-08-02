import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth'

export interface AuthResult {
  ok: boolean
  message: string | null
}

const ok: AuthResult = { ok: true, message: null }

function fail(error: unknown): AuthResult {
  return { ok: false, message: firebaseErrorMessage(error) }
}

/**
 * Ações de autenticação.
 *
 * Devolvem `AuthResult` em vez de lançar: erro de login é fluxo esperado, não
 * excepcional, e cada tela decide se mostra a mensagem inline (login) ou como
 * toast (ações secundárias). `try/catch` em cada `@submit` seria ruído.
 */
export function useAuth() {
  const pending = ref(false)

  /** Para onde ir depois de entrar — respeita o `?redirect=` do middleware. */
  function redirectTarget(): string {
    const route = useRoute()
    const target = route.query.redirect

    // Só caminho interno: aceitar URL absoluta aqui seria um open redirect.
    if (typeof target === 'string' && target.startsWith('/') && !target.startsWith('//')) {
      return target
    }
    return '/app'
  }

  async function run(action: () => Promise<unknown>): Promise<AuthResult> {
    pending.value = true
    try {
      await action()
      return ok
    } catch (error) {
      if (isUserCancelledError(error)) return { ok: false, message: null }
      return fail(error)
    } finally {
      pending.value = false
    }
  }

  async function loginWithEmail(email: string, password: string): Promise<AuthResult> {
    const { auth } = await useFirebaseAsync()
    return run(() => signInWithEmailAndPassword(auth, email, password))
  }

  async function loginWithGoogle(): Promise<AuthResult> {
    const { auth } = await useFirebaseAsync()
    const provider = new GoogleAuthProvider()
    // Força a escolha da conta: sem isso, quem tem várias contas Google entra
    // sempre na primeira e não entende por que "não é a minha conta".
    provider.setCustomParameters({ prompt: 'select_account' })
    return run(() => signInWithPopup(auth, provider))
  }

  async function register(
    displayName: string,
    email: string,
    password: string,
  ): Promise<AuthResult> {
    const { auth } = await useFirebaseAsync()
    return run(async () => {
      const credential = await createUserWithEmailAndPassword(auth, email, password)
      // Grava o nome no perfil de Auth para o trigger do servidor já encontrá-lo
      // ao criar `users/{uid}` — evita um usuário sem nome no primeiro acesso.
      await updateProfile(credential.user, { displayName })

      /**
       * Confirmação de e-mail não é formalidade aqui: é o que libera compras
       * feitas antes do cadastro (§8.2). Sem ela, quem comprou e só depois
       * criou a conta fica com o crédito preso.
       *
       * A falha é engolida de propósito — cota de envio estourada não pode
       * transformar um cadastro bem-sucedido em erro na tela. O usuário pode
       * reenviar depois, pela tela de créditos.
       */
      await sendEmailVerification(credential.user).catch((error) => {
        console.warn('[auth] não foi possível enviar o e-mail de verificação', error)
      })

      await credential.user.getIdToken(true)
    })
  }

  /** Reenvia a confirmação de e-mail para o usuário logado. */
  async function resendVerification(): Promise<AuthResult> {
    const { auth } = await useFirebaseAsync()
    const current = auth.currentUser

    if (!current) return { ok: false, message: 'Entre novamente para reenviar o e-mail.' }
    if (current.emailVerified) return ok

    return run(() => sendEmailVerification(current))
  }

  async function resetPassword(email: string): Promise<AuthResult> {
    const { auth } = await useFirebaseAsync()
    try {
      await sendPasswordResetEmail(auth, email)
    } catch (error) {
      // Erro real de rede/limite ainda é reportado.
      const code = (error as { code?: string })?.code
      if (code !== 'auth/user-not-found' && code !== 'auth/invalid-credential') {
        return fail(error)
      }
      // Silenciamos "usuário não encontrado" de propósito: responder de forma
      // diferente para e-mail existente e inexistente entrega a lista de quem
      // tem conta no serviço para qualquer um que teste endereços.
    }
    return ok
  }

  async function logout(): Promise<void> {
    const { auth } = await useFirebaseAsync()
    // O listener continua ativo de propósito: é ele que zera `user`, `role` e o
    // documento do perfil ao receber o evento de logout. Removê-lo antes do
    // `signOut` deixaria o store achando que ainda há sessão.
    await signOut(auth)
    await navigateTo('/login')
  }

  return {
    pending: readonly(pending),
    redirectTarget,
    loginWithEmail,
    loginWithGoogle,
    register,
    resendVerification,
    resetPassword,
    logout,
  }
}
