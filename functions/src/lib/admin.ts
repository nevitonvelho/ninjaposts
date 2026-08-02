import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

/**
 * Admin SDK das Functions.
 *
 * Sem credencial explícita: dentro do Cloud Functions a identidade vem do
 * ambiente. Passar uma service account aqui significaria uma chave privada
 * versionada ou em variável de ambiente — risco sem nenhum ganho.
 */
const app = getApps()[0] ?? initializeApp()

export const db = getFirestore(app)
export const storage = getStorage(app)

export { FieldValue, Timestamp } from 'firebase-admin/firestore'
