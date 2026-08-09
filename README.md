# ClearNote

Invoice-backed trade-finance notes on **Monad testnet (10143)**, with **ClearNotePolicy v3.2** decorating Cleanverse A-Token compliance (BASE router first, then our rules).

## 10-minute quickstart

```bash
cd clearnote
pnpm install
forge test                           # 40 contract tests
pnpm seed:verify                     # 13 manifest rows / 11 financed on-chain
pnpm verify:wo08                     # CLINV01 wiring + live inspect()
pnpm pint:test && pnpm ivms:test
pnpm ofac:build                      # needs ~/Desktop/sdn.csv
pnpm cleanverse:doctor               # needs cleanverse.env credentials
pnpm verify:cva                      # CVA + DvP fills + compliance pool (live testnet)
pnpm verify:indexer                  # Envio GraphQL (indexer must be running)
pnpm verify:wo00                     # repo + typecheck gate
pnpm verify:wo15                     # truth pass (claims vs evidence)
pnpm dev                             # app http://localhost:3000
```

**Indexer** (port **8082**, not 8080):

```bash
cd indexer && pnpm codegen
cd generated && HASURA_EXTERNAL_PORT=8082 docker compose up -d
pnpm install && pnpm codegen && pnpm build && pnpm db-setup
TUI_OFF=true pnpm start              # first sync from block 51720000 may take several minutes
```

GraphQL: `http://localhost:8082/v1/graphql` · admin secret: `testing`

## Deployed (Monad 10143)

Canonical JSON: `deployments/monad-10143.json`

| Contract | Address |
|----------|---------|
| InvoiceRegistry | `0x8A515D80279eEfa9f3eC76568257b1f1eF76d534` |
| ClearNoteController | `0xfE622a9EAEdf047a2379Eb9C7436B8dc2E1D1bAA` |
| ClearNotePolicy **v3.2** (product) | `0xa36F46f2631bc092E319d7Ab4cCAA97b9cD63890` |
| SanctionsRegistry | `0xF7E706B7956546F213aB9B0DcFD13d1a731B6612` |
| DvPEscrow | `0x1860b3182CAd1813Ce0F992E446e87Fb0FD93417` |
| CleanverseCompliancePool (validator API) | `0x8eC6b0CcC52aBf6dB6f71844eD468f20EA427748` |
| Cleanverse Validator (UAT) | `0xaC7e5179C2C7f03f209136886c172eb34F161792` |
| AuditAnchor | `0x93806a81533790e4e1736C227C7eA5aBc6D4cc7F` |
| CLINV01 (product token) | `0xEae6ef4f62B735789bD0d899f5f6f2993488Fe69` |
| CLLAT01 (footage only) | `0x13aDF50039Db284B380f06FD4be0061C30A92c96` |
| CLNOTE02 (history — never setPolicy) | `0xDAA42E5c1A8B9724F499729609f166B0D140Ec18` |
| Safe 2-of-3 | `0xb544d5efb15fbae3b3ad4b1ec3594ffeb0926593` |
| Cleanverse BASE router | `0x36489be45fa84f70a0c2bdb11d824be608cb12dd` |
| Cleanverse A-Pass registry | `0xbA82D189540CaC9DC6FF46B6837CaC1BFdEC58B9` |
| Monad USDC (6 decimals) | `0x534b2f3A21130d7a60830c2Df862319e593943A3` |

Policy v2 (`0x3d5c0027792B576C62a35C2f4E7bF17Ac54dCfbb`) is superseded — live policy is **`policy`** in `deployments/monad-10143.json` (v3.2 bytecode).

**Post-redeploy proofs (v3.2 on CLINV01):** `e2e.clinv01TransferBtoB2_v32`, `e2e.clinv01InspectBtoB2_v32`, `e2e.controllerIssueNote_v32` in the same JSON file.

**Live DvP fills (aUSDC cash leg):** `e2e.dvpFillAusdc_offer0`, `e2e.dvpFillAusdc_offer1` — two real settlements on DvPEscrow.

## App routes

| Route | Purpose |
|-------|---------|
| `/` | Marketing landing page (`public/landing.html`) |
| `/dashboard` | Demo hub — links to all product surfaces |
| `/exporter` | Invoice upload flow |
| `/exporter?tab=originator` | Portfolio from `seed/manifest.json` |
| `/investor` | DvP + pre-flight `inspect()` |
| `/compliance/matrix` | Live reason-code matrix |
| `/compliance?tab=regulator` | OFAC / audit packs |

## Reason codes

| Selector | Meaning |
|----------|---------|
| `0xa6725971` | No A-Pass (Cleanverse) |
| `0x322fde89` | Frozen / revoked (Cleanverse) |
| `0x1513ddcb` | Position cap exceeded (ClearNote) |
| `0x6294ca98` | Lockup active (ClearNote) |
| `0xe3e32fdb` | Tier too low (ClearNote) |
| `0x80279111` | Sanctioned address (ClearNote) |
| `0xba7cb6e7` | A-Pass lookup failed — fail closed (ClearNote) |
| `0x0505a996` | Maximum investor count reached (ClearNote) |
| `0x90e3871c` | Token transfers paused (ClearNote) |
| `0x0185f166` | Note token has no invoice backing (ClearNote) |
| `0x3f70126b` | Policy not configured — fail closed (ClearNote) |
| `0x51d86cca` | Country not permitted (Cleanverse) |
| `0xaecc0dbe` | A-Pass expired (Cleanverse) |

Full map: `services/src/reasonCodes.ts` (mirrored in `app/lib/reasonCodes.ts`)

## Testing vs live testnet

- **Live proofs** — `deployments/monad-10143.json`, `pnpm verify:wo08`, `pnpm seed:verify`, `pnpm cleanverse:doctor` (sandbox API), and Envio indexer (`pnpm verify:indexer`).
- **`forge test`** — 40 in-process Foundry tests with minimal **harness** contracts (`contracts/test/*Harness*`) for isolated rule coverage; not a substitute for testnet txs.

## Honest limitations

- Cleanverse `min_tier` / `is_black_list` are **API-only** — we enforce tier and OFAC on-chain.
- Policy hook is **STATICCALL** — no on-chain denial events; `inspect()` + audit-pack denial log.
- `eth_getLogs` capped at **100 blocks** on Monad RPC — history via Envio indexer only.
- Sandbox gaps: `query_txs` for custom product symbols (CLINV01) — use Envio indexer + on-chain `inspect()` instead. `verify_apass`, `query_deposit_atoken_list`, and validator pool checks are live (`pnpm cleanverse:doctor`, 9 probes).
- Frozen wallet burn blocked by BASE — see `docs/SECURITY.md` recover runbook (unfreeze → recover → re-freeze).
- **No gasless onboarding claim** — EIP-7702 type-4 accepted; sponsored onboarding is a documented next step.
- OFAC list: **72 real SDN EVM + 3 synthetic testnet** addresses (`seed/ofac/ofac-root.json`).
- IVMS101 / PII: only **hashes** on-chain (`AuditAnchor`); payloads stay in audit packs off-chain.
- `.env.local` is gitignored; never commit API keys — rotate if a key was ever shared outside git.

## License

See LICENSE.
