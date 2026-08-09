ClearNote audit pack — INV-009
packHash (keccak256 of JSON): 0x024b7ea51dc17a4a7eaf9e8c6f90a6cc5f1b54d280914258b237900df5fdfa20
docHash: 0x3a13019d99177220d5d7d07f4551c5981b0d743af27864fce9985957361a1af2
ivmsHash: 0x892404ea2ce3653437c38855f0ceb0bf17e88673d3e6fb99168ae7138c06a422
travelRuleRequired: true

Recompute docHash:
  pnpm pint:hash seed/invoices/INV-009.xml

Verify JSON integrity:
  cast keccak seed/audit-packs/INV-009.json

Anchor on-chain (Safe admin):
  pnpm audit:anchor INV-009

ZIP contents:
  - INV-009.json — full manifest
  - INV-009-README.txt — this file
  - INV-009-canonicalization.json — excluded nodes + preview
  - INV-009-validation.json — structural / SVRL validation report

Privacy: only packHash on-chain (AuditAnchor). PII in IVMS101 stays off-chain.
