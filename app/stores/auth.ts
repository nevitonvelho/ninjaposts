// Imports type-only: são apagados na compilação, então não arrastam o SDK do
// Firebase para o chunk de entrada. As funções vêm de `import()` dinâmico.
import type { User } from 'firebase/auth'
import type { Unsubscribe } from 'firebase/firestore'
import { COLLECTIONS } from '#shared/constants'
import type { UserDoc, UserRole } from '#shared/types/user'

/**
 * Estado do documento `users/{uid}`, separado do estado de autenticação.
 *
 * `provisioning` existe porque o documento é criado no servidor logo após o
 * cadastro (§6.2): há uma janela em que o usuário está autenticado mas ainda
 * não tem perfil. Sem este estado explícito, a UI mostraria "0 créditos" para
 * quem acabou de ganhar o bônus de boas-vindas.
 */
export type ProfileStatus = 'idle' | 'loading' | 'ready' | 'provisioning' | 'error'

export const useAuthStore = defineStore('auth', () => {
  const user = shallowRef<User | null>(null)
  const userDoc = ref<UserDoc | null>(null)
  const role = ref<UserRole>('user')

  /** Vira `true` na primeira resposta do Firebase, com ou sem sessão. */
  const initialized = ref(false)
  const profileStatus = ref<ProfileStatus>('idle')
  const profileError = ref<string | null>(null)

  const isLoggedIn = computed(() => Boolean(user.value))
  const isAdmin = computed(() => role.value === 'admin')
  const credits = computed(() => userDoc.value?.credits ?? 0)
  const displayName = computed(
    () => userDoc.value?.displayName || user.value?.displayName || 'Você',
  )
  const photoURL = computed(() => userDoc.value?.photoURL ?? user.value?.photoURL ?? null)

  // ---------------------------------------------------------------------
  // Sincronização
  // ---------------------------------------------------------------------

  let unsubscribeAuth: Unsubscribe | null = null
  let unsubscribeDoc: Unsubscribe | null = null
  let initPromise: Promise<void> | null = null

  /**
   * Guarda contra loop: se o bootstrap falhar, o documento continua ausente e o
   * `onSnapshot` dispararia de novo a cada retry, martelando a API. Uma
   * tentativa por sessão de usuário é suficiente — o refresh da página é a
   * segunda chance.
   */
  let bootstrappedFor: string | null = null

  /**
   * Pede ao servidor a criação de `users/{uid}`.
   *
   * Não criamos o documento aqui no cliente de propósito: ele carrega
   * `credits` e `role`, e as Security Rules negam `create` justamente
   * para impedir que o usuário escolha o próprio saldo.
   */
  async function bootstrapProfile(uid: string) {
    if (bootstrappedFor === uid) return
    bootstrappedFor = uid

    try {
      await useApi().post('/api/me/bootstrap')
      // Não mexemos no estado aqui: o `onSnapshot` já está escutando e recebe
      // o documento recém-criado sozinho.
    } catch (error) {
      profileStatus.value = 'error'
      profileError.value =
        error instanceof ApiRequestError
          ? error.message
          : 'Não foi possível preparar sua conta. Recarregue a página.'
    }
  }

  function stopProfileSync() {
    unsubscribeDoc?.()
    unsubscribeDoc = null
  }

  async function startProfileSync(uid: string) {
    stopProfileSync()
    profileStatus.value = 'loading'
    profileError.value = null

    const { db } = useFirebase()
    const { doc, onSnapshot } = await import('firebase/firestore')

    unsubscribeDoc = onSnapshot(
      doc(db, COLLECTIONS.users, uid),
      (snapshot) => {
        if (!snapshot.exists()) {
          userDoc.value = null
          profileStatus.value = 'provisioning'
          void bootstrapProfile(uid)
          return
        }
        userDoc.value = { ...(snapshot.data() as UserDoc), uid: snapshot.id }
        profileStatus.value = 'ready'
      },
      (error) => {
        userDoc.value = null
        profileStatus.value = 'error'
        profileError.value = firebaseErrorMessage(error)

        if (import.meta.dev && isPermissionDeniedError(error)) {
          console.warn(
            '[auth] leitura de users/{uid} negada. As Security Rules ainda não foram publicadas (Etapa 5).',
          )
        }
      },
    )
  }

  async function syncClaims(current: User) {
    try {
      const token = await current.getIdTokenResult()
      role.value = token.claims.role === 'admin' ? 'admin' : 'user'
    } catch {
      role.value = 'user'
    }
  }

  async function start(): Promise<void> {
    const { auth } = await useFirebaseAsync()
    const { onIdTokenChanged } = await import('firebase/auth')

    return new Promise<void>((resolve) => {
      let settled = false

      /**
       * `onIdTokenChanged` em vez de `onAuthStateChanged`.
       *
       * O segundo só dispara em login/logout. O primeiro dispara também a cada
       * renovação do token — que é quando custom claims recém-atribuídas (como
       * `role: 'admin'`) chegam ao cliente. Com `onAuthStateChanged`, promover
       * alguém a admin só teria efeito no próximo login.
       */
      unsubscribeAuth = onIdTokenChanged(auth, async (current) => {
        user.value = current

        if (current) {
          await syncClaims(current)
          await startProfileSync(current.uid)
        } else {
          stopProfileSync()
          userDoc.value = null
          role.value = 'user'
          profileStatus.value = 'idle'
          profileError.value = null
          bootstrappedFor = null
        }

        initialized.value = true
        if (!settled) {
          settled = true
          resolve()
        }
      })
    })
  }

  /**
   * Resolve quando o Firebase termina de restaurar (ou descartar) a sessão,
   * disparando o carregamento do SDK na primeira chamada.
   *
   * É a peça que evita o bug clássico: ao dar F5 em `/app`, o middleware roda
   * antes de o SDK restaurar a sessão do IndexedDB, vê `user === null` e manda
   * o usuário logado de volta ao login.
   *
   * Como o carregamento é sob demanda, quem nunca visita uma rota autenticada
   * (visitante na landing) não baixa o SDK.
   */
  function waitUntilReady(): Promise<void> {
    return (initPromise ??= start())
  }

  function dispose() {
    unsubscribeAuth?.()
    unsubscribeAuth = null
    stopProfileSync()
  }

  return {
    user,
    userDoc,
    role,
    initialized,
    profileStatus,
    profileError,
    isLoggedIn,
    isAdmin,
    credits,
    displayName,
    photoURL,
    waitUntilReady,
    dispose,
  }
})
