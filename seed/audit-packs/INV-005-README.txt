ClearNote audit pack — INV-005
packHash (keccak256 of JSON): 0x5c903a604e8263e4b42b1c1f7336efccf507febd4f952ed09a438dcbec8d1a6e
docHash: 0x9dd29c587cc05af9833bcf18e7c8cfe630139b621623ab395c3defa9684cf601
ivmsHash: 0x303aa6a9f1daf44c2eeb81a8e96e73dfb6d2dba27936e18ad90a8425397195c8
travelRuleRequired: true

Recompute docHash:
  pnpm pint:hash seed/invoices/INV-005.xml

Verify JSON integrity:
  cast keccak seed/audit-packs/INV-005.json

Anchor on-chain (Safe admin):
  pnpm audit:anchor INV-005

ZIP contents:
  - INV-005.json — full manifest
  - INV-005-README.txt — this file
  - INV-005-canonicalization.json — excluded nodes + preview
  - INV-005-validation.json — structural / SVRL validation report

Privacy: only packHash on-chain (AuditAnchor). PII in IVMS101 stays off-chain.
