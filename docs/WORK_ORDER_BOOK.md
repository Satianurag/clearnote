# ClearNote — Work Order Book (agent handoff)

<aside>
🧰

**Isko kaise use karna hai:** ek Work Order = ek paste. Pehle **Global constraints** block paste karo, phir ek WO section. Agent khud decide karega *kaise* banana hai. Wapas sirf **Acceptance** table ka result chahiye — per line pass/fail + tx hash / test name.

**Ek WO tab tak done nahi hai jab tak uska Acceptance table poora green na ho.**

</aside>

## Wave map — kya parallel chal sakta hai

| Wave | Work orders | Depends on | Parallel? |
| --- | --- | --- | --- |
| **1** | WO-00 repo · WO-01 InvoiceRegistry · WO-02 ClearNotePolicy v3 · WO-03 SanctionsRegistry+OFAC · WO-04 PINT-SG hash | kuch nahi | **Paanchon saath** |
| **2** | WO-05 Controller · WO-06 DvPEscrow · WO-07 Cleanverse client | Wave 1 | 05 → 06, 07 alag |
| **3** | WO-08 token launch+wire · WO-09 seed 12 invoices · WO-11 indexer extend | Wave 2 | 08 → 09, 11 alag |
| **4** | WO-10 app (5 surfaces) · WO-12 audit pack · WO-13 IVMS101 | Wave 3 | Teenon saath |
| **5** | WO-14 README/docs · WO-15 truth pass | sab | Dono saath |

---

# Global constraints — har WO ke saath yeh paste karo

```
CLEARNOTE — GLOBAL CONSTRAINTS (in me se koi bhi violate nahi karna)

CHAIN
- Monad testnet, chainId 10143, RPC https://testnet-rpc.monad.xyz
- Monad charges gas_limit, NOT gas_used. Always eth_estimateGas + 20% buffer.
  Never hardcode a fat gas limit — you pay for the whole limit.
- eth_getLogs is capped at 100 blocks on this RPC. Never build history from RPC logs.
  History comes from the Envio indexer only.
- Explorer: https://testnet.monadscan.com  (monadvision 403s to curl, fine in a browser)
- Solidity 0.8.30. Foundry. forge create does NOT need --legacy here.

CLEANVERSE A-TOKEN POLICY HOOK — read this twice, most bugs live here
- A-Tokens expose:  setPolicy(address) = 0x7d4163d3   policy() = 0x0505c8c9
  Both DEFAULT_ADMIN_ROLE only. Non-admin gets 0xe2517d3f.
- The hook the token calls is:
      canTransfer(address token, address from, address to, uint256 amount) = 0x6d62a4fe
- The hook is invoked with STATICCALL. A policy may NOT write state and may NOT emit events.
  view / pure only. Any SSTORE reverts the whole transfer with an empty revert.
- Returning false does NOT block a transfer. The token ignores the return value.
  This is SWC-104 Unchecked Call Return Value, fail-open. WE VERIFIED THIS ON-CHAIN.
  TO DENY YOU MUST REVERT, with a custom error.
- Our policy is a DECORATOR, not a replacement. Line 1 of canTransfer MUST be:
      ICleanverseRouter(BASE).canTransfer(token, from, to, amount);
  BASE = 0x36489be45fa84f70a0c2bdb11d824be608cb12dd
  Their revert must bubble up UNCHANGED so their reason codes stay visible in our UI.
  If you skip this line you silently delete the whole compliance layer. Do not.
- mint (to != 0) and burn (to == 0) BOTH pass through the hook. Verified.
- to == address(0) skips OUR rules but does NOT bypass BASE. A burn from a frozen wallet
  is blocked by BASE with 0x322fde89. Recovery therefore needs an unfreeze first.

TOKENS — do not mix these up
- CLINV01   (launched in WO-08) = the PRODUCT token. All product flows run here.
- CLLAT01   0x13aDF50039Db284B380f06FD4be0061C30A92c96 = reason-code footage token only.
            Currently pointing at the ORIGINAL router. If you setPolicy on it for a test,
            you MUST roll it back to BASE in the same session.
- CLNOTE02  0xDAA42E5c1A8B9724F499729609f166B0D140Ec18 = untouched history token.
            NEVER setPolicy. NEVER experiment. The indexer's history depends on it.

WALLETS — naming is locked, never swap
- A   0x20a2A3cBDd040fdC24c4ebA6fE8531Dad068B7CB   issuer / deployer / admin, ~4.8 MON
- B   0x9AE53a6d3c8E8955D1bAA660B4aBd477Fe512C2b   Investor 1 = the MetaMask wallet in the
                                                   browser demo. A-Pass 1104.
- B2  0xb77Dabe967e53dFa2A46B040A2269d6E26A5C7F1   Investor 2, holds the older balances
- C   0x052eF2f1ce92245E264785ab99A1e7114c809534   FROZEN on purpose, holds 10 CLLAT
- D   Safe co-owner / backup      E  expired-A-Pass wallet      F  EIP-7702 wallet
- Safe 2-of-3  0xb544d5efb15fbae3b3ad4b1ec3594ffeb0926593
               owners A, B, D   threshold 2   its own A-Pass cvRecordId 1009
- No-A-Pass sink: 0xdead000000000000000000000000000000000001
  ALWAYS lowercase. Mixed case (0xDEAD...) throws a viem checksum error.

CLAIMS — what the code and docs may / may not say
- MAY claim: jurisdiction control, identity credential, revocability — all tx-proven.
  Our policy installed INSIDE their token via setPolicy, decorating not replacing.
- MAY NOT claim: that Cleanverse enforces investor tier on-chain. It does not — the API
  accepts min_tier and the contract ignores it. We enforce it.
- MAY NOT claim: that Cleanverse enforces its is_black_list flag. It does not. We do.
- MAY NOT claim: gasless onboarding. Monad accepts EIP-7702 type-4 txs but eth_getCode
  shows no delegation designator. Approved wording:
  "type-4 transactions are accepted on Monad; sponsored onboarding is a documented next step."

CODE RULES
- Custom errors only, no revert strings. OpenZeppelin v5 AccessControl.
- EVERY state change emits an event. Cleanverse emits no compliance events, so our events
  are the only audit history that exists. Design them for the indexer.
- Foundry tests are mandatory. A WO is not done until its acceptance table is green.
- viem / wagmi: import { monadTestnet } from 'viem/chains'. Always getAddress() or lowercase.
- Secrets only in .env and *.keys.env, both gitignored. Never a key in source or a commit.
- On any Cleanverse endpoint that returns an error, log the raw code AND the fallback used.

GIT
- Commit locally from now. Do NOT push to a public remote before 2026-08-08 00:00 UTC.
```

---

# Facts sheet — deployed, verified, reusable

## Selectors

```
mint(address,uint256)              0x40c10f19
burn(address,uint256)              0x9dc29fac      works without holder approval, admin only
setPolicy(address)                 0x7d4163d3
policy()                           0x0505c8c9
canTransfer(addr,addr,addr,uint256) 0x6d62a4fe     the policy hook signature
DEFAULT_ADMIN_ROLE                 0xa217fddf
A-Pass registry: hasApass          0x7a28eae6      apass data  0x6a069f61
ERC-1967 impl slot 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc
```

## Reason codes — live on-chain today

| Selector | Meaning | Enforced by |
| --- | --- | --- |
| `0xa6725971` | Recipient has no A-Pass | Cleanverse |
| `0x322fde89` | Wallet frozen / A-Pass revoked | Cleanverse |
| `0x51d86cca` | Country not permitted by token rule | Cleanverse |
| `0xaecc0dbe` | A-Pass expired | Cleanverse |
| `0xe3e32fdb` | `TierTooLow` — investor below required tier | ClearNote |
| `0x80279111` | `SanctionedAddress` — on the OFAC merkle list | ClearNote |
| `0xe2517d3f` | `AccessControlUnauthorizedAccount` | OpenZeppelin |

**To build in this book:** `InvoiceAlreadyFinanced` · `PositionCapExceeded` · `LockupActive` · `TransfersPaused` · `InvestorLimitReached` · `NoteNotBacked` · `PolicyNotConfigured`. Har naya code ka selector `cast sig` se nikaal ke reason-code map aur README dono me likhna hai.

## Deployed artifacts

| What | Address | Use |
| --- | --- | --- |
| Cleanverse router (BASE) | `0x36489be45fa84f70a0c2bdb11d824be608cb12dd` | Always delegate to this first; rollback target |
| ClearNotePolicy v2 | `0x3d5c0027792B576C62a35C2f4E7bF17Ac54dCfbb` | Working decorator. WO-02 supersedes it |
| ClearNotePolicy v1 | `0xb1070929C2796e39EBb303BF137c08EeFF72dE54` | **DEPRECATED — no BASE chain. Never install** |
| MiniDvP | `0x0c59e64a3c845A30ba31883115a5e08F56B10fB7` | Atomicity proven. WO-06 base |
| Safe 2-of-3 | `0xb544d5efb15fbae3b3ad4b1ec3594ffeb0926593` | Issuer governance, holds its own A-Pass |
| Monad USDC | `0x534b2f3A21130d7a60830c2Df862319e593943A3` | Cash leg. Plain ERC20, **6 decimals**, no gate |
| Safe v1.4.1 SafeL2 | `0x29fcB43b46531BcA003ddC8FCB67FFE91900C762` | Singleton used |
| SafeProxyFactory | `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67` | `createProxyWithNonce` |

## Cleanverse API — v5.6, live state

```
Base   https://uatapi.cleanverse.com/api/cooperate
Headers  Content-Type: application/json   +   api-id: <API_ID>
Body     aes-256-cbc, IV = 16 zero bytes, key = base64-decode(api-key)
         request body is  { "data": "<base64 ciphertext>" }
Envelope TWO shapes exist. Handle both:
         const ok = code === 4 || code === '0000'
         const payload = json.data ?? json.result
chain    "monad"  (also "base")

WORKING
  /query_apass
  /generate_apass          works on CONTRACT addresses too (Safes, escrows) — verified
  /update_status           freeze / unfreeze
  /faucet
  /atoken/launch           ~67% reliable in a batch. icon field is REQUIRED
  /atoken/add_rule
  GET /atoken/list_my_atokens
  /query_deposit_address
  /query_ramp_*

BROKEN — each one needs a coded fallback, see WO-07
  /verify_apass                  "AToken required"      -> read the registry on-chain
  /validator/verify              12027                  -> local Schematron + our inspect()
  /validator/rules               returns rules: []      -> same
  /atoken/query_apply_status     404                    -> GET list_my_atokens
  /atoken/register_atoken        unknown field schema   -> skip, we own the registry
  /download_travel_rule          400 wallet null        -> generate IVMS101 ourselves, WO-13
  /query_txs                     0002 invalid symbol    -> Envio indexer
  /query_deposit_atoken_list     tokens: null           -> n/a
  /atoken/launch_wrapped_atoken  ISSUE_FAILED on Monad  -> n/a

ERROR CODES
  CN_001 no apass · CV_500 bad KYC fields · CV_504 expirationTime in the past
  BL_003 FATF country blocked (IR etc — an IR A-Pass CANNOT be created)
  12002 duplicate token symbol — ALSO fires when you retry a symbol whose launch FAILED.
        A failed launch still reserves the symbol. Never retry the same symbol; bump a suffix.
  12009 chain rule write failed · 12027 validator no data · 0002 invalid symbol

PROVEN PAYLOAD — atoken/launch
  chain            "monad"
  token_name       "ClearNote Invoice Note"
  token_symbol     "CLINV01"
  decimals         18
  admin_address    <wallet A>
  icon             "https://images.cleanverse.com/app/token_icon/USDC.svg"
  rule             min_tier 0, min_sub_tier 0, is_black_list false, countries []
  NOTE: countries [] or a list that MATCHES the admin's A-Pass country, otherwise mint
        itself reverts with 0x51d86cca. This cost us hours. Use [].

PROVEN PAYLOAD — generate_apass
  chain, wallet { address, chain }, customerId, expirationTime (FUTURE unix), tier "50"
  plus identityDataList[] with fullName and issuingCountryISO2
  tier is NOT caller-settable — the sandbox forces 50. countries derive from issuingCountryISO2.

PROVEN PAYLOAD — update_status
  wallet { address, chain }, status  1 = active, 2 = frozen   (integers, not strings)

PROVEN PAYLOAD — faucet
  chain, depositAddress, symbol

MINT UNLOCK SEQUENCE (learned the hard way)
  1. add_rule with countries [] (or matching)
  2. grantRole(MINTER_ROLE, <minter>)
  3. mint
  Skipping step 1 gives a country-mismatch revert that looks like a role problem. It is not.

LATENCY BUDGET
  list_my_atokens 200ms · query_apass 400-750ms · atoken/launch 856ms · generate_apass ~1300ms
  A compliant A-Token transfer costs ~421k gas. A plain counter increment is ~33k.
```

## Local services already running — reuse, don't rebuild

```
Envio indexer   ~/Desktop/clearnote-indexer/
  GraphQL   http://localhost:8082/v1/graphql     admin secret: testing
  Console   http://localhost:8082/console        Postgres on 5433
  Hasura table name is  Transfer  (NOT ANote_Transfer)
  Start block 51115459 (CLNOTE02 launch)
  Restart:  cd ~/Desktop/clearnote-indexer/generated && docker compose up -d
            TUI_OFF=true pnpm start
  PORT 8080 IS TAKEN by the SignOz container signoz-signoz-0. Never bind 8080.

Browser proof app  ~/Desktop/clearnote-browser-test/   (Next + wagmi, localhost:3000)
  Keep it. It is submission evidence. Copy its pattern, do not delete it.
  The pattern to reuse in every write surface:
     useSimulateContract -> on error decode the selector -> plain English -> disabled={!sim.data}
  Proven: MetaMask signed tx 0xa847bbdd1c586af7458aca7ec9a964bf48e695ccdae32609303b909c8ba7e359

Toolchain present: Node 20.20.2, pnpm, Foundry forge 1.6.0, Docker, Java 21,
  Saxon-HE 12.5 + xmlresolver 5.2.2 (+ -data jar) — Schematron works, use it
Data present: sdn.csv (19,182 lines, no header, -0- means empty), pint-sg.zip (.sch + .xslt)
```

---

# WO-00 · Monorepo + environment

**Goal** — ek repo, ek env loader, root se sab kuch chal jaye. Product code isi tree me jayega.

**Deliverables**

```
clearnote/
  contracts/           Foundry. src/ test/ script/ src/interfaces/
  services/            TypeScript. src/cleanverse src/pint src/ofac src/ivms src/audit
  app/                 Next.js app router + wagmi
  indexer/             move ~/Desktop/clearnote-indexer here
  seed/                invoice XMLs, wallet map, setup scripts, manifest.json
  experiments/browser-test/   move ~/Desktop/clearnote-browser-test here, unchanged
  docs/                INTEGRATION_NOTES.md  SECURITY.md  ARCHITECTURE.md
  pnpm-workspace.yaml  foundry.toml  .env.example  .gitignore  README.md  LICENSE
```

**Constraints** — `.gitignore` me `.env`, `*.keys.env`, `out/`, `cache/`, `broadcast/`, `generated/`, `node_modules/`, `seed/*.keys.json`. Do env files: `.env` (addresses, RPC, ports — safe) aur `clearnote.keys.env` (private keys + Cleanverse API key — never committed, never printed in logs). `git init` + local commits haan; **remote push Aug 8 00:00 UTC ke baad**.

**Acceptance**

| Check | Pass = |
| --- | --- |
| `forge build` | 0 errors |
| `pnpm -r typecheck` | 0 errors |
| Indexer from new path | GraphQL on 8082 still returns `Transfer_aggregate` count |
| `git status` | no `.env`, no key file, no `out/` staged |
| `grep -rn` for any `0x` private key in tracked files | zero hits |

---

# WO-01 · `InvoiceRegistry.sol`

**Goal** — ek invoice ka single source of truth: exist karta hai, PINT-SG validate hua, obligor ne accept kiya, aur **at most once** finance hua. Yeh product ka dil hai.

**The one design rule that matters:** `invoiceId == docHash`, aur docHash **`cac:PayeeParty` ko exclude** karke banta hai (WO-04). Isliye ek hi invoice do factoring houses ko becha jaye to dono submissions ka **same** invoiceId banega aur doosra revert karega. Yeh duplicate-financing detection hai — trade finance ki sabse badi fraud category.

**Shape**

```solidity
struct Invoice {
    bytes32 docHash;          // == invoiceId, PayeeParty excluded
    bytes32 pintProfileHash;  // which ruleset validated it
    address originator;       // factoring house that registered
    address obligor;          // the buyer who owes the money
    uint256 faceValue;
    uint64  dueDate;
    uint64  registeredAt;
    bytes3  currency;         // "SGD" etc
    Status  status;
}

enum Status { None, Registered, ObligorAccepted, Financed, Settled, Defaulted, Disputed }

function register(Invoice calldata inv) external returns (bytes32 invoiceId);
function acceptByObligor(bytes32 invoiceId, uint256 deadline, bytes calldata sig) external;
function markFinanced(bytes32 invoiceId, address noteToken, uint256 units) external; // CONTROLLER_ROLE
function markSettled(bytes32 invoiceId) external;    // CONTROLLER_ROLE
function markDefaulted(bytes32 invoiceId) external;  // CONTROLLER_ROLE
function raiseDispute(bytes32 invoiceId, bytes32 evidenceHash) external;

function get(bytes32 invoiceId) external view returns (Invoice memory);
function isFinanced(bytes32 invoiceId) external view returns (bool);
function backingOf(address noteToken) external view returns (bytes32 invoiceId);
function duplicateAttempts(bytes32 invoiceId) external view returns (uint256);
```

**Errors** — `InvoiceAlreadyFinanced(bytes32 invoiceId, address firstOriginator)` · `InvoiceAlreadyRegistered(bytes32)` · `BadObligorSignature()` · `AcceptanceExpired()` · `WrongStatus(uint8 have, uint8 want)` · `NotObligor()`

**Obligor acceptance** — EIP-712. Domain `name "ClearNote"`, `version "1"`, chainId, verifyingContract. Typed struct `InvoiceAcceptance(bytes32 invoiceId,address obligor,uint256 faceValue,uint64 dueDate,uint256 deadline)`. Recover, must equal `inv.obligor`, must be before `deadline`, must be replay-proof. Yeh "true sale" ka on-chain evidence hai — invoice financing me obligor confirmation hi asli underwriting hai.

**Constraints** — duplicate `register` ko **silently drop nahi karna**: attempt counter badhao aur `DuplicateAttempted(invoiceId, wouldBeOriginator, existingOriginator)` event emit karo, *phir* revert karo. Regulator ko attempt ka record chahiye. Status `Financed` ya usse aage ho to `InvoiceAlreadyFinanced`, warna `InvoiceAlreadyRegistered`.

**Acceptance**

| Test | Expected |
| --- | --- |
| `test_register_happy` | returns invoiceId == docHash, event emitted, status Registered |
| **`test_duplicateFinancing_isBlocked`** | same docHash, **different originator** → revert `InvoiceAlreadyFinanced`, attempt counter = 1 |
| `test_obligorAccept_happy` | valid EIP-712 sig → status ObligorAccepted |
| `test_obligorAccept_wrongSigner` | revert `BadObligorSignature` |
| `test_obligorAccept_expired` / `_replay` | revert `AcceptanceExpired` / `WrongStatus` |
| `test_markFinanced_onlyController` | random caller → `0xe2517d3f` |
| `testFuzz_registerNeverCollides` | distinct docHash → distinct records, no overwrite |

---

# WO-02 · `ClearNotePolicy` v3 — production

**Goal** — v2 (`0x3d5c0027…`) ko production shape do. Yeh contract Cleanverse ke A-Token ke **andar** install hota hai `setPolicy` se. Project ka differentiator yahi hai.

**Ab tak kya kaam kar raha hai** — BASE delegation, `TierTooLow` `0xe3e32fdb`, `SanctionedAddress` `0x80279111`, merkle `commitRoot` + `addSanctioned(who, proof)` + `verifyInclusion`. Ek install se paanch different outcome on-chain prove ho chuke hain. **Yeh sab preserve karna hai.**

**Naya kya add karna hai — sab read-only** (STATICCALL me sirf yahi safe hai)

```
PositionCapExceeded    balanceOf(to) + amount  >  totalSupply() * maxPositionBps / 10000
LockupActive           block.timestamp < controller.lockedUntil(token, from)
InvestorLimitReached   new holder && controller.investorCount(token) >= maxInvestors(token)
TransfersPaused        controller.isPaused(token)
NoteNotBacked          registry.backingOf(token) == 0   -- no invoice behind this note
PolicyNotConfigured    baseRouter == 0 || controller == 0   -- fail closed, never fail open
```

**Pre-flight for the UI — yeh function pura Compliance Console chalata hai**

```solidity
function inspect(address token, address from, address to, uint256 amount)
    external view returns (bool ok, bytes4 code, string memory reason);
```

Implementation: `try this.canTransfer(token, from, to, amount)` → `ok = true`. `catch (bytes memory err)` → pehle 4 bytes nikaal ke `code`, aur ek internal map se plain-English `reason`. Cleanverse ke chaar codes bhi is map me hone chahiye — tabhi UI dono layers ka denial ek hi jagah dikhata hai.

**Constraints**

- Line 1 **always** `ICleanverseRouter(baseRouter).canTransfer(token, from, to, amount);`. v1 ka bug yahi tha — wo green dikh raha tha galat reason se.
- `canTransfer` me koi SSTORE nahi, koi `emit` nahi. Denial log off-chain service likhega (WO-12), hook nahi.
- `to == address(0)` → BASE call karo, phir hamare rules skip. BASE frozen sender ka burn khud block karega.
- Admin = Safe `0xb544d5efb15fbae3b3ad4b1ec3594ffeb0926593`. Deploy A se karo, phir admin transfer.
- Har naye error ka selector `cast sig` se nikaal ke `services/src/reasonCodes.ts` me likho — ek hi source of truth, UI aur README dono wahi use karenge.

**Acceptance**

| Test | Expected |
| --- | --- |
| **`test_baseRevertBubblesUnchanged`** | mock router reverts `0x322fde89` → policy reverts with **exactly** `0x322fde89`, not our own error |
| `test_noStateWrites` | `canTransfer` called via `staticcall` succeeds — proves view-safety |
| `test_eachRule_revertsWithOwnSelector` | 7 rules × 1 test each, correct custom error |
| `test_returnFalseIsNotUsed` | grep: `canTransfer` me koi `return false` nahi. Deny sirf revert se |
| `test_inspect_matchesCanTransfer` | fuzz: `inspect().ok == !canTransferReverts` har case me |
| `test_burnPathSkipsOurRulesNotBase` | `to == 0` → hamare rules skip, BASE call phir bhi hua |
| `test_unconfiguredFailsClosed` | baseRouter zero → `PolicyNotConfigured`, transfer allow **nahi** |

---

# WO-03 · `SanctionsRegistry` + OFAC merkle pipeline

**Goal** — "industry blacklist" wala jo layer Cleanverse ne document kiya par implement nahi kiya, wo hum verifiable tareeke se banate hain. Judge ke liye line: *screened against the OFAC SDN list published YYYY-MM-DD, merkle root 0x…, N entries, independently verifiable.*

**On-chain**

```solidity
function commitRoot(bytes32 root, string calldata sourceUri, uint64 publishedAt) external; // admin
function addSanctioned(address who, bytes32[] calldata proof) external;   // proof checked at WRITE time
function removeSanctioned(address who) external;                          // delisting happens, support it
function isSanctioned(address who) external view returns (bool);           // O(1) read for the hook
function verifyInclusion(address who, bytes32[] calldata proof) external view returns (bool);
function rootAt(uint256 index) external view returns (bytes32, string memory, uint64);
function rootCount() external view returns (uint256);
```

Proof **write** time pe verify hoti hai, read time pe nahi — isse hook ka gas nahi badhta. Root history array rakho taaki regulator prove kar sake ki *kis* list version ke hisaab se ek purana transfer block hua tha.

**Off-chain** — `services/src/ofac/`

1. `sdn.csv` parse karo. No header. `-0-` ka matlab empty field. Crypto addresses remarks field me `Digital Currency Address - ETH 0x…` pattern me hote hain.
2. ETH/EVM addresses extract, lowercase normalize, dedupe.
3. OpenZeppelin-compatible merkle tree (keccak256, sorted pairs) — `ofac-root.json` + per-address proofs.
4. **Honesty requirement:** real SDN me EVM addresses kam hain. Agar count chhota hai to demo ke 3 synthetic testnet addresses **alag file** `demo-additions.json` me rakho aur README me saaf likho: *demo list = N real OFAC EVM addresses + 3 synthetic testnet addresses.* Judge ke saamne yeh strength hai, weakness nahi.

**Acceptance**

| Check | Pass = |
| --- | --- |
| `pnpm ofac:build` | prints source date, entry count, root — deterministic across two runs |
| `test_verifyInclusion_realProof` | generated JSON ka ek real proof on-chain pass |
| `test_verifyInclusion_nonMemberFails` | random address + valid-shape proof → false |
| `test_addSanctioned_badProofReverts` | revert, list unchanged |
| Root history | do roots commit karo, `rootCount() == 2`, dono readable |

---

# WO-04 · PINT-SG validation + canonical hash

**Goal** — ek real Singapore Peppol invoice se ek **deterministic** `docHash` banao jo factoring party badalne par **badle nahi**. Poore product ka intellectual core yeh ek function hai.

**Why PayeeParty excluded** — PINT-SG spec §2.1.3: `cac:PayeeParty` bheja jaye to iska matlab hai ki **factoring situation** document ho rahi hai. Matlab legitimate factored invoice aur double-pledged invoice me **sirf yahi field** alag hoti hai. Isliye hash se isko nikalna hi duplicate detection hai.

**Deliverables** — `services/src/pint/`

```
validate.ts     Saxon Schematron run -> SVRL parse -> fail on any ERROR assertion
canonicalize.ts strip cac:PayeeParty entirely; strip volatile nodes (UUID, IssueTime,
                signature blocks); normalize namespaces; sort attributes; collapse
                inter-element whitespace; UTF-8 bytes
hash.ts         keccak256(canonical bytes) -> docHash ; keccak256(profileID+customizationID)
                -> pintProfileHash
cli.ts          pnpm pint:hash <file.xml>  ->  docHash, validation summary, excluded fields list
```

Saxon command jo already chalti hai:

```bash
java -cp "saxon-he-12.5.jar:xmlresolver-5.2.2.jar:xmlresolver-5.2.2-data.jar" \
  net.sf.saxon.Transform -s:invoice.xml -xsl:pint-sg.xslt -o:report.xml
```

**Acceptance** — teen test, teesra sabse important:

| Test | Expected |
| --- | --- |
| `validates_real_pint_sg_sample` | `PINT-SG INV example 08 - Factored invoice.xml` → 0 ERROR assertions |
| `rejects_invalid_invoice` | mandatory field hataao → validation fail with the rule id |
| **`same_invoice_different_factor_same_hash`** | PayeeParty "Faktor A" vs "Faktor B" → **identical docHash** |
| `different_amount_different_hash` | face value badlo → different docHash |
| `deterministic_across_reformatting` | whitespace / attribute order badlo → same docHash |

---

# WO-05 · `ClearNoteController.sol`

**Goal** — write-side compliance brain. Policy hook STATICCALL hai, isliye jo bhi state policy padhti hai wo **yahan** likhi jaati hai. Aur sabse bada integration point: **A-Token ka `MINTER_ROLE` yeh contract hold karta hai, koi insaan nahi — isliye har mint construction se invoice-backed hai.**

**Shape**

```solidity
function issueNote(bytes32 invoiceId, address noteToken, address to, uint256 units) external;
// CONTROLLER flow: registry.status == ObligorAccepted, !isFinanced, markFinanced,
// lockedUntil[token][to] = now + lockupSeconds, investorCount++ if new holder,
// noteBacking[token] = invoiceId, then token.mint(to, units)

function onTransfer(address noteToken, address from, address to, uint256 amount) external; // ESCROW_ROLE
// DvPEscrow calls this AFTER a fill so investorCount and lockup stay correct.
// The policy hook cannot write, so this is the only path.

function pause(address noteToken) external;
function unpause(address noteToken) external;
function setLockup(address noteToken, uint64 seconds_) external;
function setMaxInvestors(address noteToken, uint32 n) external;
function setMaxPositionBps(address noteToken, uint16 bps) external;

function settle(bytes32 invoiceId, address noteToken) external;   // obligor paid -> burn + mark Settled
function recover(address noteToken, address lost, address newWallet, uint256 units) external;

// reads consumed by ClearNotePolicy
function lockedUntil(address token, address holder) external view returns (uint64);
function investorCount(address token) external view returns (uint32);
function maxInvestors(address token) external view returns (uint32);
function maxPositionBps(address token) external view returns (uint16);
function isPaused(address token) external view returns (bool);
```

**Constraints**

- `DEFAULT_ADMIN_ROLE` = Safe `0xb544d5ef…`. Deploy A se, phir admin Safe ko transfer, phir A se revoke.
- `recover` ke docstring me clearly likho: **frozen wallet se burn nahi hota** (BASE `0x322fde89` deta hai, `to == address(0)` bypass nahi karta). Official procedure: Safe 2-of-3 → Cleanverse `update_status` unfreeze → `recover` (burn + mint) → re-freeze → `AuditAnchor`. Contract sirf middle step hai; teen-step nature document me saaf ho.
- `investorCount` decrement bhi handle karo jab holder ka balance zero ho jaye, warna cap galat lagega.

**Acceptance** — ek full-lifecycle test, plus units:

| Test | Expected |
| --- | --- |
| **`test_fullLifecycle`** | register → accept → issue → lockup ke andar transfer `LockupActive` → warp → transfer ok → cap hit `InvestorLimitReached` → pause → `TransfersPaused` → unpause → settle → status Settled |
| `test_humanCannotMint` | wallet A direct `token.mint` → `0xe2517d3f`. Sirf Controller mint karta hai |
| `test_issueTwice_sameInvoice` | revert `InvoiceAlreadyFinanced` |
| `test_issueWithoutObligorAccept` | revert `WrongStatus` |
| `test_onTransfer_onlyEscrow` | random caller → `0xe2517d3f` |
| `test_investorCountDecrements` | holder poora balance bech de → count ghata |

---

# WO-06 · `DvPEscrow.sol`

**Goal** — MiniDvP ko real secondary market bana do. Atomicity already on-chain proven hai (`0x701ce3a0…`, aur fail path pe cash balance **bilkul** nahi hila) — us proof ko todna nahi.

**Non-negotiable: cash leg pehle.** Note leg agar compliance se revert hoti hai to poori tx unwind ho jaati hai aur cash wapas. Yeh order deliberate hai:

```solidity
// proven shape, keep the ordering
if (!IERC20(cash).transferFrom(buyer, seller, cashAmt)) revert CashLegFailed();
IERC20(note).transferFrom(seller, buyer, noteAmt);
```

Non-custodial rakho — escrow khud tokens hold nahi karta, dono legs `transferFrom` se. (A-Tokens `transferFrom` pe same gate chalate hain — verified.)

**Shape**

```solidity
function postOffer(address noteToken, address cashToken, uint256 units,
                   uint256 pricePerUnit, uint256 minFill, uint64 expiry)
    external returns (uint256 offerId);
function fill(uint256 offerId, uint256 units) external;    // partial fills allowed
function cancel(uint256 offerId) external;
function offerOf(uint256 offerId) external view returns (...);
function openOffers() external view returns (uint256[] memory);
```

Errors: `CashLegFailed()` · `OfferExpired()` · `BelowMinFill()` · `OfferNotFound()` · `NotOfferMaker()` · `InsufficientRemaining()`. Har fill ke baad `controller.onTransfer(...)`.

**Acceptance**

| Test | Expected |
| --- | --- |
| `test_fill_happy` | dono legs move, `investorCount` badha |
| **`test_nonCompliantBuyer_cashUntouched`** | buyer bina A-Pass → poori tx revert `0xa6725971`, buyer aur seller ke cash balance **before == after** (explicitly assert dono) |
| `test_partialFill_twice_closes` | 60% + 40% → offer closed, koi dust nahi |
| `test_belowMinFill` | revert `BelowMinFill` |
| `test_expiredOffer` / `test_cancelThenFill` | `OfferExpired` / `OfferNotFound` |
| `test_lockedSellerCannotSell` | lockup ke andar → `LockupActive` bubble up |
| USDC decimals | cash math **6 decimals** pe sahi, note 18 pe — ek mixed-decimal test compulsory |

---

# WO-07 · Cleanverse client + fallback layer

**Goal** — ek typed client jo unke 9 broken endpoints ko chhupata nahi, unka **coded fallback** rakhta hai. Yeh judge ke liye "integration depth" ka sabse strong artifact hai: humne unka platform sirf use nahi kiya, uske gaps map kiye aur bhare.

**Deliverables** — `services/src/cleanverse/`: `crypto.ts` (aes-256-cbc, IV = 16 zero bytes, key = base64-decode api-key) · `client.ts` (dual envelope: `ok = code === 4 || code === '0000'`, payload = `data ?? result`) · `apass.ts` · `atoken.ts` · `fallbacks.ts` · `doctor.ts`.

**Fallback map — hardcode karo, comment me reason likho**

| Broken endpoint | Symptom | Fallback |
| --- | --- | --- |
| `verify_apass` | "AToken required" | A-Pass registry on-chain read: `hasApass` `0x7a28eae6`, data `0x6a069f61` |
| `query_txs` | `0002 invalid symbol` | Envio GraphQL on `localhost:8082`, table `Transfer` |
| `validator/verify` · `validator/rules` | `12027` · empty `rules: []` | local Saxon Schematron (WO-04) + `ClearNotePolicy.inspect()` |
| `atoken/query_apply_status` | 404 | `GET /atoken/list_my_atokens`, filter by symbol |
| `download_travel_rule` | 400 wallet null | hamara IVMS101 generator (WO-13) + hash anchor |
| `register_atoken` | unknown field schema | hamara `InvoiceRegistry` hi registry hai |

**Launch queue** — `atoken/launch` batch me ~67% reliable hai aur **failed launch bhi symbol reserve kar leta hai** (retry pe `12002`). Isliye: local reservation file, exponential backoff with jitter, aur `ISSUE_FAILED` pe **symbol suffix bump** (CLINV01 → CLINV01B), same symbol retry **kabhi nahi**.

**Acceptance**

| Check | Pass = |
| --- | --- |
| **`pnpm cleanverse:doctor`** | 15 endpoints ka live table: name · status · latency ms · fallback used. Ise README me paste karna hai |
| `test_dualEnvelope` | `code: 4` aur `code: "0000"` dono parse |
| `test_launchRetry_bumpsSymbol` | mocked `ISSUE_FAILED` → next attempt naya symbol, `12002` nahi |
| `test_everyFallbackReturnsData` | har broken endpoint ka fallback live data deta hai, exception nahi |
| Secret hygiene | logs me api-key ya plaintext body kabhi nahi |

---

# WO-08 · Product token launch + full wiring

**Goal** — `CLINV01` live, policy installed, mint sirf Controller ke haath me.

**Sequence — order matters**

```
1  atoken/launch  CLINV01 "ClearNote Invoice Note", decimals 18, admin = A,
   icon required, rule: min_tier 0, countries []        <-- [] warna mint 0x51d86cca dega
2  generate_apass for: Controller, DvPEscrow, Safe (already 1009), and all 8 seed investors
3  grantRole MINTER_ROLE + BURNER_ROLE -> Controller
4  revokeRole MINTER_ROLE from wallet A                 <-- demo point: no human can mint
5  Controller admin -> Safe 0xb544d5ef... ; revoke A
6  ClearNotePolicy v3: setBaseRouter(0x36489be4...), setController, setRegistry,
   setSanctions, setMinTier(30), setMaxPositionBps, setMaxInvestors, setLockup
7  CLINV01.setPolicy(ClearNotePolicy v3)
8  verify: policy() returns v3
```

**Constraints** — CLNOTE02 ko chhuna nahi. CLLAT01 sirf footage ke liye, aur agar policy install ki to session ke andar BASE pe rollback. Contract addresses **A-Pass le sakte hain** — verified, Safe aur Holder dono pe kaam kiya. Escrow/Controller ke A-Pass banane me hesitate nahi karna.

**Acceptance**

| Check | Pass = |
| --- | --- |
| `cast call CLINV01 "policy()"` | ClearNotePolicy v3 address |
| **BASE still alive through our decorator** | transfer to `0xdead…0001` → `0xa6725971` (unka code, hamara nahi) |
| Human mint blocked | A se `mint` → `0xe2517d3f` |
| Controller mint works | `issueNote` → balance badha, `NoteIssued` event |
| Our rules fire | tier / sanctions / lockup / cap — chaar live reverts, chaar different selectors |
| CLNOTE02 untouched | `policy()` still `0x36489be4…` |

---

# WO-09 · Seed the 12 invoices

**Goal** — demo ke liye asli-dikhne wala data, aur teen deliberate failure cases jo *live* fire honge.

**Constraints**

- 12 PINT-SG XMLs generate karo (3 corridors: SG→SG, AE→SG, IN→SG). Har ek WO-04 se validate + hash.
- 11 register karo. **INV-011 register NAHI karna** — wo demo me live register hoga aur `InvoiceAlreadyFinanced` dega, kyunki wo INV-001 ka duplicate hai jisme sirf PayeeParty alag hai (Gulf Bridge vs Straits Trade).
- 10 obligor-accept, 1 deliberately un-accepted ("cannot finance yet" case).
- 8 finance karo. INV-012 ka counterparty ek OFAC-listed address ho.
- Ek invoice ki `dueDate` demo ke ~10 minute baad rakho taaki maturity live dikhe.
- Investors: 8 wallets. Ek tier-30 retail (`TierTooLow` ke liye), ek frozen (C), ek sanctioned, baaki clean. Hero investor = Wei Lin Family Office = wallet B `0x9AE53…`.
- Output `seed/manifest.json`: invoiceId ↔ file ↔ status ↔ tx hash ↔ which demo beat uses it. **Idempotent** — dobara chalao to duplicate na bane.

**Acceptance** — `pnpm seed:verify` chalao: registry me 11 records, 8 financed, 1 un-accepted, manifest ke saare tx hashes on-chain resolve hote hain, aur INV-011 ka register attempt `InvoiceAlreadyFinanced` deta hai (simulate se, live nahi).

---

# WO-10 · App — 3 screens + 2 tabs

**Goal** — paanch surfaces, sab live chain data pe. Koi hardcoded result nahi, koi fake success nahi.

**Pattern jo har write surface pe repeat hoga** (already browser test me proven):

```
useSimulateContract  ->  error?  ->  decode 4-byte selector  ->  reasonCodes map
  ->  plain English + which layer denied (Cleanverse / ClearNote)
  ->  disabled={!sim.data}
```

Fail case pe sign button **disabled hona hi correct hai** — investor ko sign se *pehle* pata chal jaata hai. Yeh UX point hai, bug nahi.

| Route | Kaun | Kya karta hai |
| --- | --- | --- |
| `/exporter` | SME exporter | Invoice XML upload → Schematron result → docHash → register → obligor accept link (EIP-712 sign page) |
| `/exporter?tab=originator` | Factoring house | Portfolio, finance button, duplicate-attempt alert feed |
| `/investor` | Family office | Offer book (Envio se), buy → DvP fill with pre-flight reason codes, positions, lockup countdown |
| `/compliance` | Compliance officer | **The money screen.** `inspect()` matrix: har seed wallet × token → PASS ya reason code, plain English, aur kis layer ne roka |
| `/compliance?tab=regulator` | Regulator | Merkle root history, `verifyInclusion` checker, audit pack download, denial log |

**Constraints** — `import { monadTestnet } from 'viem/chains'`. Saare hex addresses `getAddress()` ya lowercase. `services/src/reasonCodes.ts` **hi** single source of truth — UI apni copy na banaye. Envio GraphQL `localhost:8082`, admin secret env se. Har screen pe ek "why did this fail" panel jo raw selector bhi dikhaye — judges raw proof dekhna pasand karte hain.

**Acceptance** — paanch surfaces render; Compliance matrix me **kam se kam 6 different live reason codes** dikhein (4 Cleanverse + 2 hamare, ya zyada); ek non-compliant buy attempt sign se pehle block ho; koi hardcoded pass/fail nahi (grep se prove karo).

---

# WO-11 · Indexer extend

**Goal** — jo chal raha hai use todna nahi; usme hamare contracts add karna. Yeh Cleanverse ke toote `query_txs` ka replacement hai aur unke "no compliance events" gap ka jawab.

Add: `InvoiceRegistry` (Registered, DuplicateAttempted, ObligorAccepted, Financed, Settled) · `ClearNoteController` (NoteIssued, Paused, RecoveryExecuted) · `DvPEscrow` (OfferPosted, OfferFilled, OfferCancelled) · `SanctionsRegistry` (RootCommitted, Sanctioned) · `AuditAnchor` (Anchored). CLNOTE02 history rehne do.

**Constraints** — port **8082** hi, 8080 pe SignOz hai. Postgres 5433. Start via `TUI_OFF=true pnpm start`. Exit code 143 normal hai (SIGTERM). Table names singular-ish rehte hain (`Transfer`, not `ANote_Transfer`) — GraphQL likhne se pehle Hasura console pe naam confirm karo.

**Acceptance** — GraphQL me paanchon naye entity types query ho jayein; `investorCount` UI ka number on-chain `controller.investorCount` se match kare; README me restart steps.

---

# WO-12 · Audit pack + `AuditAnchor`

**Goal** — ek invoice ka poora evidence bundle, ek command se, aur uska hash on-chain.

`AuditAnchor.sol`: `anchor(bytes32 packHash, string uri, uint64 periodStart, uint64 periodEnd)` + events. Off-chain `services/src/audit/` ek zip banata hai jisme: invoice XML · SVRL validation report · canonicalization diff (kaunse nodes exclude hue) · docHash derivation · obligor EIP-712 signature + recovered address · saare tx hashes · OFAC root + published date + entry count · reason-code denial log · IVMS101 payload · policy address aur uske parameters us waqt ke.

**Yeh bhi likho:** denial log. Policy hook STATICCALL hai isliye on-chain denial event **exist nahi karta** — pre-flight `inspect()` results service side pe log hote hain aur unka hash anchor hota hai. README me yeh limitation saaf likhna hai; yahi honest engineering dikhta hai.

**Acceptance** — `pnpm audit:pack INV-001` → zip + anchor tx; zip ka keccak on-chain record se match; ek stranger zip se docHash independently recompute kar sake (instructions zip ke andar).

---

# WO-13 · IVMS101 generator

**Goal** — Travel Rule requirement unke toote `download_travel_rule` (400) ke bina poora karna.

Seed data se valid IVMS101 JSON banao (originator + beneficiary: naturalPerson / legalPerson, name, address, nationalIdentification, customerIdentification). Har DvP settlement ke liye ek payload, uska hash `AuditAnchor` me. FATF threshold logic (USD 1,000 / SGD 1,500) config me, hardcoded nahi.

**Privacy constraint** — Cleanverse ki Privacy Policy kehti hai *no personal identity details are recorded on-chain, only pseudonymous identifiers and cryptographic hashes.* Isliye on-chain **sirf hash** jaayega, PII kabhi nahi. Yeh design decision README me likho.

**Acceptance** — generated JSON IVMS101 schema validator pass kare; on-chain me koi PII string nahi (grep); threshold below/above dono cases test.

---

# WO-14 · README + docs

**Goal** — judge 10 minute me samajh jaye aur chala le.

`README.md` — ek-paragraph pitch · mermaid architecture (A-Token → ClearNotePolicy → Cleanverse router → A-Pass registry) · quickstart · address table · reason-code table with selectors · `cleanverse:doctor` ka output paste · **Integration Notes** section · **honest limitations** section.

`docs/SECURITY.md` — responsible disclosure: **SWC-104 Unchecked Call Return Value** in the A-Token policy hook — return value ignore hota hai, deny ke liye revert zaroori hai. Reproduction steps, impact (fail-open policy), suggested fix. **Sirf yeh ek finding claim karo** — non-admin `setPolicy` correctly blocked hai, wo vulnerability nahi.

**Honest limitations section — yeh likhna hai, chhupana nahi:**

- Cleanverse `min_tier` API accept karta hai par contract enforce nahi karta → hum enforce karte hain.
- `is_black_list` flag API me set ho jaata hai par transfer block nahi karta → hamara `SanctionsRegistry` karta hai.
- Unka contract koi compliance event emit nahi karta, aur Monad RPC `eth_getLogs` ko 100 block pe cap karta hai → Envio indexer humne khud chalaya.
- Policy hook STATICCALL hai, isliye on-chain denial trace exist nahi karta → pre-flight `inspect()` + off-chain denial log + hash anchor.
- 9 documented endpoints toote hue hain → har ek ka coded fallback, `cleanverse:doctor` ka output dekho.
- Frozen wallet se burn nahi hota, isliye recovery single-step nahi ho sakti → supervised Safe 2-of-3 procedure.
- IR jaisi FATF-blocked country ka A-Pass ban hi nahi sakta (`BL_003`) → jurisdiction demo SG / US / AE pe hai.
- EIP-7702 type-4 tx accept hoti hai par `eth_getCode` pe delegation dikhti nahi → **gasless claim nahi kar rahe.**
- `atoken/launch` batch me ~67% reliable hai aur failed launch symbol reserve kar leta hai → idempotent queue + symbol bump.

**Acceptance** — ek naya banda repo clone kare aur 10 minute ke andar chala le: `forge test` green, `pnpm cleanverse:doctor` table, `pnpm dev` pe paanch surfaces. README me har claim ke saath ek tx hash ya test name ho.

---

# WO-15 · Truth pass — last, submission se pehle

**Goal** — koi overclaim submission me na jaye. Sabse chhota WO, sabse zyada marks bachata hai.

- Har reason code ka selector `cast sig` se dobara verify karo. README table, `reasonCodes.ts`, aur UI — teenon me same value ho.
- Reason-code **count** jo pitch me likha hai wo actually live codes ke barabar ho. Jo build nahi hua, wo **claim nahi** karna.
- Saare truncated addresses complete karo. A-Pass registry ka poora address `cast` se nikaalo (proxy `0xbA82D189…`, impl `0x9406f5d4…`) — submission me `…` nahi jaana chahiye.
- Har "proven" claim ke saath ek tx hash ya test name attach ho. Jiske paas dono nahi, wo claim hatao.
- `grep` karo: `gasless`, "tier enforced by Cleanverse", "blacklist enforced by Cleanverse" — teenon zero hits.
- CLNOTE02 ka `policy()` still `0x36489be4…` hai — confirm karo. CLLAT01 bhi BASE pe rolled back ho agar footage ho gayi.
- Repo me koi private key, API key, ya sudo password nahi. `git log -p` se **history** bhi check karo, sirf working tree nahi.

**Acceptance** — `docs/CLAIMS.md` jisme har public claim ke saamne uska evidence (tx hash ya test name) likha ho. Jo line evidence ke bina hai, wo submission se bahar.

---

# Report format — agent har WO ke baad yeh bheje

```
WO-nn  <name>        STATUS: green | partial | blocked

Acceptance table:
  check 1        PASS / FAIL     tx hash or test name
  check 2        PASS / FAIL     ...

Deployed / changed:
  contract or file               address or path

Blocked on (if any):
  exact error text + what you already tried

Surprises worth recording:
  anything that contradicts the Facts sheet in this book
```

<aside>
⚠️

**Facts sheet contradict ho jaye to sabse pehle wahi report karo.** Is book ka har fact on-chain ya live API se verify hua hai, par sandbox badal sakta hai. Ek galat fact chup-chaap 4 ghante kha jaata hai.

</aside>