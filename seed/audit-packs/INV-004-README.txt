ClearNote audit pack — INV-004
packHash (keccak256 of JSON): 0x6e63a1d12ed58b52c0affbe8478034e8c405ad59b6c6b753646aa6213297aab5
docHash: 0x0e026bfe4c849eb66895a5845956320a13ce5938ca3974273490cd64ebd8b473
ivmsHash: 0xca6ec61eed9d7e4e204de9cba8122c03983eae427741c1fae69f0b932e23d578
travelRuleRequired: true

Recompute docHash:
  pnpm pint:hash seed/invoices/INV-004.xml

Verify JSON integrity:
  cast keccak seed/audit-packs/INV-004.json

Anchor on-chain (Safe admin):
  pnpm audit:anchor INV-004

ZIP contents:
  - INV-004.json — full manifest
  - INV-004-README.txt — this file
  - INV-004-canonicalization.json — excluded nodes + preview
  - INV-004-validation.json — structural / SVRL validation report

Privacy: only packHash on-chain (AuditAnchor). PII in IVMS101 stays off-chain.
