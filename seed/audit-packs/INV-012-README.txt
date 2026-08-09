ClearNote audit pack — INV-012
packHash (keccak256 of JSON): 0x546f0e29e101f551cd05b61609d6801f4314ab56833c617701c5ed54205a41bd
docHash: 0xcbff0fb20a7fd5035da4cdf6dc3f322ad57f8090f96ea2ec043682f6607d4bdf
ivmsHash: 0x892404ea2ce3653437c38855f0ceb0bf17e88673d3e6fb99168ae7138c06a422
travelRuleRequired: true

Recompute docHash:
  pnpm pint:hash seed/invoices/INV-012.xml

Verify JSON integrity:
  cast keccak seed/audit-packs/INV-012.json

Anchor on-chain (Safe admin):
  pnpm audit:anchor INV-012

ZIP contents:
  - INV-012.json — full manifest
  - INV-012-README.txt — this file
  - INV-012-canonicalization.json — excluded nodes + preview
  - INV-012-validation.json — structural / SVRL validation report

Privacy: only packHash on-chain (AuditAnchor). PII in IVMS101 stays off-chain.
