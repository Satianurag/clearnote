# ClearNote App

Next.js demo UI for Monad testnet — live `inspect()`, Envio-backed manifest, five WO-10 surfaces.

## Dev

```bash
cd clearnote
pnpm dev    # http://localhost:3000
```

Copy `app/.env.example` → `app/.env.local` (addresses match `deployments/monad-10143.json`).

## Indexer

```bash
cd clearnote/indexer
pnpm codegen
cd generated && HASURA_EXTERNAL_PORT=8082 docker compose up -d
pnpm install && pnpm codegen && pnpm build && pnpm db-setup
TUI_OFF=true pnpm start
```

GraphQL: `http://localhost:8082/v1/graphql` (admin secret `testing`).

## Routes

| Path | Surface |
|------|---------|
| `/exporter` | Invoice upload |
| `/exporter?tab=originator` | Seed portfolio |
| `/investor` | DvP + pre-flight inspect |
| `/compliance/matrix` | Live reason-code matrix |
| `/compliance?tab=regulator` | OFAC / audit |

## API

| Route | Body |
|-------|------|
| `GET /api/seed` | `seed/manifest.json` |
| `POST /api/cleanverse/apass` | `{ "address": "0x…", "chain": "monad" }` |
