ClearNote audit pack — INV-002
packHash (keccak256 of JSON): 0x7b640baa4cafe12a556aec1417002ba114dc5a19c51d7a8536d0ade7ddd4aa1d
docHash: 0x5ae23e6fd6469644e50e7f8c7fec18ac8ccc1964e0d0b4fc00a7a96fccfc014a
ivmsHash: 0x52bce98d297449b95fd4bc4ecd649c33a079777f174c6dfe3bf0e144a8586df7
travelRuleRequired: true

Recompute docHash:
  pnpm pint:hash seed/invoices/INV-002.xml

Verify JSON integrity:
  cast keccak seed/audit-packs/INV-002.json

Anchor on-chain (Safe admin):
  pnpm audit:anchor INV-002

ZIP contents:
  - INV-002.json — full manifest
  - INV-002-README.txt — this file
  - INV-002-canonicalization.json — excluded nodes + preview
  - INV-002-validation.json — structural / SVRL validation report

Privacy: only packHash on-chain (AuditAnchor). PII in IVMS101 stays off-chain.
