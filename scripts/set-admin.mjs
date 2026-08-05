#!/usr/bin/env node
/**
 * Concede (ou remove) o papel de admin.
 *
 * O papel vive em **dois lugares**, e os dois são necessários:
 *
 * - **Custom claim** `role: 'admin'` no token — é o que as Security Rules do
 *   Firestore e do Storage leem, e o que o `requireAdmin` da API verifica. É a
 *   fronteira de segurança de verdade.
 * - **Campo `role`** em `users/{uid}` — é o que uma listagem no painel mostra.
 *   Claims não são consultáveis: não existe "me dê todos os admins" no Auth.
 *
 * Gravar só o campo daria um admin que não passa por nenhuma regra; gravar só
 * a claim daria um admin invisível no próprio painel.
 *
 * Uso:
 *   node scripts/set-admin.mjs --email voce@gmail.com
 *   node scripts/set-admin.mjs --email alguem@x.com --remove
 *   node scripts/set-admin.mjs --list
 */
import { createRequire } from 'node:module'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(ROOT, 'package.json'))
const { initializeApp, cert } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, Timestamp } = require('firebase-admin/firestore')

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, index, all) => {
    if (!arg.startsWith('--')) return pairs
    const next = all[index + 1]
    pairs.push([arg.slice(2), next && !next.startsWith('--') ? next : 'true'])
    return pairs
  }, []),
)

function fail(message) {
  console.error(`✖ ${message}`)
  process.exit(1)
}

function findServiceAccount() {
  if (args.key) return resolve(args.key)
  const match = readdirSync(ROOT).find(name => /-firebase-adminsdk-.*\.json$/.test(name))
  if (!match) fail('service account não encontrado na raiz. Passe --key <caminho>.')
  return join(ROOT, match)
}

initializeApp({ credential: cert(JSON.parse(readFileSync(findServiceAccount(), 'utf8'))) })

const auth = getAuth()
const db = getFirestore()

if (args.list === 'true') {
  const snapshot = await db.collection('users').where('role', '==', 'admin').get()
  if (snapshot.empty) console.log('nenhum admin cadastrado.')
  snapshot.docs.forEach(doc => console.log(`${doc.get('email')} — ${doc.id}`))
  process.exit(0)
}

const email = args.email?.trim()
const remove = args.remove === 'true'
if (!email) fail('informe --email (ou --list)')

const user = await auth.getUserByEmail(email).catch((error) => {
  if (error.code === 'auth/user-not-found') fail(`nenhuma conta com o e-mail ${email}`)
  throw error
})

const role = remove ? 'user' : 'admin'

/**
 * `setCustomUserClaims` **substitui** o objeto inteiro de claims. Preservar o
 * que já existe evita apagar, num comando de promoção, qualquer outra claim que
 * o projeto venha a usar.
 */
const claims = { ...(user.customClaims ?? {}) }
if (remove) delete claims.role
else claims.role = 'admin'

await auth.setCustomUserClaims(user.uid, claims)

// `set` com merge: a conta pode ainda não ter documento se nunca abriu o app.
await db.collection('users').doc(user.uid).set(
  { role, updatedAt: Timestamp.now() },
  { merge: true },
)

console.log(`${email} — ${user.uid}`)
console.log(`papel: ${role}`)
/**
 * O token em uso continua com a claim antiga até renovar. O `useAuthStore`
 * escuta `onIdTokenChanged`, então o refresh chega sozinho em até uma hora —
 * mas sair e entrar resolve na hora, e é o que a pessoa quer ouvir.
 */
console.log('\nSaia e entre de novo no app para o token pegar a mudança.')
process.exit(0)
