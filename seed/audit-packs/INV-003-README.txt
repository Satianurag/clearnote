ClearNote audit pack — INV-003
packHash (keccak256 of JSON): 0xed9fa361c00820e0569e2dc03bb27f23e6c313068b13ed4f8ad341ff33abeafa
docHash: 0xdebfda2e6825e1ebe93ff0512d47d00e195d5317e292750759d288ee126340f1
ivmsHash: 0x0859379b3be815344403659cd0254c69bc4db0c027568a98b01a32553129c7f2
travelRuleRequired: true

Recompute docHash:
  pnpm pint:hash seed/invoices/INV-003.xml

Verify JSON integrity:
  cast keccak seed/audit-packs/INV-003.json

Anchor on-chain (Safe admin):
  pnpm audit:anchor INV-003

ZIP contents:
  - INV-003.json — full manifest
  - INV-003-README.txt — this file
  - INV-003-canonicalization.json — excluded nodes + preview
  - INV-003-validation.json — structural / SVRL validation report

Privacy: only packHash on-chain (AuditAnchor). PII in IVMS101 stays off-chain.
