# ClearNote — Claims vs Evidence

Every public claim must have a tx hash or Foundry test name. If neither exists, do not pitch it.

| Claim | Evidence |
|-------|----------|
| Invoice duplicate financing blocked | `test_duplicateFinancing_isBlocked` · `pnpm seed:verify` INV-011 duplicate revert |
| PayeeParty excluded from docHash | `pnpm pint:test` — 5 checks including same_invoice_different_factor |
| BASE delegation preserved in policy | `test_baseRevertBubblesUnchanged` · `pnpm verify:wo08` no-apass `0xa6725971` |
| Human cannot mint product token | `pnpm verify:wo08` — A lacks MINTER, mint reverts |
| Controller-only mint via Safe | `issueNote` txs in `seed/manifest.json` · `NoteIssued` indexer events |
| Live compliant transfer B→B2 (v3.2 policy) | `deployments/monad-10143.json` → `e2e.clinv01TransferBtoB2_v32` |
| Live inspect() permits B→B2 | `e2e.clinv01InspectBtoB2_v32` · `/compliance/matrix` |
| Fresh issueNote on redeployed controller | `e2e.controllerIssueNote_v32` · `e2e.controllerIssueInvoiceId_v32` |
| Tier / sanctions / frozen / lockup rules | `pnpm verify:wo08` — live `inspect()` selectors |
| Tier gate fail-closed when registry configured | `test_apassRegistryRevert_failClosed` · selector `0xba7cb6e7` |
| Secondary DvP buyer not re-lockuped | `test_secondaryBuyerCanResellAfterOriginalLockup` |
| DvP cash leg atomic with note | `test_nonCompliantBuyer_cashUntouched` in `DvPEscrow.t.sol` |
| OFAC merkle on-chain | `pnpm ofac:build` · Safe `commitRoot` tx `e2e.ofacCommitRoot` |
| Audit pack anchored (hash only) | `pnpm audit:pack INV-001` · `e2e.auditAnchor_INV-001` |
| Indexer replaces RPC log history | `pnpm verify:indexer` — Registry + NoteIssued aggregates |
| Cleanverse sandbox API (live probe) | `pnpm cleanverse:doctor` |
| SWC-104 fail-open hook documented | `docs/SECURITY.md` |
| CLNOTE02 never setPolicy | `pnpm verify:wo08` · `pnpm verify:wo15` — `policy()` = BASE `0x36489be45fa84f70a0c2bdb11d824be608cb12dd` |
| CLLAT01 footage rolled back to BASE | `pnpm verify:wo15` — `policy()` = BASE after demos |
| 13 live reason codes (UI + README) | `services/src/reasonCodes.ts` · `pnpm verify:wo15` cast sig cross-check |
| Position cap 100% on CLINV01 (testnet) | `e2e.clinv01MaxPositionBps` = 10000 · `docs/SECURITY.md` |
| Frozen recover runbook | `docs/SECURITY.md` — unfreeze → recover → re-freeze |

## On-chain addresses (full — no truncation in submission)

| Name | Address |
|------|---------|
| Cleanverse BASE router | `0x36489be45fa84f70a0c2bdb11d824be608cb12dd` |
| A-Pass registry (proxy) | `0xbA82D189540CaC9DC6FF46B6837CaC1BFdEC58B9` |
| ClearNotePolicy v3.2 (live) | `0xa36F46f2631bc092E319d7Ab4cCAA97b9cD63890` |
| ClearNoteController (live) | `0xfE622a9EAEdf047a2379Eb9C7436B8dc2E1D1bAA` |
| CLINV01 product token | `0xEae6ef4f62B735789bD0d899f5f6f2993488Fe69` |
| Safe 2-of-3 | `0xb544d5efb15fbae3b3ad4b1ec3594ffeb0926593` |

Canonical JSON: `deployments/monad-10143.json`

## Do not claim

- Cleanverse contract enforces investor tier or `is_black_list` on-chain.
- Gasless onboarding (only type-4 acceptance; sponsored onboarding is a documented next step).
- On-chain denial events from policy hook (STATICCALL).
- PII on-chain in IVMS — only `ivmsHash` / pack hashes in `AuditAnchor`.
