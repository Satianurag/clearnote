# Security

## SWC-104 — Unchecked Call Return Value (A-Token policy hook)

Cleanverse A-Tokens call `canTransfer(token, from, to, amount)` via **STATICCALL** and **ignore the boolean return value**. A policy that returns `false` does **not** block transfers.

**Impact:** Fail-open if a policy uses `return false` instead of `revert`.

**Reproduction:** Deploy a policy that returns `false` from `canTransfer` — transfers still succeed.

**Our mitigation:** ClearNotePolicy **only denies via custom error reverts**. `test_returnFalseIsNotUsed` greps the codebase.

**Suggested upstream fix:** A-Token should treat `false` as denial or document that only reverts are valid.

## ClearNote tier gate — fail-closed

When `minTier > 0` and `apassRegistry` is configured, a failed or short `getAPassData` staticcall **reverts** with `ApassLookupFailed` (`0xba7cb6e7`) instead of allowing the transfer. This is intentional: Cleanverse BASE may be fail-open (SWC-104), but our tier extension is fail-closed.

If `minTier == 0`, tier checks are skipped (registry may still be unset).

## Frozen wallet recovery (`ClearNoteController.recover`)

Frozen wallets cannot burn on A-Tokens — Cleanverse BASE reverts burn with `0x322fde89`. Calling `recover()` on a frozen `lost` wallet will revert on `burn`.

**Supervised 3-step runbook (Safe 2-of-3):**

1. **Unfreeze** `lost` on the A-Token (Cleanverse / token admin `unfreeze` or equivalent).
2. **Recover** — Safe executes `ClearNoteController.recover(noteToken, lost, newWallet, units)`.
3. **Re-freeze** `lost` if compliance policy requires the compromised wallet to remain frozen.

Do not demo `recover()` on wallet C (frozen demo wallet) without step 1.

## Position cap (`maxPositionBps`)

`PositionCapExceeded` uses `totalSupply() * maxPositionBps / 10000`. CLINV01 on Monad testnet is configured with **10000 bps (100%)** via Safe — required for multiple `issueNote` calls on the same token. Default mapping value `0` would cap all holders at 0% and block transfers.

Recorded in `deployments/monad-10143.json` → `e2e.clinv01MaxPositionBps`.

## Admin `setPolicy`

Non-admin `setPolicy` correctly reverts with `0xe2517d3f` — not a vulnerability.

## Responsible disclosure

Report security issues to the repository maintainer before public disclosure.
