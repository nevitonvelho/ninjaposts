# Infra do Firebase

Regras, índices e políticas de retenção. Tudo aqui é versionado porque é
configuração de produção — mudar pelo console cria divergência silenciosa entre
o que o código assume e o que o banco faz.

## Deploy

```bash
npm run firebase:rules      # firestore.rules + storage.rules
npm run firebase:indexes    # firestore.indexes.json (inclui a política de TTL)
npm run firebase:lifecycle  # regra de ciclo de vida do bucket (requer gcloud)
```

## Retenção das artes — 24 horas

A arte gerada vive por 24h e some. São **três** mecanismos, e cada um existe por
um motivo diferente:

| Mecanismo | O que apaga | Por quê |
|---|---|---|
| Cron de limpeza (Cloud Function, Etapa 7) | Documento + arquivos, juntos | É o único que garante o par consistente: some a imagem e o registro na mesma passada |
| TTL do Firestore em `generations.expiresAt` | Só o documento | Rede de segurança: se o cron falhar por dias, o banco não acumula |
| Ciclo de vida do bucket (`storage.lifecycle.json`) | Só os arquivos em `generations/` | Rede de segurança do lado do Storage, pelo mesmo motivo |

TTL e ciclo de vida são **best effort**: o Google executa as duas varreduras uma
vez por dia, então um objeto pode sobreviver algumas horas além do prazo. Por
isso a limpeza precisa do cron — as redes de segurança sozinhas não entregam a
promessa de 24h feita ao usuário.

### Aplicar a regra do bucket

O Firebase CLI não gerencia ciclo de vida de objeto; isso é API do Cloud Storage:

```bash
gcloud storage buckets update gs://SEU_BUCKET --lifecycle-file=firebase/storage.lifecycle.json
```

### Conferir a política de TTL

```bash
gcloud firestore fields ttls list
```

O `firebase deploy --only firestore:indexes` já publica o `fieldOverrides` com
`"ttl": true` — não é preciso habilitar pelo console.
