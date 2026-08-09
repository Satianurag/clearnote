ClearNote audit pack — INV-001
packHash (keccak256 of JSON): 0x6542a15911f3ea8abb75814ec69e58b70b564eb5392138d20de43a7a4bbc13d7
docHash: 0x156571a2180edff7e838108b2d07f44b1a1c4e97c5d84e413a4a8a28ecdf448f
ivmsHash: 0x892404ea2ce3653437c38855f0ceb0bf17e88673d3e6fb99168ae7138c06a422
travelRuleRequired: true

Recompute docHash:
  pnpm pint:hash seed/invoices/INV-001.xml

Verify JSON integrity:
  cast keccak seed/audit-packs/INV-001.json

Anchor on-chain (Safe admin):
  pnpm audit:anchor INV-001

ZIP contents:
  - INV-001.json — full manifest
  - INV-001-README.txt — this file
  - INV-001-canonicalization.json — excluded nodes + preview
  - INV-001-validation.json — structural / SVRL validation report

Privacy: only packHash on-chain (AuditAnchor). PII in IVMS101 stays off-chain.
