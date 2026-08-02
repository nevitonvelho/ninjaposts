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

  const app =
    existing ??
    initializeApp({
      credential: config.firebaseClientEmail && config.firebasePrivateKey
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

  cached = {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    storage: getStorage(app),
  }

  return cached
}

export { FieldValue, Timestamp }
