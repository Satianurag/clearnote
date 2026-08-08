# Notion sync — copy-paste pack (post-redeploy v3.2)

Use this page to update hackathon Notion / pitch docs. Canonical on-chain JSON: `deployments/monad-10143.json`.

## Live addresses (Monad 10143)

| Artifact | Address |
|----------|---------|
| InvoiceRegistry | `0x8A515D80279eEfa9f3eC76568257b1f1eF76d534` |
| ClearNoteController | `0xfE622a9EAEdf047a2379Eb9C7436B8dc2E1D1bAA` |
| ClearNotePolicy v3.2 | `0xa36F46f2631bc092E319d7Ab4cCAA97b9cD63890` |
| DvPEscrow | `0x1860b3182CAd1813Ce0F992E446e87Fb0FD93417` |
| CLINV01 (product) | `0xEae6ef4f62B735789bD0d899f5f6f2993488Fe69` |
| Safe 2-of-3 | `0xb544d5efb15fbae3b3ad4b1ec3594ffeb0926593` |
| Cleanverse BASE | `0x36489be45fa84f70a0c2bdb11d824be608cb12dd` |
| A-Pass registry | `0xbA82D189540CaC9DC6FF46B6837CaC1BFdEC58B9` |

Deprecated (history only): controller `0xcbF5382C7C6Cf3951F7F5C8F693e60eCeaDb3565`, DvPEscrow `0x2a226bB79De58641F2fa05CcbF3d2Be88761FF6C`.

## Policy v3.2 highlights

- `ApassLookupFailed` (`0xba7cb6e7`) — tier gate **fail-closed** when registry configured
- `onTransfer` no longer resets lockup on secondary DvP buyer (lockup only on `issueNote`)
- CLINV01 `maxPositionBps` = 10000 (100%) on testnet

## 13 reason codes (pitch table)

| Selector | Meaning |
|----------|---------|
| `0xa6725971` | No A-Pass (Cleanverse) |
| `0x322fde89` | Frozen / revoked (Cleanverse) |
| `0x51d86cca` | Country not permitted (Cleanverse) |
| `0xaecc0dbe` | A-Pass expired (Cleanverse) |
| `0x1513ddcb` | Position cap exceeded |
| `0x6294ca98` | Lockup active |
| `0xe3e32fdb` | Tier too low |
| `0x80279111` | Sanctioned address |
| `0xba7cb6e7` | A-Pass lookup failed (fail closed) |
| `0x0505a996` | Maximum investor count |
| `0x90e3871c` | Transfers paused |
| `0x0185f166` | Note not backed |
| `0x3f70126b` | Policy not configured |

## Post-redeploy proof txs (v3.2)

Explorer: https://testnet.monadscan.com

| Proof | Tx hash |
|-------|---------|
| CLINV01 setPolicy v3.2 | `0x022c614a90a417453fd7ce75367eaafc51e54c4f7a7a8821d3e2030ed825740c` |
| B→B2 transfer (v3.2) | `0x169d04538a5d05f07ee4590ca57413bd75f0d3ef96c56336f781c82115dea49d` |
| issueNote new controller | `0xd9a286f0e897209bbf83e3b2f2c8574198f0f243fb6a325ebed3da20d3b88f3d` |
| CLINV01 MINTER → new controller | `0xfc2c7c7f40c01d91f0deecf2f372640b53201e82a77364f1cd5fb95fdd700b4c` |

Inspect B→B2: `ok:true code:0x00000000` — recorded in JSON as `e2e.clinv01InspectBtoB2_v32`.

## Do not claim in pitch

- Cleanverse enforces tier / blacklist **on-chain**
- Gasless onboarding (type-4 only; sponsored onboarding = next step)
- On-chain policy denial events (STATICCALL hook)

## Verification commands (demo)

```bash
forge test                    # 38 tests
pnpm verify:wo08              # live inspect on testnet
pnpm verify:wo15              # truth pass
pnpm seed:verify              # 13 manifest / 11 financed
pnpm verify:indexer           # Envio GraphQL
```
