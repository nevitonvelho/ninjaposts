#!/usr/bin/env node
/**
 * Ajuste manual de saldo de créditos, pela linha de comando.
 *
 * Existe porque o painel admin (§3, `/admin/usuarios`) ainda não foi construído
 * e há duas necessidades reais antes disso: recarregar uma conta de testes e
 * compensar alguém cujo job falhou sem estorno automático. Sem uma ferramenta,
 * a alternativa é editar `credits` no console do Firebase — que é exatamente o
 * que este script existe para impedir.
 *
 * **Por que não é um `updateDoc` no console.** Saldo e histórico são um par:
 * `users/{uid}.credits` e uma entrada imutável em `creditLedger`, escritos na
 * mesma transação (§ `server/utils/credits.ts`). Mexer só no saldo deixa o
 * ledger mentindo, e é o ledger que responde "de onde veio esse crédito?"
 * quando o usuário reclama três semanas depois.
 *
 * Uso:
 *   node scripts/adjust-credits.mjs --email voce@gmail.com --delta 25 --note "recarga de testes"
 *   node scripts/adjust-credits.mjs --email voce@gmail.com --delta -5 --note "estorno duplicado"
 *   node scripts/adjust-credits.mjs --email voce@gmail.com --dry-run --delta 25 --note "..."
 *
 * Opções:
 *   --email     e-mail da conta (resolvido pelo Firebase Auth, não pelo Firestore)
 *   --delta     inteiro; negativo debita
 *   --note      obrigatório — é o que aparece no ledger e no suporte
 *   --key       caminho do service account (padrão: *-firebase-adminsdk-*.json na raiz)
 *   --dry-run   mostra o que faria e sai sem escrever
 */
import { createRequire } from 'node:module'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// O SDK é dependência da raiz do projeto, não deste script.
const require = createRequire(join(ROOT, 'package.json'))
const { initializeApp, cert } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, Timestamp } = require('firebase-admin/firestore')

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, index, all) => {
    if (!arg.startsWith('--')) return pairs
    const next = all[index + 1]
    // Flag sem valor (`--dry-run`) vira `true` em vez de engolir o argumento seguinte.
    pairs.push([arg.slice(2), next && !next.startsWith('--') ? next : 'true'])
    return pairs
  }, []),
)

function fail(message) {
  console.error(`✖ ${message}`)
  process.exit(1)
}

/** O nome do arquivo varia por projeto; o padrão é o mesmo que o `.gitignore` cobre. */
function findServiceAccount() {
  if (args.key) return resolve(args.key)
  const match = readdirSync(ROOT).find(name => /-firebase-adminsdk-.*\.json$/.test(name))
  if (!match) fail('service account não encontrado na raiz. Passe --key <caminho>.')
  return join(ROOT, match)
}

const email = args.email?.trim()
const delta = Number(args.delta)
const note = args.note?.trim()
const dryRun = args['dry-run'] === 'true'

if (!email) fail('informe --email')
if (!Number.isInteger(delta) || delta === 0) fail('--delta precisa ser um inteiro diferente de zero')
/**
 * A nota é obrigatória de propósito. Um ajuste sem motivo registrado é
 * indistinguível de um bug de creditamento quando alguém for auditar depois.
 */
if (!note || note.length < 3) fail('informe --note com o motivo do ajuste')

initializeApp({ credential: cert(JSON.parse(readFileSync(findServiceAccount(), 'utf8'))) })

const db = getFirestore()

/**
 * O `uid` vem do Auth, não de uma query em `users.email`.
 *
 * O Auth é quem normaliza e garante unicidade do e-mail; o campo no Firestore
 * é cópia, e "Joao@Gmail.com" não acharia a conta salva em minúsculas.
 */
const user = await getAuth().getUserByEmail(email).catch((error) => {
  if (error.code === 'auth/user-not-found') fail(`nenhuma conta com o e-mail ${email}`)
  throw error
})

const result = await db.runTransaction(async (tx) => {
  const userRef = db.collection('users').doc(user.uid)
  const snapshot = await tx.get(userRef)
  if (!snapshot.exists) throw new Error(`users/${user.uid} não existe — a conta ainda não foi provisionada`)

  const balanceBefore = snapshot.get('credits') ?? 0
  const balanceAfter = balanceBefore + delta
  if (dryRun) return { balanceBefore, balanceAfter }

  const now = Timestamp.now()

  tx.update(userRef, { credits: balanceAfter, updatedAt: now })

  /**
   * `stats.creditsPurchased` não sobe: é histórico de **compra**, e ajuste
   * manual não é venda. Contaminá-lo inflaria a receita aparente do painel.
   */
  tx.set(db.collection('creditLedger').doc(), {
    ownerId: user.uid,
    delta,
    balanceAfter,
    reason: 'admin_adjust',
    refId: null,
    note,
    createdAt: now,
  })

  return { balanceBefore, balanceAfter }
})

const sign = delta > 0 ? '+' : ''
console.log(`${dryRun ? '(dry-run) ' : ''}${email} — ${user.uid}`)
console.log(`saldo: ${result.balanceBefore} → ${result.balanceAfter}  (${sign}${delta})`)
console.log(`motivo: ${note}`)
if (dryRun) console.log('nada foi escrito.')
process.exit(0)
