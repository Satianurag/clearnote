# ClearNote

Production-ready demo app for ClearNote hackathon — Monad testnet, Cleanverse compliance, Envio indexer.

## Surfaces

| Route | Purpose |
|-------|---------|
| `/` | Dashboard + deployed addresses |
| `/transfers` | MetaMask wallet transfer test (CLLAT01) |
| `/activity` | CLNOTE02/CLLAT01 transfers via Envio GraphQL |
| `/minidvp` | MiniDvP atomic settle |
| `/compliance` | A-Pass lookup (server proxy) |

## Local development

```bash
# 1) Indexer (Docker + sync) — canonical path: clearnote/indexer
cd clearnote/indexer
pnpm codegen
cd generated && HASURA_EXTERNAL_PORT=8082 docker compose up -d
pnpm install && pnpm codegen && pnpm build && pnpm db-setup
TUI_OFF=true pnpm start

# 2) Web app (production UI: clearnote/app)
cd clearnote/app
cp .env.example .env.local
pnpm dev
```

Open http://localhost:3000

## Production build

```bash
cd ~/Desktop/clearnote-browser-test
npm run build
npm run start
```

## Cloud deploy (full stack)

```bash
cd ~/Desktop
cp .env.production.example .env.production
# Fill CLEANVERSE_API_ID, CLEANVERSE_API_KEY, strong HASURA/POSTGRES secrets

docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Verify:

```bash
./scripts/verify-clearnote.sh
```

## Security

- Cleanverse API keys and Hasura admin secret are **server-only** — never `NEXT_PUBLIC_*`
- Do not commit `.env.local` or `.env.production`
- Change default `testing` Hasura secret before cloud deploy

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Service health |
| `GET /api/indexer?limit=25` | Indexed transfers proxy |
| `POST /api/cleanverse/apass` | `{ "address": "0x…", "chain": "monad" }` |
