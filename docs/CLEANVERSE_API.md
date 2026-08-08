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

### POST `/query_deposit_atoken_list` — plain

Returns origin USDC ↔ aUSDC (CVA) pairs per chain. Use `{ "chain": "monad" }` only (not user wallet as `address`).

Product DvP cash leg: **aUSDC** `0xaC0893567D43C3E7e6e35a72803df05416C1f20D` (not ungated origin USDC).

### POST `/validator/is_register` · `/validator/verify` — plain

Monad UAT Validator contract: `0xaC7e5179C2C7f03f209136886c172eb34F161792` (Telegram pinned CCP guide).

**Compliance pool (registered):** `CleanverseCompliancePool` `0x8eC6b0CcC52aBf6dB6f71844eD468f20EA427748` — Ownable, `owner = wallet A`. Register tx: `0x0922080da02b6eafbb058168e96a9c5f2d91adb81307cf64d1fcab48c656cdfc`.

**DvPEscrow (settlement only):** `0x1860b3182CAd1813Ce0F992E446e87Fb0FD93417` — Safe `AccessControl` admin, **cannot** be validator-registered (no `owner()`).

#### Validator module — full flow (docs v5.6)

**Read endpoints (plain JSON):** `is_register`, `rules`, `verify`, `is_paused`

**Write endpoints (AES encrypted `{"data":"..."}`):** `grant`, `register`, `set_rule`, `add_rule`, `remove_rule`, `set_paused`

**Two-step on-chain model (docs):**

1. **`POST /validator/grant`** — grants `REGISTER_ROLE` on the Validator contract to an `address`.
2. **`POST /validator/register`** — registers a **compliance pool** (`contract_address`) with an initial `rule` object.

Both `grant` and `register` require `owner_signature` in the encrypted plaintext.

#### Owner signature spec (exact — docs)

| Field | Value |
|-------|-------|
| Algorithm | EIP-191 `personal_sign` |
| Encoding | 65-byte hex (`0x` + r + s + v) |
| Message | **lowercase** chain slug concatenated with **lowercase** hex address, **no separator** |
| `grant` signs | `chain` + `address` (account receiving `REGISTER_ROLE`) |
| `register` signs | `chain` + `contract_address` (pool being registered) |

Example message: `base0x742d35cc6634c0532925a3b844bc9e7595f0beb0`

**Verification (docs):** Cleanverse recovers the signer and checks it equals **`owner()` on-chain** of the subject address (`address` for grant, `contract_address` for register).

> Grant note: *"Signed grant is intended for smart contract addresses that expose `Ownable.owner()`. The contract owner must sign `chain + address` before the registrar role is granted to that contract."*

**Docs do not document:** Safe multisig, EIP-1271, or `AccessControl` / `DEFAULT_ADMIN_ROLE` as signature subjects. No `multisig` / `Safe` mentions in v5.6.

#### `POST /validator/verify` — plain

```json
{
  "chain": "monad",
  "contract_address": "0x8eC6b0CcC52aBf6dB6f71844eD468f20EA427748",
  "user_address": "0x9AE53a6d3c8E8955D1bAA660B4aBd477Fe512C2b"
}
```

- HTTP 200 + `code: "0000"` means the API call succeeded.
- `data.valid: true/false` is the **compliance outcome**, not an API error.
- Pool must be **registered** and **not paused**.
- Unregistered pool → gateway may return **`12027`** (on-chain read failed) — expected until register succeeds.

#### Error codes (validator)

| Code | Meaning |
|------|---------|
| `0001` | Parameter/signature error — includes **`Invalid contract owner signature.`** |
| `0002` | Business failure (check `message` for sub-codes) |
| `12026` | Validator on-chain **write** failed (grant, register, rule, pause) |
| `12027` | Validator on-chain **read** failed (verify on unregistered/paused pool) |

#### ClearNote architecture (settlement vs validator pool)

| Contract | Role | Validator register |
|----------|------|-------------------|
| `CleanverseCompliancePool` | Validator API pool (`owner = wallet A`) | **registered** |
| `DvPEscrow` | DvP settlement (Safe admin) | **cannot** — no `owner()` |
| `ClearNotePolicy` | On-chain note leg `inspect()` | decorator, not a pool |

#### Live status (2026-08-08)

| Check | Status |
|-------|--------|
| `verify_apass` CLINV01 + aUSDC | code **4** |
| `ClearNotePolicy.inspect()` on-chain | implemented + tested |
| Real DvP fill aUSDC ↔ CLINV01 (×2) | [offer0](https://testnet.monadscan.com/tx/0x087c67116df60a51dda6c5391a2cb781a35da669e82ff754cadd766f8c6ceec7) · [offer1](https://testnet.monadscan.com/tx/0xa7747e952836e7caa09df11f33b70e5b608d04e0224fcef07768dc30673fcaae) |
| `validator/is_register` compliance pool | **registered** |
| `validator/verify` wallet B on pool | **`valid: true`** |

Scripts: `pnpm validator:register-pool` · `pnpm deploy:compliance-pool`

### POST `/query_ramp_quote` — plain

Fiat → USDC on-ramp quote for investor funding. See `app/app/api/cleanverse/ramp/quote/route.ts`.

### POST `/faucet` — plain (not encrypted)

```json
{ "chain": "monad", "symbol": "ausdc", "depositAddress": "<wallet>", "amount": "1000000" }
```

Sandbox faucet may return insufficient balance / NoAPass on deposit wallets.


### GET `/atoken/list_my_atokens` — query params

`?page=1&page_size=20&chain=monad` — **GET**, not encrypted POST.

## Live probe

```bash
pnpm cleanverse:doctor
```

## Do not claim

- Cleanverse enforces tier/blacklist **on-chain** (API-only for `min_tier` / industry blacklist).
- `query_txs` covers indexed stablecoin/A-Token symbols only, not arbitrary partner tokens.
