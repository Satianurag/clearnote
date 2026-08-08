# Cleanverse API v5.6 — integration notes (from docs.cleanverse.com)

Official docs: https://docs.cleanverse.com/docs/cleanverse (invitation code required).

Sandbox base: `https://uatapi.cleanverse.com/api/cooperate`

## Auth

- Header: `api-id: <APP_ID>` on **every** request.
- `api-key` is **only** for AES encrypt/decrypt locally — never send in headers.

## Plain JSON vs encrypted body

**Plain JSON** (no `data` wrapper): Common Queries including `query_apass`, `verify_apass`, `query_txs`; Validator reads (`validator/verify`, `validator/rules`, …); all Fiat Ramp endpoints.

**AES encrypted** `{"data":"<base64>"}`: `generate_apass`, `update_status`, `atoken/launch`, `atoken/add_rule`, validator **writes**, etc. Algorithm: AES-256-CBC, IV = 16 zero bytes, key = base64-decode(api-key).

## Endpoints we use

### POST `/query_apass` — plain

```json
{ "chain": "monad", "address": "0x..." }
```

Response `code: "0000"`, flat `data` with `tier`, `cvRecordId`, `countries`, `expirationTime` (unix **seconds**). No nested wallets — use `query_deposit_address` for deposits.

### POST `/verify_apass` — plain

```json
{
  "chain": "monad",
  "atoken": "0xEae6ef4f62B735789bD0d899f5f6f2993488Fe69",
  "address": "0x9AE53a6d3c8E8955D1bAA660B4aBd477Fe512C2b"
}
```

**`atoken` = contract address**, not symbol (`CLINV01` fails validation).

Inner `data.code`: `4` = success, `2` = no A-Pass, `3` = frozen/expired.

### POST `/query_txs` — plain

Uses `address` + optional `symbol` (`usdc`, `ausdc`, …). Custom product tokens (CLINV01) return `0002 invalid symbol` — use Envio indexer for CLINV01 history.

### POST `/validator/verify` — plain

```json
{
  "chain": "monad",
  "contract_address": "<pool or token>",
  "user_address": "0x..."
}
```

`code: "0000"` with `data.valid` true/false is success. `12027` = pool not registered on Cleanverse — product compliance uses on-chain `ClearNotePolicy.inspect()` instead.

### GET `/atoken/list_my_atokens` — query params

`?page=1&page_size=20&chain=monad` — **GET**, not encrypted POST.

## Live probe

```bash
pnpm cleanverse:doctor
```

## Do not claim

- Cleanverse enforces tier/blacklist **on-chain** (API-only for `min_tier` / industry blacklist).
- `query_txs` covers indexed stablecoin/A-Token symbols only, not arbitrary partner tokens.
