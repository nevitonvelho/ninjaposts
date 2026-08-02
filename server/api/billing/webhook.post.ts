import { COLLECTIONS, isGuessedResolution, resolvePack } from '#shared/constants'
import type { NormalizedPurchaseEvent } from '#shared/types/billing'
import { kiwifyProductIds, usePaymentProvider } from '../../utils/payments'
import { WebhookRejection } from '../../utils/payments/rejection'

/**
 * Webhook de compra — a **única** porta por onde crédito comprado entra.
 *
 * Nada aqui confia no navegador do usuário: o app não sabe se o pagamento
 * passou, e não precisa saber. Quem confirma dinheiro é o gateway, e o saldo
 * chega ao cliente pelo `onSnapshot` de `users/{uid}` que já está aberto.
 *
 * Três garantias que o endpoint precisa dar, nesta ordem:
 *
 * 1. **Assinatura válida.** Sem isso, `curl` vira dinheiro.
 * 2. **Idempotência.** Webhook duplicado é regra, não exceção. O id do pedido
 *    é o id do documento em `purchases`, e a criação acontece na mesma
 *    transação do crédito — repetir o evento não credita duas vezes.
 * 3. **Resposta 200 mesmo no que ignoramos.** Gateway que recebe erro fica
 *    reenviando; devolver 200 com `ignored` encerra a retentativa.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const { db } = useFirebaseAdmin()

  const rawBody = await readRawBody(event, 'utf8')
  if (!rawBody) {
    throw apiError('invalid_input', 'Corpo vazio.')
  }

  /**
   * Assinatura: a Kiwify não documenta onde ela vem. Procuramos no query
   * (`?signature=`) e nos headers mais prováveis — o primeiro que existir.
   */
  const signature =
    (getQuery(event).signature as string | undefined)
    ?? getRequestHeader(event, 'x-kiwify-signature')
    ?? getRequestHeader(event, 'x-signature')
    ?? null

  /**
   * Modo de inspeção — só em desenvolvimento, e só sem token configurado.
   *
   * Serve para descobrir o formato real do payload com o botão "Testar
   * Webhook" da Kiwify antes de saber como validar a assinatura. Registra tudo
   * e **não credita nada**: sem token não há como distinguir o gateway de um
   * curl qualquer, e creditar aqui seria abrir a porta que o endpoint existe
   * para fechar.
   */
  if (import.meta.dev && config.paymentProvider === 'kiwify' && !config.kiwifyWebhookToken) {
    console.warn(
      '[webhook] NUXT_KIWIFY_WEBHOOK_TOKEN vazio — modo de inspeção, nada foi creditado.\n'
      + `  query: ${JSON.stringify(getQuery(event))}\n`
      + `  headers: ${JSON.stringify(getRequestHeaders(event))}\n`
      + `  body: ${rawBody}`,
    )
    return { ok: true, inspected: true }
  }

  const provider = usePaymentProvider()

  /**
   * Rastro de entrada — uma linha por invocação.
   *
   * Sem isto, um evento que morre cedo não deixa nada no log, e o painel do
   * host mostra só "status 0" sem dizer se o nosso código chegou a rodar. Uma
   * linha barata na entrada é a diferença entre diagnosticar em um clique e
   * ficar adivinhando.
   *
   * Registra **nomes de campo, nunca valores**: o corpo carrega e-mail, nome e
   * CPF do comprador, e log de produção não é lugar para dado pessoal.
   */
  console.info(
    `[webhook] recebido · provider=${provider.id} · ${rawBody.length} bytes`
    + ` · assinatura=${signature ? 'presente' : 'AUSENTE'}`
    + ` · ua=${getRequestHeader(event, 'user-agent') ?? '?'}`
    + ` · ${describeEvent(rawBody)}`,
  )

  let normalized: NormalizedPurchaseEvent
  try {
    normalized = await provider.parseWebhook(rawBody, signature)
  } catch (error) {
    /**
     * Recusa vira erro HTTP de propósito, e não 200: se um evento legítimo
     * passar a ser rejeitado por mudança de formato, ele precisa aparecer como
     * falha no painel da Kiwify, e não sumir silenciosamente.
     *
     * O status separa os dois problemas — 401 é token errado, 422 é o gateway
     * mandando um corpo diferente do que lemos. São investigações opostas.
     */
    const reason = error instanceof WebhookRejection ? error.reason : 'payload'
    console.warn(`[webhook] evento recusado (${reason}):`, (error as Error).message)

    if (reason === 'config') {
      throw internalError('configuração do gateway de pagamento', error)
    }
    throw reason === 'signature'
      ? apiError('unauthenticated', 'Assinatura inválida.')
      : apiError('invalid_input', 'Formato de evento não reconhecido.')
  }

  const eventId = `${provider.id}_${normalized.type}_${normalized.id}`
  const eventRef = db.collection(COLLECTIONS.webhookEvents).doc(eventId)
  const purchaseRef = db.collection(COLLECTIONS.purchases).doc(normalized.id)

  if (normalized.type === 'ignored') {
    await eventRef.set({
      id: eventId,
      provider: provider.id,
      type: 'ignored',
      uid: null,
      processedAt: Timestamp.now(),
    })
    return { ok: true, ignored: true }
  }

  const productIds = kiwifyProductIds()
  const pack = resolvePack({
    externalProductId: normalized.externalProductId,
    amountCents: normalized.amountCents,
    productName: normalized.productName,
    productIds,
  })

  /**
   * Produto não reconhecido não é erro: com o webhook no escopo "todos que sou
   * produtor", vendas de outros produtos caem aqui o tempo todo. Registramos e
   * seguimos — creditar por engano seria bem pior que ignorar.
   */
  if (!pack) {
    console.info(
      `[webhook] produto não reconhecido (${normalized.externalProductId ?? 'sem id'} / `
      + `${normalized.amountCents} centavos) — ignorado.`,
    )
    await eventRef.set({
      id: eventId,
      provider: provider.id,
      type: `${normalized.type}:unknown_product`,
      uid: null,
      processedAt: Timestamp.now(),
    })
    return { ok: true, ignored: true }
  }

  if (isGuessedResolution(productIds)) {
    console.warn(
      `[webhook] pacote "${pack.id}" resolvido por valor/nome — configure `
      + 'NUXT_KIWIFY_PRODUCT_* para não depender de palpite.',
    )
  }

  /**
   * O dono é resolvido antes da transação porque a busca é no Firebase Auth,
   * que não participa dela. Só o `uid` atravessa; saldo e ledger continuam
   * atômicos lá dentro.
   *
   * `emailVerified` é exigência de segurança, não burocracia: sem ela,
   * cadastrar-se com o e-mail alheio roubaria a compra de outra pessoa. Quem
   * ainda não confirmou fica com a compra pendente e a reivindica depois.
   */
  let uid: string | null = null
  if (normalized.email) {
    try {
      const { auth } = useFirebaseAdmin()
      const found = await auth.getUserByEmail(normalized.email)
      uid = found.emailVerified ? found.uid : null

      if (found && !found.emailVerified) {
        console.info(
          `[webhook] compra ${normalized.id}: conta ${found.uid} ainda não confirmou o e-mail — `
          + 'compra fica pendente.',
        )
      }
    } catch (error) {
      if ((error as { code?: string }).code !== 'auth/user-not-found') {
        throw internalError(`busca de conta por e-mail no webhook ${eventId}`, error)
      }
    }
  }

  try {
    const result = await db.runTransaction(async (tx) => {
      // --- leituras primeiro: o Firestore proíbe ler depois de escrever ---
      const existingEvent = await tx.get(eventRef)
      if (existingEvent.exists) return { duplicate: true as const }

      const existingPurchase = await tx.get(purchaseRef)
      const alreadyCredited = Boolean(existingPurchase.get('creditedAt'))
      const purchaseOwner = (existingPurchase.get('ownerId') as string | null) ?? null
      const now = Timestamp.now()

      // --- compra aprovada ---
      if (normalized.type === 'purchase.paid') {
        if (alreadyCredited) {
          tx.set(eventRef, {
            id: eventId,
            provider: provider.id,
            type: normalized.type,
            uid: purchaseOwner,
            processedAt: now,
          })
          return { duplicate: true as const }
        }

        if (uid) {
          await applyCreditMutation(tx, {
            uid,
            delta: pack.credits,
            reason: 'purchase',
            refId: normalized.id,
            note: `Compra do pacote ${pack.name}`,
          })
        }

        tx.set(purchaseRef, {
          id: normalized.id,
          ownerId: uid,
          email: normalized.email ?? '',
          provider: provider.id,
          externalOrderId: normalized.id,
          externalProductId: normalized.externalProductId,
          packId: pack.id,
          credits: pack.credits,
          amountCents: normalized.amountCents || pack.priceCents,
          status: 'paid',
          creditedAt: uid ? now : null,
          createdAt: existingPurchase.exists ? existingPurchase.get('createdAt') : now,
          updatedAt: now,
        })

        tx.set(eventRef, {
          id: eventId,
          provider: provider.id,
          type: normalized.type,
          uid,
          processedAt: now,
        })

        return { credited: uid ? pack.credits : 0, pending: !uid }
      }

      // --- reembolso / chargeback ---
      if (purchaseOwner && alreadyCredited) {
        await applyCreditMutation(tx, {
          uid: purchaseOwner,
          delta: -pack.credits,
          reason: 'refund',
          refId: normalized.id,
          note: `Estorno da compra do pacote ${pack.name}`,
        })
      }

      tx.set(
        purchaseRef,
        {
          id: normalized.id,
          status: 'refunded',
          updatedAt: now,
          ...(existingPurchase.exists
            ? {}
            : {
                ownerId: null,
                email: normalized.email ?? '',
                provider: provider.id,
                externalOrderId: normalized.id,
                externalProductId: normalized.externalProductId,
                packId: pack.id,
                credits: pack.credits,
                amountCents: normalized.amountCents || pack.priceCents,
                creditedAt: null,
                createdAt: now,
              }),
        },
        { merge: true },
      )

      tx.set(eventRef, {
        id: eventId,
        provider: provider.id,
        type: normalized.type,
        uid: purchaseOwner,
        processedAt: now,
      })

      return { refunded: purchaseOwner ? pack.credits : 0 }
    })

    return { ok: true, ...result }
  } catch (error) {
    throw internalError(`processamento do webhook ${eventId}`, error)
  }
})

/**
 * Campos cujo **valor** pode ir para o log.
 *
 * São enumerações e referências do gateway — `paid`, `order_approved`,
 * `refunded`, o id do pedido —, não dado de pessoa. E são justamente os que
 * decidem se uma compra vira crédito: sem eles no log, um status novo do
 * provedor passaria a ser ignorado em silêncio, e a primeira notícia disso
 * seria um cliente reclamando que pagou e não recebeu.
 *
 * Cada entrada repete os **mesmos caminhos alternativos que o parser tenta**.
 * Consultar só o caminho canônico faria o log dizer "sem campos de
 * classificação" no caso em que ele é mais necessário — o gateway trocou
 * `Product` por `product` e nada mais mudou. Logamos o caminho que respondeu,
 * não o que esperávamos: é ele que diz qual variante chegou.
 */
const LOGGABLE_VALUES = [
  ['order_status', 'status'],
  ['webhook_event_type', 'event'],
  ['sale_type'],
  // Correlaciona esta linha com as de `compra <id>` mais abaixo, e com o painel
  // da Kiwify. Num evento que morre no parser, é o único fio que sobra.
  ['order_id', 'id', 'order.order_id', 'order_ref'],
  // Identificam o produto e o valor — é o que se copia para NUXT_KIWIFY_PRODUCT_*.
  ['Product.product_id', 'product.product_id', 'product_id'],
  ['Commissions.charge_amount', 'commissions.charge_amount', 'charge_amount'],
]

/** Lê `a.b` sem estourar em caminho ausente. */
function readPath(source: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (value, key) =>
      value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined,
    source,
  )
}

/**
 * Primeiro caminho da lista que trouxe um valor escalar, como `caminho=valor`.
 *
 * Objeto e array ficam de fora: `String({})` vira `[object Object]`, que não
 * informa nada, e um aninhado inesperado é justamente o que `describeShape`
 * já descreve — sem risco de arrastar um `Customer` inteiro para o log.
 */
function firstPresent(source: Record<string, unknown>, paths: string[]): string | null {
  for (const path of paths) {
    const value = readPath(source, path)
    if (value === undefined || value === null || value === '') continue
    if (typeof value === 'object') continue
    return `${path}=${String(value)}`
  }
  return null
}

/** Resume o evento: os valores que classificam, mais o formato do resto. */
function describeEvent(rawBody: string): string {
  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') {
      return `campos=[${describeShape(rawBody)}]`
    }

    const classifiers = LOGGABLE_VALUES.map(paths => firstPresent(parsed, paths))
      .filter((entry): entry is string => entry !== null)
      .join(' · ')

    return `${classifiers || 'sem campos de classificação'} · campos=[${describeShape(rawBody)}]`
  } catch {
    return `campos=[${describeShape(rawBody)}]`
  }
}

/**
 * Descreve o formato do corpo sem revelar conteúdo.
 *
 * Devolve `order_id, Customer{email,full_name}, Product{product_id}` — nomes de
 * campo e um nível de aninhamento. É o suficiente para descobrir que o gateway
 * mudou `Customer` para `customer`, e insuficiente para vazar o CPF de alguém
 * no log de produção.
 */
function describeShape(rawBody: string): string {
  try {
    const parsed: unknown = JSON.parse(rawBody)
    if (!parsed || typeof parsed !== 'object') return typeof parsed

    return Object.entries(parsed as Record<string, unknown>)
      .map(([key, value]) =>
        value && typeof value === 'object' && !Array.isArray(value)
          ? `${key}{${Object.keys(value as object).join(',')}}`
          : key,
      )
      .join(', ')
  } catch {
    return 'corpo não é JSON'
  }
}
