# ClearNote Envio Indexer

Indexes **CLNOTE02**, **CLLAT01**, **CLINV01** transfers plus product contracts on Monad testnet (chainId `10143`).

## Addresses (from `deployments/monad-10143.json`)

| Contract | Address |
|----------|---------|
| CLNOTE02 | `0xDAA42E5c1A8B9724F499729609f166B0D140Ec18` |
| CLLAT01 | `0x13aDF50039Db284B380f06FD4be0061C30A92c96` |
| CLINV01 | `0xEae6ef4f62B735789bD0d899f5f6f2993488Fe69` |
| InvoiceRegistry | `0x8A515D80279eEfa9f3eC76568257b1f1eF76d534` |
| ClearNoteController | `0xfE622a9EAEdf047a2379Eb9C7436B8dc2E1D1bAA` |
| DvPEscrow | `0x1860b3182CAd1813Ce0F992E446e87Fb0FD93417` |
| SanctionsRegistry | `0xF7E706B7956546F213aB9B0DcFD13d1a731B6612` |
| AuditAnchor | `0x93806a81533790e4e1736C227C7eA5aBc6D4cc7F` |

Start block: `51720000` (product contracts; CLNOTE02 history from earlier blocks may be partial)

## Run (local)

```bash
cd clearnote/indexer
pnpm codegen
cd generated && HASURA_EXTERNAL_PORT=8082 docker compose up -d
pnpm install && pnpm codegen && pnpm build && pnpm db-setup
TUI_OFF=true pnpm start
```

GraphQL: `http://localhost:8082/v1/graphql`  
Admin secret: `testing` (or `HASURA_GRAPHQL_ADMIN_SECRET`)

**After redeploy:** `config.yaml` lists both old and new Controller/DvPEscrow addresses. Run `pnpm db-setup` in `generated/` and restart the indexer so `NoteIssued` from the live controller (e.g. INV-013 / `controllerIssueNote_v32`) appears in GraphQL.

Port **8082** (8080 is SignOz). Postgres **5433**.

## Example queries

```graphql
query {
  Transfer(limit: 10, order_by: { id: desc }) { token from to value }
  NoteIssued(limit: 10) { invoiceId noteToken to units }
  InvoiceRegistered(limit: 10) { invoiceId originator obligor }
}
```

## Monad RPC

`eth_getLogs` capped at **100 blocks** — history via Envio only (`interval_ceiling: 99` in `config.yaml`).
