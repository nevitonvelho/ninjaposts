# CriaPosts — Arquitetura

> Documento vivo. Toda decisão técnica relevante mora aqui.
> Stack: Nuxt 4 · Vue 3 · TypeScript · TailwindCSS · Firebase (Auth, Firestore, Storage, Functions, Hosting) · Pinia · VueUse · OpenAI.

---

## 0. Decisões estruturais (as 6 que definem o resto)

### 0.1 Renderização: híbrida (landing SSG + app SPA), **não** SSR completo

| Rota | Estratégia | Motivo |
|---|---|---|
| `/`, `/precos`, `/termos` | `prerender` (SSG) | SEO e LCP baixo. Conteúdo estático, não precisa de servidor. |
| `/app/**`, `/admin/**` | `ssr: false` (SPA) | Área logada não indexa. Evita o problema de sessão do Firebase Auth no SSR. |

**Por quê não SSR completo?** SSR + Firebase Auth exige *session cookies* (troca do ID token por cookie via Admin SDK, refresh, revogação) — muita complexidade e latência para zero ganho, já que a área logada nunca é indexada. Com SPA, o Firebase Auth Web SDK cuida de sessão/refresh sozinho e mandamos o ID token no header `Authorization` para a API.

**Consequência:** o build é estático → a CDN serve direto, sem cold start no carregamento da página. Só as chamadas de API tocam servidor.

**Onde cada coisa roda (decidido em 01/08/2026):**

| Alvo | O que hospeda | Deploy |
|---|---|---|
| **Vercel** | App Nuxt: frontend + rotas `server/api` | `git push` |
| **Firebase** | Firestore, Storage, rules, índices e as Cloud Functions de background | `npx firebase deploy` |

São **dois deploys**, e a divisão define onde cada segredo vive: a chave da OpenAI fica no Secret Manager do Google (só o worker chama a OpenAI), enquanto credencial do Admin SDK e token do webhook ficam nas variáveis da Vercel.

Uma consequência não óbvia: na Vercel **não existe Application Default Credentials**. `NUXT_FIREBASE_CLIENT_EMAIL` e `NUXT_FIREBASE_PRIVATE_KEY` passam a ser obrigatórios — sem eles, `verifyIdToken` falha e toda rota autenticada responde erro de servidor, mesmo funcionando na máquina do dev (onde o `gcloud auth` cobre o buraco).

### 0.2 Backend: Nitro (`server/api`) + Cloud Functions de background

Duas camadas com responsabilidades distintas:

| Camada | Onde roda | Responsabilidade | Timeout |
|---|---|---|---|
| **Nitro API** (`server/api/**`) | Vercel Functions (preset `vercel` do Nitro) | Requisições curtas e síncronas: criar job, CRUD, webhooks | 60s no Hobby |
| **Functions de background** (`functions/`) | Cloud Functions gen2 dedicadas | Trabalho pesado e assíncrono: geração de imagem, triggers, cron | até 540s |

**`overrides.jose` no `package.json`.** `firebase-admin` puxa `jwks-rsa`, que é CommonJS e faz `require('jose')` — mas `jose@6` é ESM puro, sem build CJS. Node 22.12+ tolera `require()` de ESM; o runtime da Vercel não, e o resultado era `ERR_REQUIRE_ESM` no *carregamento do módulo* — ou seja, **toda** rota da API respondia 500 antes mesmo de executar, inclusive as que só devolveriam 401. Travar `jose` em `^5.10.0`, que exporta condição `require`, elimina o conflito em qualquer runtime. Sintoma a reconhecer: erro que só aparece em produção e some localmente é quase sempre diferença de versão de Node, não de configuração.

> O `server/` do Nuxt vira função da Vercel no deploy; as Functions do Firebase existem **só** para o trabalho de background. O corte entre as duas não é preferência de plataforma: é o teto de 60s de qualquer função HTTP contra uma geração que leva de 20s a 90s (§0.3).

### 0.3 Geração de imagem é **assíncrona por job**, nunca request/response

Este é o ponto mais importante da arquitetura.

O caminho `Hosting → Cloud Function` tem **timeout rígido de 60s**. Uma geração completa (briefing criativo + render da imagem + pós-processamento + upload) leva de 20s a 90s. Fazer isso numa requisição síncrona quebra em produção sob carga.

```
Cliente                 Nitro API              Firestore            Worker Function          OpenAI / Storage
  │                        │                       │                      │                        │
  ├─ POST /api/generations ┤                       │                      │                        │
  │                        ├─ transação:           │                      │                        │
  │                        │  debita crédito       │                      │                        │
  │                        │  cria doc status=queued ──────────────────►  │                        │
  │  ◄── 202 { id } ───────┤                       │                      │                        │
  │                        │                       │  onDocumentCreated ─►│                        │
  ├─ onSnapshot(id) ──────────────────────────────►│                      ├─ 1. brief (Responses) ►│
  │  ◄── status: briefing ─────────────────────────┤  ◄── update ─────────┤                        │
  │  ◄── status: rendering ────────────────────────┤  ◄── update ─────────┤─ 2. imagem (Images) ──►│
  │  ◄── status: finishing ────────────────────────┤  ◄── update ─────────┤─ 3. sharp + upload ───►│
  │  ◄── status: completed + urls ─────────────────┤  ◄── update ─────────┤                        │
```

Ganhos: sem timeout, retry automático do Eventarc, UX com progresso real, e o custo do worker (memória alta) fica isolado da API (memória baixa).

### 0.4 Créditos pré-pagos, debitados em **transação**, no servidor, sempre

O modelo de receita é **pacote de crédito avulso**, não assinatura. Uma arte custa **1 crédito** — e regerar custa outro, porque é outra chamada ao modelo de imagem.

Por que não assinatura: recorrência obriga a carregar ciclo, renovação, inadimplência, cancelamento e reset mensal de cota — cinco máquinas de estado que existem só por causa da mensalidade. Crédito comprado é um número que sobe na compra e desce na geração. E como **crédito não expira**, também não existe o caso "o usuário pagou e perdeu o saldo", que é o que mais gera pedido de reembolso em produto de crédito.

Crédito é dinheiro. Regras invioláveis:

1. O cliente **nunca** escreve em `users.credits` — bloqueado nas Security Rules.
2. Débito acontece numa `runTransaction` no momento de criar o job (não no fim) — evita que N requisições paralelas gastem o mesmo crédito.
3. Toda mutação de crédito gera uma entrada imutável em `creditLedger` (auditoria e suporte).
4. Falha na geração → **estorno automático** pelo worker, com nova entrada no ledger.
5. Limite de jobs concorrentes por usuário (`users.activeJobs`), incrementado na mesma transação.
6. Crédito entra **só pelo webhook do gateway**, nunca por retorno de navegador — quem confirma pagamento é o provedor.

### 0.5 As artes vivem **24 horas** e são apagadas

`generations` é armazenamento efêmero: passadas 24h, o documento e os arquivos no Storage somem.

Isso é decisão de custo, não de produto: guardar PNG de 1080×1350 por usuário indefinidamente faz a conta do Storage crescer sem teto e sem receita correspondente — o usuário paga pela *geração*, não pela hospedagem. A contrapartida é que a UI precisa ser explícita sobre o prazo em toda tela onde a arte aparece, e o download tem que ser óbvio.

Três mecanismos, descritos em `firebase/README.md`: o cron de limpeza é quem cumpre a promessa; o TTL do Firestore e o ciclo de vida do bucket são redes de segurança para o caso de o cron falhar.

### 0.6 Tipos vivem em `shared/` — uma única fonte de verdade

O Nuxt 4 auto-importa `shared/` tanto no cliente quanto no Nitro. Todas as interfaces de documento do Firestore, DTOs de API e enums ficam lá. Zero duplicação entre front e back.

---

## 1. Estrutura de pastas

```
criaposts/
├── app/                          # ← código do cliente (Nuxt 4)
│   ├── app.vue
│   ├── error.vue
│   ├── assets/css/main.css       # Tailwind + design tokens
│   ├── components/
│   │   ├── ui/                   # design system puro (sem regra de negócio)
│   │   ├── layout/               # navbar, sidebar, shell
│   │   ├── generator/            # formulário e resultado
│   │   ├── history/
│   │   ├── billing/
│   │   └── admin/
│   ├── composables/
│   ├── layouts/                  # default (marketing), app, admin, auth
│   ├── middleware/               # auth, guest, admin
│   ├── pages/
│   ├── plugins/                  # firebase.client.ts
│   ├── stores/                   # Pinia
│   └── utils/
├── shared/                       # ← auto-import cliente + servidor
│   ├── types/                    # models, dtos, enums
│   ├── constants/                # pacotes, redes, estilos, aspect ratios
│   └── utils/                    # validação e formatação isomórficas
├── server/                       # ← Nitro (roda em Cloud Function)
│   ├── api/
│   ├── middleware/
│   └── utils/                    # firebase-admin, auth guard, erros
├── functions/                    # ← Cloud Functions de background (pacote próprio)
│   └── src/
│       ├── lib/                  # admin SDK, secrets, região
│       ├── triggers/             # onGenerationCreated
│       ├── scheduled/            # cleanupExpiredGenerations, reconcileStuckJobs
│       └── services/             # openai, prompt, image, storage, job, cost
├── firebase/                     # config de infra
│   ├── firestore.rules
│   ├── firestore.indexes.json
│   └── storage.rules
├── docs/
├── firebase.json
└── nuxt.config.ts
```

> Não há `tailwind.config.ts`: o Tailwind v4 é configurado no próprio CSS, via
> `@theme` em `app/assets/css/main.css`. Os design tokens da §9 viram utilitários
> semânticos (`bg-canvas`, `border-line`, `text-ink-muted`) direto de lá.

**Regra de dependência:** `app/` → `shared/` ← `server/` ← `functions/`. Nada em `shared/` importa de `app/` ou `server/`.

---

## 2. Modelo de dados (Firestore)

### 2.1 Coleções

```
users/{uid}
projects/{projectId}
generations/{generationId}      # efêmero: apagado 24h após a criação
purchases/{orderId}             # compras de crédito confirmadas pelo gateway
templates/{templateId}
creditLedger/{entryId}          # auditoria de créditos
webhookEvents/{eventId}         # idempotência de webhooks
stats/{docId}                   # agregados para o admin
```

> **Por que coleções raiz e não subcoleções de `users`?** O painel admin e os relatórios precisam de queries *collection-wide* (`where('createdAt', '>=', x)`). Com subcoleção seria necessário `collectionGroup` + índices extras. Coleção raiz com campo `ownerId` indexado resolve os dois casos com o mesmo índice.

### 2.2 `users/{uid}`

```ts
interface UserDoc {
  uid: string
  email: string
  displayName: string
  photoURL: string | null
  company: string | null
  role: 'user' | 'admin'

  credits: number                 // saldo atual — SOMENTE servidor escreve. Não expira.
  activeJobs: number              // controle de concorrência

  brand: {
    logoPath: string | null       // caminho no Storage, não URL
    colors: string[]              // hex
    defaultStyle: StyleId | null
  }

  stats: { generations: number; downloads: number; creditsPurchased: number }

  createdAt: Timestamp
  updatedAt: Timestamp
  lastSeenAt: Timestamp
}
```

Guardamos `logoPath` (caminho no Storage) e não a URL: URLs de download podem ser revogadas e não sobrevivem a troca de bucket.

Não há `plan` nem `creditsResetAt`: sem assinatura não existe ciclo a reiniciar. O saldo só muda por compra, geração, estorno ou ajuste manual — e cada mudança deixa rastro em `creditLedger`.

### 2.3 `generations/{generationId}` — o coração do sistema

```ts
type GenerationStatus =
  | 'queued' | 'briefing' | 'rendering' | 'finishing'
  | 'completed' | 'failed' | 'canceled'

interface GenerationDoc {
  id: string
  ownerId: string
  projectId: string | null

  input: GenerationInput          // exatamente o que o usuário preencheu
  status: GenerationStatus
  progress: number                // 0-100, para a barra
  error: { code: string; message: string } | null

  output: {
    imagePath: string | null      // Storage
    thumbPath: string | null
    jpgPath: string | null
    width: number; height: number
    caption: string | null
    hashtags: string[]
    altText: string | null
  } | null

  meta: {                         // observabilidade e custo
    briefModel: string
    imageModel: string
    promptUsed: string            // prompt final enviado ao modelo
    revisedPrompt: string | null
    tokensIn: number; tokensOut: number
    costUsd: number
    durationMs: number
    attempt: number
  } | null

  creditsCharged: number
  refunded: boolean
  parentId: string | null         // "gerar novamente" / duplicar

  createdAt: Timestamp
  updatedAt: Timestamp
  completedAt: Timestamp | null
  deletedAt: Timestamp | null     // soft delete (exclusão pelo usuário)
  expiresAt: Timestamp            // createdAt + 24h — lido pela política de TTL
}
```

`meta.promptUsed` é o que permite depurar qualidade e fazer *prompt tuning* com dados reais depois.

### 2.4 `projects/{projectId}`

Uma "marca" do usuário (hamburgueria, salão, loja). Permite reaproveitar nicho, cores e logo entre posts — evita redigitar tudo.

```ts
interface ProjectDoc {
  id: string; ownerId: string
  name: string; niche: string
  brand: { logoPath: string | null; colors: string[]; defaultStyle: StyleId | null }
  createdAt: Timestamp; updatedAt: Timestamp; archivedAt: Timestamp | null
}
```

### 2.5 `purchases/{orderId}`

Uma compra de crédito aprovada. Espelho **read-only** do gateway — a fonte de verdade é o provedor. Escrito exclusivamente pelo webhook.

```ts
interface PurchaseDoc {
  id: string                      // = id do pedido no gateway
  ownerId: string | null          // null = compra ainda não reivindicada
  email: string
  provider: 'mock' | 'kiwify'
  externalOrderId: string
  externalProductId: string | null
  packId: PackId | null
  credits: number
  amountCents: number
  status: 'paid' | 'refunded' | 'chargeback'
  creditedAt: Timestamp | null
  createdAt: Timestamp; updatedAt: Timestamp
}
```

**O id do documento é o id do pedido.** É isso que torna o creditamento idempotente sem lógica extra: webhook duplicado tenta criar o mesmo documento, e a transação vê que ele já existe. Webhook de gateway *sempre* chega duplicado em algum momento.

**`ownerId` pode ser `null`.** O checkout acontece fora do app (link hospedado pela Kiwify), então nada garante que quem comprou já tenha conta. Nesse caso a compra fica órfã e é reivindicada pelo e-mail no primeiro login — ver §8.2.

### 2.6 `templates/{templateId}`

Presets de estilo curados por nós (leitura pública, escrita só admin). Cada um carrega fragmentos de prompt e uma imagem de exemplo.

```ts
interface TemplateDoc {
  id: string; name: string; description: string
  niches: string[]                // vazio = universal
  style: StyleId
  promptFragment: string          // injetado no prompt final
  negativePrompt: string | null
  previewPath: string
  isPremium: boolean; isActive: boolean; sortOrder: number
}
```

### 2.7 `creditLedger/{entryId}` e `stats/`

```ts
interface CreditLedgerDoc {
  id: string; ownerId: string
  delta: number                   // negativo = débito
  balanceAfter: number
  reason: 'generation' | 'refund' | 'purchase' | 'admin_adjust' | 'signup_bonus'
  refId: string | null
  createdAt: Timestamp
}
```

`stats/daily_{YYYY-MM-DD}` e `stats/global` são **contadores agregados** mantidos por triggers. O admin lê 2 documentos em vez de varrer 100k generations — o painel continua instantâneo com qualquer volume.

### 2.8 Índices compostos necessários

| Coleção | Campos |
|---|---|
| `generations` | `ownerId ASC, deletedAt ASC, createdAt DESC` |
| `generations` | `ownerId ASC, status ASC, createdAt DESC` |
| `generations` | `status ASC, createdAt DESC` (admin/monitoramento) |
| `projects` | `ownerId ASC, archivedAt ASC, updatedAt DESC` |
| `creditLedger` | `ownerId ASC, createdAt DESC` |
| `purchases` | `ownerId ASC, createdAt DESC` |
| `purchases` | `email ASC, creditedAt ASC` (reivindicação de compra órfã) |
| `generations` | `status ASC, updatedAt ASC` (cron de jobs travados) |
| `templates` | `isActive ASC, sortOrder ASC` |

Além dos índices, `firestore.indexes.json` publica um `fieldOverride` com `"ttl": true` em `generations.expiresAt` — é o que liga a política de retenção do §0.5. O override **precisa** listar os índices `ASCENDING`/`DESCENDING` explicitamente: `"indexes": []` desligaria a indexação do campo, e a rotina de limpeza consulta justamente `where('expiresAt', '<=', now)`.

### 2.9 Security Rules — princípios

```
users/{uid}          read: dono ou admin
                     update: dono, APENAS campos [displayName, company, brand, updatedAt]
                             → credits, role, stats bloqueados no cliente
generations/{id}     read: dono ou admin
                     create/update/delete: NEGADO (só Admin SDK)
                     → exclusão do usuário é soft delete via API
projects/{id}        read/write: dono, com validação de shape
purchases/{orderId}  read: dono | write: NEGADO
templates/{id}       read: autenticado | write: NEGADO
creditLedger/{id}    read: dono | write: NEGADO
stats/{id}           read: admin | write: NEGADO
```

Regra de ouro: **tudo que envolve dinheiro ou custo é escrito só pelo Admin SDK.**

### 2.10 Storage

```
users/{uid}/logo/{fileId}.{ext}              ← upload do cliente (≤2MB, image/*)
generations/{uid}/{genId}/original.png       ← escrita só pelo worker, apagado em 24h
generations/{uid}/{genId}/image.jpg
generations/{uid}/{genId}/thumb.webp
templates/{templateId}/preview.webp          ← leitura pública
```

Leitura restrita ao dono. Logo tem validação de `contentType` e tamanho na própria rule.

O prefixo `generations/` tem regra de ciclo de vida no bucket (`firebase/storage.lifecycle.json`): objetos com mais de 1 dia são removidos. A logo do usuário **não** expira — ela é configuração de marca, não resultado descartável.

---

## 3. Páginas e rotas

| Rota | Layout | Guard | Descrição |
|---|---|---|---|
| `/` | `default` | — | Landing: hero, exemplos, como funciona, preços, FAQ (prerender) |
| `/precos` | `default` | — | Pacotes de crédito e comparativo |
| `/login` | `auth` | `guest` | Google + email/senha |
| `/cadastro` | `auth` | `guest` | Signup |
| `/recuperar-senha` | `auth` | `guest` | Reset por email |
| `/app` | `app` | `auth` | **Dashboard**: saldo, artes, últimas gerações, atalhos |
| `/app/criar` | `app` | `auth` | **PromptForm** multi-etapa |
| `/app/gerando/[id]` | `app` | `auth` | Progresso em tempo real (onSnapshot) |
| `/app/post/[id]` | `app` | `auth` | **Resultado**: imagem, legenda, hashtags, downloads |
| `/app/historico` | `app` | `auth` | Grid com filtros, excluir, duplicar, baixar |
| `/app/projetos` | `app` | `auth` | Marcas do usuário |
| `/app/perfil` | `app` | `auth` | Nome, empresa, logo, cores padrão |
| `/app/creditos` | `app` | `auth` | Saldo, pacotes (link Kiwify) e extrato de compras |
| `/admin` | `admin` | `admin` | Métricas: usuários, gerações, MRR, custo OpenAI |
| `/admin/usuarios` | `admin` | `admin` | Busca, detalhe, ajuste manual de crédito |
| `/admin/geracoes` | `admin` | `admin` | Monitor de falhas e latência |
| `/admin/templates` | `admin` | `admin` | CRUD de presets |

**Por que `/app/gerando/[id]` é uma rota própria?** O usuário pode fechar a aba, atualizar a página ou voltar depois — o job continua no servidor e a URL sempre reflete o estado real. Se fosse só um modal, o estado se perderia.

---

## 4. Componentes

### 4.1 `components/ui/` — design system, zero regra de negócio

`UiButton` (primary/secondary/ghost/danger/link · 4 tamanhos · loading · ícones)
`UiCard` · `UiField` · `UiInput` · `UiTextarea` · `UiSelect` · `UiSwitch`
`UiModal` — `<dialog>` **nativo**, não overlay próprio
`UiDialogHost` (confirmação promise-based via `useDialog()`)
`UiToastContainer` (fila global no store, `aria-live` na região)
`UiSpinner` · `UiSkeleton` · `UiProgress` · `UiBadge` · `UiAvatar`
`UiTooltip` · `UiDropdown` · `UiTabs` · `UiEmptyState` · `UiCopyButton`

Três decisões que valem registro:

**`<dialog>` nativo no lugar de overlay próprio.** Entrega de graça o que costuma
sair errado à mão: foco preso dentro do modal, foco devolvido ao gatilho ao
fechar, Escape, resto da página inerte para leitor de tela, e renderização na
top-layer — acima de qualquer `z-index`, sem guerra de camadas.

**Acessibilidade por `provide/inject`, não por disciplina.** `UiField` gera o id
e injeta `for`, `aria-describedby` e `aria-invalid` nos controles filhos. Ligar
isso à mão funciona no primeiro formulário e é esquecido do terceiro em diante —
e é exatamente o que um leitor de tela precisa para anunciar o erro certo.

**`cn()` com `tailwind-merge`.** Sem ele, passar `class="bg-white"` para um botão
que já tem `bg-brand-600` deixa as duas classes no atributo, e quem vence é a que
aparece depois *no CSS gerado*, não no HTML — um override que às vezes pega e às
vezes não.

### 4.2 `components/layout/`

`AppNavbar` (busca, créditos, avatar, menu) · `AppSidebar` (nav + CTA de upgrade)
`AppShell` · `MarketingHeader` · `MarketingFooter` · `AppCreditBadge`

### 4.3 `components/generator/`

| Componente | Responsabilidade |
|---|---|
| `PromptForm` ✅ | Orquestra o wizard, valida e dispara a criação do job |
| `PromptStepBusiness` ✅ | Nicho, produto, descrição |
| `PromptStepOffer` ✅ | Preço, promoção, CTA |
| `PromptStepStyle` ✅ | Estilo, rede social, formato (template entra com o seed) |
| `PromptStepBrand` ✅ | Cores (`BrandColorPicker`), logo (`LogoUpload`) e instruções extras |
| `NicheSelect` ✅ | Campo livre com nichos sugeridos em chips |
| `SocialNetworkPicker` ✅ | Rede → restringe os formatos possíveis |
| `StyleGallery` ✅ | Grid visual de estilos, com radio nativo |
| `BrandColorPicker` ✅ | Paleta com contraste validado (WCAG) |
| `LogoUpload` ✅ | Upload direto ao Storage, com progresso e preview |
| `GenerationProgress` | Estados do job com microcopy por etapa |
| `ResultView` | Composição do resultado |
| `ImagePreview` | Zoom, formato, download |
| `CaptionBlock` / `HashtagBlock` | Texto + copiar |
| `ResultActions` | PNG, JPG, copiar, gerar novamente |

### 4.4 Demais

`HistoryGrid`, `HistoryCard`, `HistoryFilters`, `HistoryEmpty`
`PlanCard`, `PlanComparison`, `CreditMeter`, `UpgradeDialog`, `InvoiceList`
`AdminStatCard`, `AdminUserTable`, `AdminGenerationTable`, `AdminRevenueChart`

**Regra:** componente de UI não conhece Firebase. Componente de feature não faz `fetch` direto — chama composable ou store.

---

## 5. Composables e stores

### 5.1 Composables

| Composable | Papel |
|---|---|
| `useFirebase()` | Acesso às instâncias (app, auth, db, storage) |
| `useAuth()` | `user`, `isLoggedIn`, `loginGoogle`, `loginEmail`, `register`, `logout`, `resetPassword` |
| `useApi()` | `$fetch` com `Authorization: Bearer <idToken>` e tratamento de erro padronizado |
| `useUserDoc()` | Assinatura em tempo real de `users/{uid}` |
| `useGeneration(id)` ✅ | `onSnapshot` de um job + estados derivados |
| `useGenerations(filters)` | Lista paginada com cursor |
| `useCredits()` ✅ | Saldo, `canGenerate`, custo fixo por arte |
| `useLogoUpload()` ✅ | Upload da logo no Storage, com progresso e validação |
| `useDownload()` | Baixar PNG/JPG com nome de arquivo correto |
| `useClipboard()` | VueUse + toast |
| `useToast()` / `useDialog()` | APIs imperativas de feedback |
| `useAdminStats()` | Leitura dos agregados |

### 5.2 Stores (Pinia)

- `useAuthStore` — usuário, doc, claims, `initialized` (a UI espera esse flag antes de decidir rota)
- `useUiStore` — sidebar, toasts, modais
- `useGeneratorStore` ✅ — rascunho do formulário, persistido com `useLocalStorage` (não perde nada em refresh), validação por etapa e navegação do wizard
- `useHistoryStore` — cache de listagem e paginação

**Composable vs store:** store só quando o estado é global e compartilhado entre rotas. Assinatura de um documento específico é composable, com cleanup no `onScopeDispose`.

---

## 6. Fluxo de autenticação

### 6.1 Inicialização — carregamento sob demanda

```
authStore.waitUntilReady()          ← chamado pelos middlewares
  └─ $firebase.load()               ← import() dinâmico do SDK
       └─ initializeApp + getAuth + initializeFirestore(persistentLocalCache)
            └─ onIdTokenChanged(user)
                 ├─ authStore.user = user
                 ├─ lê custom claims (role)
                 ├─ assina users/{uid} em tempo real
                 └─ authStore.initialized = true
```

`onIdTokenChanged` em vez de `onAuthStateChanged`: dispara também no refresh do
token, mantendo as claims (ex.: `role: admin`) sempre atuais. Com
`onAuthStateChanged`, promover alguém a admin só teria efeito no próximo login.

**O SDK é carregado por `import()` dinâmico, nunca estaticamente.** São ~600KB;
importado no topo de um plugin, ele entra no chunk de entrada e é baixado em
toda rota — inclusive na landing prerenderizada, que não usa Firebase e é a
página mais sensível a LCP. Medido: com import estático o caminho crítico da
landing era 539KB; com `import()` caiu para 384KB, e o chunk do Firebase passou
a `prefetch` ocioso. Consequência de projeto: `waitUntilReady()` dispara o
carregamento na primeira chamada, então **todo código que depende de sessão
precisa aguardá-lo** — na prática, rodar sob um dos middlewares abaixo.

### 6.2 Cadastro e criação do perfil

O documento **nunca** é criado pelo cliente — se fosse, ele escolheria o próprio
saldo de créditos. As Security Rules negam `create` em `users/` justamente para
forçar o caminho do servidor.

Fluxo implementado:

```
cliente cria conta (Auth)
  └─ onSnapshot em users/{uid} → documento não existe → status 'provisioning'
       └─ POST /api/me/bootstrap        (Admin SDK, ignora as Rules)
            └─ transação: cria users/{uid} + entrada em creditLedger
                 └─ onSnapshot recebe o documento → status 'ready'
```

O endpoint é **idempotente**: a checagem de existência e a escrita ficam na
mesma transação, então duas abas, um retry de rede ou um refresh no meio do
cadastro nunca concedem o bônus duas vezes. No cliente há ainda uma guarda de
uma tentativa por sessão — se o bootstrap falhar, o documento continua ausente e
o `onSnapshot` dispararia de novo a cada retry, martelando a API.

Escolhemos endpoint síncrono em vez de trigger `onUserCreated` como caminho
principal porque o trigger é assíncrono: o app mostraria "0 créditos" por alguns
segundos após o cadastro. Na Etapa 7 o trigger entra **em adição**, para cobrir
contas criadas fora do app (console, importação).

**Credenciais do Admin SDK** são resolvidas em três cenários — service account
no `.env`, Application Default Credentials (`gcloud auth application-default
login`) ou credencial implícita do ambiente em produção. Suportar os três é o
que permite não versionar segredo em lugar nenhum.

Falha de credencial retorna **500**, não 401. Tratar erro de configuração como
erro de sessão faria a base inteira ver "sessão inválida" enquanto o problema
real está no servidor.

### 6.3 Middlewares

- `auth` — aguarda `initialized`, redireciona para `/login?redirect=` se anônimo
- `guest` — logado em `/login` vai para `/app`
- `admin` — exige claim `role === 'admin'`; o middleware é UX, **a segurança real está nas Rules e na API**

### 6.4 Autorização na API

Toda rota do Nitro passa por `requireAuth(event)`: lê o header `Authorization`, faz `verifyIdToken` (Admin SDK), devolve `{ uid, role }`. Sem token válido → 401. `requireAdmin` adiciona a checagem de claim.

Custom claim de admin é atribuída por script CLI (`scripts/set-admin.ts`), nunca pela aplicação.

---

## 7. Fluxo de geração de imagem

### 7.1 Etapas dentro do worker

```
1. LOAD      carrega generation + user + project + template
2. MODERATE  moderação do input (bloqueia conteúdo proibido) → falha = estorno
3. BRIEF     Responses API com Structured Outputs → CreativeBrief
4. RENDER    Images API (gpt-image-1) com o prompt do brief + logo como referência
5. PROCESS   sharp: PNG otimizado, JPG q90, thumb WebP 400px
6. UPLOAD    3 arquivos no Storage
7. COMMIT    status=completed, output, meta, custo; incrementa stats
```

Cada etapa atualiza `status` e `progress` no documento — o cliente vê o progresso real, não uma barra falsa.

### 7.2 O brief criativo (por que duas chamadas e não uma)

Um modelo de texto forte transforma dados crus ("Hamburgueria, X Bacon, R$29,90, batata grátis, preto e amarelo") em **direção de arte** — composição, iluminação, enquadramento, hierarquia tipográfica — além de legenda e hashtags. Modelos de imagem respondem muito melhor a um prompt descritivo e cinematográfico do que a uma lista de campos.

Saída via Structured Outputs (JSON Schema), então é tipada e validada:

```ts
interface CreativeBrief {
  imagePrompt: string          // prompt final de arte
  negativePrompt: string
  caption: string              // legenda pronta, com emojis, tom da marca
  hashtags: string[]           // 8-15, mix de alcance e nicho
  altText: string              // acessibilidade
  colorGuidance: string
  textOverlay: { headline: string; price: string | null; cta: string | null }
}
```

Custo: a chamada de texto é ordens de grandeza mais barata que a de imagem. O ganho de qualidade justifica com folga.

### 7.3 Formato por rede social

| Rede / formato | Tamanho | Proporção |
|---|---|---|
| Feed (Instagram/Facebook) | 1024×1024 | 1:1 |
| Story / Reels / TikTok | 1024×1536 | ~2:3 (9:16 por crop) |
| LinkedIn / capa | 1536×1024 | 3:2 |

O modelo de imagem aceita esses três tamanhos nativamente. Para 9:16 exato, o `sharp` faz o crop final a partir do 1024×1536.

### 7.4 Logo e texto: modo `ai` vs `hybrid`

Ponto de risco conhecido: modelos de imagem ainda erram texto pequeno e distorcem logos.

- **`ai`** (v1): logo entra como *imagem de referência* na Images API; todo o texto é renderizado pelo modelo. Resultado mais coeso e "orgânico", com risco ocasional de erro tipográfico.
- **`hybrid`** (v2): a IA gera só a cena/fundo; preço, CTA e logo são compostos deterministicamente com `sharp` a partir do `textOverlay` do brief. Texto sempre perfeito e logo intacta.

Arquitetura já prevê o campo `renderMode` no input; `hybrid` é um branch na etapa PROCESS, sem refatoração.

### 7.5 Falhas, retry e estorno

| Situação | Tratamento |
|---|---|
| Erro transitório da OpenAI (5xx, rate limit) | Retry com backoff exponencial, até 3 tentativas dentro do worker |
| Falha após todas as tentativas | `status=failed`, **estorno do crédito** em transação, ledger, toast no cliente |
| Conteúdo bloqueado por moderação | `status=failed`, código `content_policy`, **sem cobrança** |
| Worker morre (crash/timeout) | Cron `reconcileStuckJobs` marca como `failed` e estorna jobs presos > 10 min |
| Evento duplicado do Eventarc | Guard de idempotência: worker só processa se `status === 'queued'` |

Nenhum caminho deixa o usuário sem imagem **e** sem crédito.

### 7.6 Controle de custo

`meta.costUsd` é calculado por geração e agregado em `stats/daily_*`. O painel admin mostra **custo vs receita** — é isso que diz se o preço do pacote está certo. Guarda de segurança: teto diário global de gasto; ao estourar, novos jobs entram numa fila degradada e alertam por email.

---

## 8. Compra de créditos

### 8.1 Modelo: pacote pré-pago, sem mensalidade

**1 crédito = 1 arte gerada.** Regerar custa outro crédito, porque é outra chamada ao modelo de imagem. Não há tabela de preço por formato nem por qualidade: preço variável obrigaria o usuário a fazer conta antes de clicar, e a economia de API não paga esse atrito. O valor mora em `CREDIT_COST_PER_GENERATION`, em `shared/constants` — cliente e servidor leem o mesmo número.

| Pacote | Créditos | Preço | Por arte |
|---|---|---|---|
| Starter | 5 | R$ 29,90 | R$ 5,98 |
| Essencial | 10 | R$ 55,99 | R$ 5,60 |
| Pro | 20 | R$ 89,90 | R$ 4,50 |

Novo cadastro ganha **1 crédito** — o suficiente para ver o produto funcionando, não o suficiente para virar custo de API com quem nunca compra.

**Créditos acumulam e não expiram.** Sem ciclo, sem reset, sem saldo a vencer: `users.credits` só muda por compra, geração, estorno ou ajuste manual, e cada mudança deixa rastro em `creditLedger`.

### 8.2 Checkout: link hospedado, crédito pelo webhook

O gateway é a **Kiwify**, e o checkout é um link fixo por pacote — não há endpoint para criar sessão de compra:

```
Cliente → abre pack.checkoutUrl (nova aba, fora do app)
Kiwify  → cobra e confirma o pagamento
Kiwify  → POST /api/billing/webhook   → valida assinatura com o raw body
                                      → grava webhookEvents/{eventId} (idempotência)
                                      → cria purchases/{orderId}
                                      → casa o e-mail com users/{uid}
                                      → credita em transação + entrada no ledger
Cliente → o saldo aparece sozinho: users/{uid} já está em onSnapshot
```

O que isso simplifica: nenhuma sessão de checkout para criar, nenhum retorno de navegador para tratar, nenhuma página de "obrigado" que precise adivinhar se o pagamento passou. O usuário pode fechar a aba no meio do pagamento que o crédito entra do mesmo jeito.

O que isso custa: **o vínculo com a conta é o e-mail.** O checkout acontece fora do app, então não há `uid` para carregar até lá.

**Compra órfã.** Se o e-mail da compra não bate com nenhuma conta — a pessoa comprou antes de se cadastrar, ou usou outro e-mail — a compra é gravada com `ownerId: null` e `creditedAt: null`. No primeiro login, `POST /api/me/claim-purchases` procura compras pendentes com o e-mail *verificado* da conta e credita. Sem isso, comprar antes de criar a conta seria dinheiro entrando e crédito nenhum saindo — e viraria suporte manual.

Regras não negociáveis:

- **Idempotência primeiro.** Webhooks chegam duplicados. O id do documento em `purchases` é o id do pedido, e a criação acontece dentro da mesma transação do crédito: repetir o evento não credita duas vezes.
- **Assinatura sempre validada** com o raw body (`readRawBody`), com o token em `NUXT_KIWIFY_WEBHOOK_TOKEN`. Sem isso, qualquer um posta uma "compra" e se credita sozinho.
- **Só e-mail verificado reivindica compra.** Do contrário, cadastrar-se com o e-mail alheio roubaria a compra de outra pessoa.
- **Nunca confiar no retorno do navegador** para liberar crédito. Só o webhook concede.
- **Provider atrás de uma interface** (`PaymentProvider`), com um `mock` que roda todo o fluxo sem credencial externa. Trocar de gateway não toca em regra de negócio.

### 8.3 Eventos tratados

| Evento | Efeito |
|---|---|
| `purchase.paid` | Cria `purchases/{orderId}`, credita o pacote, entrada `purchase` no ledger |
| `purchase.paid` sem conta confirmada | Compra fica com `ownerId: null` — reivindicada em `/api/me/claim-purchases` |
| `purchase.refunded` | Marca a compra como `refunded` e **debita** os créditos concedidos (saldo pode ficar negativo — é dívida real, não bug) |
| `ignored` | Qualquer outro tipo: grava em `webhookEvents` e responde 200 |

> **Nota de integração (01/08/2026):** a Kiwify não documenta publicamente nem o
> algoritmo da assinatura nem o formato do payload. O provider aceita as
> variantes plausíveis (sha1/sha256 · hex/base64 · query ou header) e lê o
> payload por caminhos alternativos. Uma variante precisa bater com o token
> secreto — a tolerância evita o modo de falha "pagou e não recebeu", não
> afrouxa a validação. Com o primeiro evento real confirmado, dá para apertar
> para uma única variante; o log em dev diz qual bateu.
>
> Enquanto `NUXT_KIWIFY_WEBHOOK_TOKEN` estiver vazio **em desenvolvimento**, o
> endpoint entra em *modo de inspeção*: registra query, headers e corpo, e não
> credita nada. É como se descobre o formato real sem arriscar creditar um
> `curl` qualquer.

O pacote é resolvido em cascata (`resolvePack`): id de produto configurado por ambiente → valor pago → nome do produto. O id de produto é o único critério realmente confiável, mas depende de alguém preencher a env var — e um webhook chegando antes disso não pode virar crédito perdido.

---

## 9. Design system

**Referências:** Vercel (contraste e tipografia), Linear (densidade e velocidade), Framer (movimento), Notion (calma), Canva (galeria visual), Raycast (command palette).

Tokens (CSS variables consumidas pelo Tailwind):

- **Superfícies:** `#FFFFFF` base, `#FAFAFA` sutil, `#F4F4F5` elevado
- **Borda:** `#E4E4E7` / hover `#D4D4D8` — borda de 1px é a principal ferramenta de separação, não sombra pesada
- **Texto:** `#09090B` / `#52525B` / `#A1A1AA`
- **Acento:** violeta→índigo em gradiente, usado com parcimônia (CTA e estados ativos)
- **Raio:** 8 / 12 / 16 / 24px — cards em 16px
- **Sombra:** dois níveis apenas, muito suaves
- **Tipografia:** Inter (UI) + Instrument/Geist para display; escala 12→48
- **Espaçamento:** múltiplos de 4, com respiro generoso (seções em 64–96px)
- **Movimento:** 150ms para hover, 250ms para entrada, curva `cubic-bezier(.4,0,.2,1)`; tudo respeita `prefers-reduced-motion`

Acessibilidade não é etapa final: contraste AA, foco visível, navegação por teclado nos modais, `aria-live` nos toasts e no progresso.

---

## 10. Roadmap de implementação

| Etapa | Entrega | Depende de |
|---|---|---|
| ~~**1**~~ | ~~Fundação: deps, Tailwind + tokens, config Nuxt, tipos e constantes em `shared/`~~ ✅ | — |
| ~~**2**~~ | ~~Design system `ui/` completo + página de showcase~~ ✅ (`/ui`) | 1 |
| ~~**3**~~ | ~~Firebase: plugin, Auth, stores, middlewares, páginas de login/cadastro~~ ✅ | 1 |
| ~~**4**~~ | ~~Layouts e shell do app (navbar, sidebar) + dashboard com dados reais~~ ✅ | 2, 3 |
| **5** | Firestore rules ✅, índices ✅, Storage rules ✅, bootstrap de `users/{uid}` ✅, seed de templates ⏳ | 3 |
| ~~**6**~~ | ~~`PromptForm` completo com validação e rascunho persistido~~ ✅ (`/app/criar`) | 2, 4 |
| ~~**7**~~ | ~~Backend de geração: `server/api`, transação de créditos, worker, OpenAI, cron de retenção~~ ✅ | 5, 6 |
| **8** | Tela de resultado completa (downloads PNG/JPG, copiar, gerar novamente) — o progresso em tempo real já está de pé | 7 |
| **9** | Histórico, projetos e perfil | 8 |
| **10** | Créditos: página de pacotes ✅, webhook Kiwify ✅, reivindicação por e-mail ✅, extrato de compras ⏳ | 7 |
| **11** | Admin: agregados, painéis, ajustes manuais | 10 |
| **12** | Landing page + SEO + deploy (app na Vercel, background no Firebase) | todas |

Cada etapa fecha funcionando e testável — nada de "só funciona no fim".
