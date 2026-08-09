ClearNote audit pack — INV-006
packHash (keccak256 of JSON): 0x76578dea02f054a6d79fe9d4c9575e63104a89d77c36e3fa15d10b6122ff9593
docHash: 0xe42b31d232fd578d562b8ee621c2f9083c16b3cbc125b39f4bb1cc6bce0e3938
ivmsHash: 0x391e86b4e1aa2f8ff1f8948cfa8c7fcf0162ec811124d97e03c03507bd6ab27e
travelRuleRequired: true

Recompute docHash:
  pnpm pint:hash seed/invoices/INV-006.xml

Verify JSON integrity:
  cast keccak seed/audit-packs/INV-006.json

Anchor on-chain (Safe admin):
  pnpm audit:anchor INV-006

ZIP contents:
  - INV-006.json — full manifest
  - INV-006-README.txt — this file
  - INV-006-canonicalization.json — excluded nodes + preview
  - INV-006-validation.json — structural / SVRL validation report

Privacy: only packHash on-chain (AuditAnchor). PII in IVMS101 stays off-chain.
