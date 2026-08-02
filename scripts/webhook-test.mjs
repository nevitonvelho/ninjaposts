#!/usr/bin/env node
/**
 * Testa o endpoint de webhook de compra com um evento assinado.
 *
 * Existe porque a Kiwify não documenta o formato do payload nem o algoritmo da
 * assinatura: sem uma forma de disparar um evento controlado, o único jeito de
 * validar o caminho de creditamento seria comprar de verdade.
 *
 * Uso:
 *   node scripts/webhook-test.mjs --url https://www.ninjaposts.com.br
 *   node scripts/webhook-test.mjs --url ... --status paid --email voce@gmail.com
 *
 * Opções:
 *   --url      base da aplicação (padrão: http://localhost:3000)
 *   --status   `waiting_payment` (padrão, NÃO credita) | `paid` | `refunded`
 *   --email    e-mail do comprador — use um com conta para ver o crédito entrar
 *   --amount   valor em centavos (padrão 5599, o pacote Essencial)
 *   --order    id do pedido (padrão: gerado com timestamp)
 *   --token    token do webhook (padrão: lê NUXT_KIWIFY_WEBHOOK_TOKEN do .env.vercel)
 *   --alg      sha1 (padrão) | sha256
 *
 * O padrão é deliberadamente o status que **não credita**: valida rota,
 * provider, token e assinatura criando apenas um registro em `webhookEvents`.
 * Só passe `--status paid` quando quiser exercitar o crédito de verdade.
 */
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, index, all) => {
    if (arg.startsWith('--')) pairs.push([arg.slice(2), all[index + 1]])
    return pairs
  }, []),
)

function tokenFromEnvFile() {
  for (const file of ['.env.vercel', '.env']) {
    try {
      const match = readFileSync(file, 'utf8').match(/^NUXT_KIWIFY_WEBHOOK_TOKEN=(.*)$/m)
      const value = match?.[1]?.trim().replace(/^"|"$/g, '')
      if (value) return value
    } catch {
      // arquivo ausente é normal — tenta o próximo
    }
  }
  return null
}

const base = (args.url ?? 'http://localhost:3000').replace(/\/$/, '')
const token = args.token ?? tokenFromEnvFile()
const status = args.status ?? 'waiting_payment'
const amount = Number(args.amount ?? 5599)
const orderId = args.order ?? `teste-${Date.now()}`
const email = args.email ?? 'comprador-teste@exemplo.com'
const algorithm = args.alg ?? 'sha1'

if (!token) {
  console.error('Token não encontrado. Passe --token ou defina NUXT_KIWIFY_WEBHOOK_TOKEN no .env.vercel')
  process.exit(1)
}

/**
 * `--probe` remove o id do pedido de propósito.
 *
 * O servidor valida a assinatura **antes** de olhar o corpo, e só escreve algo
 * depois de extrair o id. Um evento assinado e sem id, portanto, atravessa a
 * validação e para exatamente antes da primeira escrita: 422 prova que a
 * assinatura foi aceita, 401 prova que não. É o teste que responde "o token
 * está certo?" sem sujar o banco com evento de mentira.
 */
const probe = 'probe' in args

/** Payload no formato que a Kiwify usa. */
const payload = {
  ...(probe ? {} : { order_id: orderId }),
  order_ref: probe ? undefined : orderId,
  order_status: status,
  webhook_event_type:
    status === 'paid' ? 'order_approved' : status === 'refunded' ? 'order_refunded' : 'pix_created',
  payment_method: 'pix',
  Customer: { full_name: 'Comprador de Teste', email },
  Product: { product_id: args.product ?? 'produto-teste', product_name: 'Essencial - 10 Créditos' },
  Commissions: { charge_amount: String(amount), currency: 'BRL' },
}

const body = JSON.stringify(payload)
const signature = createHmac(algorithm, token).update(body, 'utf8').digest('hex')
const url = `${base}/api/billing/webhook?signature=${signature}`

console.log(`→ POST ${base}/api/billing/webhook`)
console.log(
  probe
    ? '  modo sonda: evento assinado e sem id — valida a assinatura sem escrever nada'
    : `  pedido ${orderId} · ${status} · ${(amount / 100).toFixed(2)} BRL · ${email}`,
)
console.log(`  assinatura ${algorithm}/hex\n`)

const response = await fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body,
})

const text = await response.text()
console.log(`← HTTP ${response.status}`)
console.log(text.slice(0, 800))

console.log(
  '\n' +
    {
      200: '✓ aceito. Confira `webhookEvents` no Firestore (e `purchases`, se foi `paid`).',
      401: '✗ assinatura RECUSADA. Token divergente entre o .env e a Kiwify, ou provider ainda em `mock`.',
      422: probe
        ? '✓ assinatura ACEITA (o 422 aqui é o esperado: a sonda não manda id de pedido).'
        : '✗ payload não reconhecido. O corpo real da Kiwify difere deste — veja os logs.',
      404: '✗ rota não existe neste deploy. Faltou publicar a versão nova.',
      500: '✗ erro no servidor. Provável credencial do Admin SDK ausente — veja os logs.',
    }[response.status] ?? 'Resposta inesperada — confira os logs.',
)
