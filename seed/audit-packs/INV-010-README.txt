ClearNote audit pack — INV-010
packHash (keccak256 of JSON): 0x90bd60443316b6a407221aa0dfa098ee7992b150213143d6e2d233511dcac5f1
docHash: 0xe3482d4c0f90a22a68afd855964660f239ca40c188e689196516c43ece81f1f6
ivmsHash: 0xe7059106acaf5c4bb710b6dd0bf501f48d6d6934d8992a035d8f99182d69d8ab
travelRuleRequired: true

Recompute docHash:
  pnpm pint:hash seed/invoices/INV-010.xml

Verify JSON integrity:
  cast keccak seed/audit-packs/INV-010.json

Anchor on-chain (Safe admin):
  pnpm audit:anchor INV-010

ZIP contents:
  - INV-010.json — full manifest
  - INV-010-README.txt — this file
  - INV-010-canonicalization.json — excluded nodes + preview
  - INV-010-validation.json — structural / SVRL validation report

Privacy: only packHash on-chain (AuditAnchor). PII in IVMS101 stays off-chain.
