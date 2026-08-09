ClearNote audit pack — INV-008
packHash (keccak256 of JSON): 0xbed6235f9193e5ee0ab69f77a2fcc9144b3bc9899426f3ef2edd3b01b9db75f2
docHash: 0x11aaeb77b536cfcf91873905bc7790d9679386161da87a347d6a4b70607c1f7d
ivmsHash: 0x2c61e98578fed2ddd808249ada7efa7752674c14f7e693264adceb0c6cd35e9a
travelRuleRequired: true

Recompute docHash:
  pnpm pint:hash seed/invoices/INV-008.xml

Verify JSON integrity:
  cast keccak seed/audit-packs/INV-008.json

Anchor on-chain (Safe admin):
  pnpm audit:anchor INV-008

ZIP contents:
  - INV-008.json — full manifest
  - INV-008-README.txt — this file
  - INV-008-canonicalization.json — excluded nodes + preview
  - INV-008-validation.json — structural / SVRL validation report

Privacy: only packHash on-chain (AuditAnchor). PII in IVMS101 stays off-chain.
