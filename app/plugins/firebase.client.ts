import type { FirebaseApp } from 'firebase/app'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import type { FirebaseStorage } from 'firebase/storage'

export interface FirebaseServices {
  app: FirebaseApp
  auth: Auth
  db: Firestore
  storage: FirebaseStorage
}

export interface FirebaseLoader {
  /** Inicializa (uma única vez) e devolve as instâncias. */
  load: () => Promise<FirebaseServices>
  /** Acesso síncrono. Lança se `load()` ainda não terminou. */
  get: () => FirebaseServices
  readonly ready: boolean
}

/**
 * O SDK do Firebase é carregado por `import()` dinâmico, nunca estaticamente.
 *
 * Motivo medido: o SDK são ~600KB. Importado no topo de um plugin, ele entra no
 * chunk de entrada e passa a ser baixado em **toda** rota — inclusive na landing
 * prerenderizada, que é a página mais sensível a LCP e não usa Firebase para
 * nada. Com `import()`, ele vira um chunk à parte, buscado só quando alguém
 * realmente precisa de sessão.
 *
 * Os `import type` acima são apagados na compilação — custam zero em runtime.
 */
export default defineNuxtPlugin({
  name: 'firebase',
  setup() {
    const { firebase: config, useEmulators } = useRuntimeConfig().public

    let services: FirebaseServices | null = null
    let pending: Promise<FirebaseServices> | null = null

    async function initialize(): Promise<FirebaseServices> {
      if (!config.apiKey || !config.projectId) {
        throw new Error(
          'Firebase não configurado. Preencha as variáveis NUXT_PUBLIC_FIREBASE_* no .env.',
        )
      }

      const [appMod, authMod, firestoreMod, storageMod] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/firestore'),
        import('firebase/storage'),
      ])

      // O HMR do Vite reexecuta plugins; sem esta guarda o SDK reclama de app duplicado.
      const app = appMod.getApps()[0] ?? appMod.initializeApp({ ...config })
      const auth = authMod.getAuth(app)

      /**
       * `initializeFirestore` (e não `getFirestore`) para ligar o cache persistente.
       *
       * O ganho aparece no produto: histórico e dashboard abrem instantaneamente
       * na segunda visita, e `onSnapshot` entrega o dado do cache antes de a rede
       * responder. `persistentMultipleTabManager` mantém as abas coerentes — sem
       * ele, abrir o app em duas abas derruba o cache de uma delas.
       */
      const db = firestoreMod.initializeFirestore(app, {
        localCache: firestoreMod.persistentLocalCache({
          tabManager: firestoreMod.persistentMultipleTabManager(),
        }),
      })

      const storage = storageMod.getStorage(app)

      if (useEmulators) {
        authMod.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
        firestoreMod.connectFirestoreEmulator(db, '127.0.0.1', 8080)
        storageMod.connectStorageEmulator(storage, '127.0.0.1', 9199)
      }

      /**
       * Sessão sobrevive ao fechar o navegador — é o esperado de uma ferramenta
       * de trabalho; pedir login toda manhã é atrito puro. Não aguardamos a
       * promise: em modo privado ela falha, e o SDK já cai para sessão em
       * memória sozinho. Não é motivo para quebrar a aplicação.
       */
      authMod.setPersistence(auth, authMod.browserLocalPersistence).catch(() => {})

      services = { app, auth, db, storage }
      return services
    }

    const loader: FirebaseLoader = {
      load: () => (pending ??= initialize()),
      get: () => {
        if (!services) {
          throw new Error(
            'Firebase ainda não foi carregado. Use `await useFirebaseAsync()` ou aguarde `waitUntilReady()` antes de chamar `useFirebase()`.',
          )
        }
        return services
      },
      get ready() {
        return services !== null
      },
    }

    return {
      provide: { firebase: loader },
    }
  },
})
