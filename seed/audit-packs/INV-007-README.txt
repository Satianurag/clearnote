ClearNote audit pack — INV-007
packHash (keccak256 of JSON): 0x6e226e69f39c95f69ba7f5fc13448842acae72960ba93516c0fe32edd2ea11ae
docHash: 0x9a17deca0488dcdb0aad2fd071fbd69c503a1798106e6ecc3e962e07f6fb8d30
ivmsHash: 0x892404ea2ce3653437c38855f0ceb0bf17e88673d3e6fb99168ae7138c06a422
travelRuleRequired: true

Recompute docHash:
  pnpm pint:hash seed/invoices/INV-007.xml

Verify JSON integrity:
  cast keccak seed/audit-packs/INV-007.json

Anchor on-chain (Safe admin):
  pnpm audit:anchor INV-007

ZIP contents:
  - INV-007.json — full manifest
  - INV-007-README.txt — this file
  - INV-007-canonicalization.json — excluded nodes + preview
  - INV-007-validation.json — structural / SVRL validation report

Privacy: only packHash on-chain (AuditAnchor). PII in IVMS101 stays off-chain.
