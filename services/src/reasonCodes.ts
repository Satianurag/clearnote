/**
 * ClearNotePolicy custom error selectors — single source of truth for UI and docs.
 * Generate with: cast sig "<ErrorName>(<types>)"
 */
export const REASON_CODES: Record<string, string> = {
  // ClearNotePolicy v3
  "0x1513ddcb": "Position cap exceeded",
  "0x6294ca98": "Transfer lockup still active",
  "0x0505a996": "Maximum investor count reached",
  "0x90e3871c": "Token transfers paused",
  "0x0185f166": "Note token has no invoice backing",
  "0x3f70126b": "Policy not configured (fail closed)",
  "0xe3e32fdb": "Investor tier below required minimum",
  "0x80279111": "Address on sanctions list",
  "0xba7cb6e7": "A-Pass registry lookup failed (fail closed)",

  // Cleanverse BASE router (bubble unchanged from policy)
  "0xa6725971": "Recipient has no A-Pass (Cleanverse)",
  "0x322fde89": "Wallet frozen or A-Pass revoked (Cleanverse)",
  "0x51d86cca": "Country not permitted by token rule (Cleanverse)",
  "0xaecc0dbe": "A-Pass expired (Cleanverse)",
};

export function reasonForSelector(selector: string): string | undefined {
  const normalized = selector.toLowerCase();
  return REASON_CODES[normalized] ?? REASON_CODES[selector];
}
