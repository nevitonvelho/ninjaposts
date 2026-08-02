import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { FieldValue, Timestamp, getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getStorage, type Storage } from 'firebase-admin/storage'

let cached: { app: App; auth: Auth; db: Firestore; storage: Storage } | null = null

/**
 * Admin SDK, com resolução de credencial em três cenários:
 *
 * 1. Service account explícita no `.env` — desenvolvimento local.
 * 2. Application Default Credentials — funciona após `gcloud auth
 *    application-default login`, sem baixar chave nenhuma para o disco.
 * 3. Credencial implícita do ambiente — em produção no Firebase/Cloud Run,
 *    onde não existe (nem deve existir) arquivo de chave.
 *
 * Suportar os três é o que permite não versionar segredo em lugar algum: o
 * caminho de produção nunca depende de uma chave copiada à mão.
 */
export function useFirebaseAdmin() {
  if (cached) return cached

  const config = useRuntimeConfig()
  const existing = getApps()[0]
  const hasServiceAccount = Boolean(config.firebaseClientEmail && config.firebasePrivateKey)

  let app
  try {
    app =
      existing ??
      initializeApp({
        credential: hasServiceAccount
          ? cert({
              projectId: config.firebaseProjectId,
              clientEmail: config.firebaseClientEmail,
              /**
               * Variáveis de ambiente não carregam quebra de linha real: a chave
               * chega com `\n` literal. Sem esta troca o SDK falha com um erro de
               * parsing de PEM que não diz absolutamente nada sobre a causa.
               */
              privateKey: config.firebasePrivateKey.replace(/\\n/g, '\n'),
            })
          : applicationDefault(),
        projectId: config.firebaseProjectId || undefined,
        storageBucket: config.firebaseStorageBucket || undefined,
      })
  } catch (error) {
    /**
     * Falta de credencial é o erro de deploy mais provável desta aplicação, e
     * era também o mais difícil de diagnosticar: sem este catch, o
     * `initializeApp` estoura **antes** do `try` de cada rota, o cliente recebe
     * um 500 sem corpo e a mensagem na tela vira "o servidor respondeu de forma
     * inesperada" — que não aponta para lugar nenhum.
     *
     * A Application Default Credentials existe no Google Cloud e na máquina do
     * dev (via `gcloud auth`), mas **não** em host de terceiro como a Vercel.
     * Lá a service account explícita é obrigatória.
     */
    console.error(
      '[firebase-admin] não foi possível inicializar o Admin SDK.\n'
      + `  NUXT_FIREBASE_PROJECT_ID: ${config.firebaseProjectId ? 'ok' : 'AUSENTE'}\n`
      + `  NUXT_FIREBASE_CLIENT_EMAIL: ${config.firebaseClientEmail ? 'ok' : 'AUSENTE'}\n`
      + `  NUXT_FIREBASE_PRIVATE_KEY: ${config.firebasePrivateKey ? 'ok' : 'AUSENTE'}\n`
      + '  Fora do Google Cloud (Vercel, por exemplo) as três são obrigatórias.',
      error,
    )

    throw apiError(
      'internal',
      'O servidor não está configurado corretamente. Já estamos verificando.',
    )
  }

  cached = {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    storage: getStorage(app),
  }

  return cached
}

export { FieldValue, Timestamp }
