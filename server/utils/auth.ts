import type { H3Event } from 'h3'
import type { UserRole } from '#shared/types/user'

export interface AuthContext {
  uid: string
  email: string | null
  name: string | null
  picture: string | null
  role: UserRole
  emailVerified: boolean
}

/**
 * Autentica a requisição pelo ID token do Firebase.
 *
 * Usamos header `Authorization: Bearer <idToken>` em vez de session cookie
 * porque a área logada é SPA (§0.1): o SDK web já mantém e renova o token, e
 * cookie de sessão exigiria um endpoint extra de troca, além de expor a API a
 * CSRF — que com Bearer simplesmente não existe.
 *
 * `verifyIdToken` valida assinatura, emissor, expiração e audiência. É a única
 * fonte de identidade aceita pela API; nada vindo do corpo da requisição conta.
 */
export async function requireAuth(event: H3Event): Promise<AuthContext> {
  const header = getRequestHeader(event, 'authorization')

  if (!header?.startsWith('Bearer ')) {
    throw apiError('unauthenticated', 'Sessão não encontrada. Entre novamente.')
  }

  const token = header.slice(7).trim()
  if (!token) {
    throw apiError('unauthenticated', 'Sessão não encontrada. Entre novamente.')
  }

  const { auth } = useFirebaseAdmin()

  try {
    const decoded = await auth.verifyIdToken(token)

    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      name: decoded.name ?? null,
      picture: decoded.picture ?? null,
      role: decoded.role === 'admin' ? 'admin' : 'user',
      emailVerified: decoded.email_verified ?? false,
    }
  } catch (error) {
    const code = (error as { code?: string })?.code

    if (code === 'auth/id-token-expired') {
      throw apiError('unauthenticated', 'Sua sessão expirou. Entre novamente.')
    }
    if (code === 'auth/id-token-revoked' || code === 'auth/user-disabled') {
      throw apiError('unauthenticated', 'Sua sessão foi encerrada. Entre novamente.')
    }
    if (code?.startsWith('auth/')) {
      // Token malformado ou assinatura inválida: não damos detalhe ao cliente.
      console.warn('[auth] verifyIdToken rejeitou o token:', code)
      throw apiError('unauthenticated', 'Sessão inválida. Entre novamente.')
    }

    /**
     * Aqui a falha não é do token — é nossa.
     *
     * Sem credencial do Admin SDK, `verifyIdToken` estoura ao resolver o
     * projeto, e tratar isso como 401 faria toda a base de usuários ver
     * "sessão inválida" enquanto o problema real é configuração do servidor.
     * Um 500 com log explícito aponta para o lugar certo em segundos.
     */
    console.error(
      '[auth] falha ao verificar o token — provável problema de credencial do Admin SDK.\n' +
        'Configure NUXT_FIREBASE_CLIENT_EMAIL e NUXT_FIREBASE_PRIVATE_KEY no .env, ' +
        'ou rode `gcloud auth application-default login`.',
      error,
    )
    throw apiError(
      'internal',
      'Não foi possível validar sua sessão no servidor. Tente novamente em instantes.',
    )
  }
}

/**
 * Exige a custom claim `role: 'admin'`.
 *
 * A claim vem do token assinado pelo Firebase, não de um campo do Firestore —
 * então não há como forjá-la no cliente, e não custa uma leitura extra.
 */
export async function requireAdmin(event: H3Event): Promise<AuthContext> {
  const context = await requireAuth(event)

  if (context.role !== 'admin') {
    throw apiError('forbidden', 'Você não tem acesso a esta área.')
  }
  return context
}
