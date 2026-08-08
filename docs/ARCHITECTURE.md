# Architecture

```
InvoiceRegistry (WO-01)  ← single source of truth for invoice lifecycle
ClearNoteController (WO-05)  ← mint/burn orchestration
ClearNotePolicy v3 (WO-02)  ← STATICCALL decorator on BASE router
DvPEscrow (WO-06)  ← atomic note + cash leg
Envio indexer  ← audit events + CLNOTE02 history
App (WO-10)  ← issuer / investor / obligor surfaces
```

Constraints and work orders: `WORK_ORDER_BOOK.md`.
