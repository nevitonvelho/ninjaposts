# Cloud Functions

Trabalho de background do NinjaPosts. A API HTTP **não** está aqui — ela é o
servidor Nitro do Nuxt (§0.2 da arquitetura).

| Função | Gatilho | O que faz |
|---|---|---|
| `onGenerationCreated` | `generations/{id}` criado | O worker: briefing → imagem → recorte → upload → commit |
| `cleanupExpiredGenerations` | a cada 60 min | Apaga documento **e** arquivos das artes vencidas (24h) |
| `reconcileStuckJobs` | a cada 10 min | Estorna jobs presos há mais de 10 min |

## Antes do primeiro deploy

```bash
npm install --prefix functions

# A chave da OpenAI vive no Secret Manager, não no .env:
firebase functions:secrets:set OPENAI_API_KEY

# Opcional — trocar de modelo sem mexer no código:
firebase functions:config:set   # (ou defina OPENAI_BRIEF_MODEL / OPENAI_IMAGE_MODEL no .env do deploy)
```

O projeto precisa estar no plano **Blaze**: Functions de 2ª geração, Eventarc e
Cloud Scheduler não existem no plano gratuito.

## Deploy

```bash
firebase deploy --only functions
```

O `predeploy` do `firebase.json` roda o `tsc` antes. O build compila `src/` e
`../shared/` para dentro de `lib/`, preservando a hierarquia — por isso o
`main` aponta para `lib/functions/src/index.js`. Os imports de `shared/` são
relativos, sem alias: alias de TypeScript não existe em runtime.

## Custo

`meta.costUsd` é **estimativa** (ver `src/services/cost.ts`), não fatura.
Serve para o painel admin e para o teto diário. Revise a tabela quando a OpenAI
mudar de preço.
