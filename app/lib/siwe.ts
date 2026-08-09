import { createPublicClient, getAddress, http } from 'viem'
import { parseSiweMessage, verifySiweMessage } from 'viem/siwe'
import { rpcUrl } from '@/lib/config'
import { monadTestnet } from '@/wagmi.config'

export function financeSiweStatement(invoiceId: string): string {
  return `Authorize ClearNote issueNote via Safe for invoice ${invoiceId.toLowerCase()}`
}

export function settleSiweStatement(invoiceId: string): string {
  return `Authorize ClearNote settle via Safe for invoice ${invoiceId.toLowerCase()}`
}

export function markDefaultSiweStatement(invoiceId: string): string {
  return `Authorize ClearNote markDefault via Safe for invoice ${invoiceId.toLowerCase()}`
}

/** SIWE domain must match exactly between wallet sign and server verify (include port in dev). */
export function siweDomainFromHost(host: string | null | undefined): string {
  const configured = process.env.SIWE_DOMAIN?.trim()
  if (configured) return configured
  return host?.trim() || 'localhost'
}

/** Server: derive domain from the incoming Host header. */
export function siweDomainFromRequest(host: string | null): string {
  return siweDomainFromHost(host)
}

/** Client: derive domain from the browser location (must match Host header on API calls). */
export function siweDomainFromWindow(): string {
  if (typeof window === 'undefined') return 'localhost'
  return window.location.host
}

async function verifyIssuerSiwe(params: {
  message: string
  signature: `0x${string}`
  expectedAddress: string
  invoiceId: string
  domain: string
  expectedStatement: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = createPublicClient({ chain: monadTestnet, transport: http(rpcUrl) })

  let parsed
  try {
    parsed = parseSiweMessage(params.message)
  } catch {
    return { ok: false, error: 'Malformed SIWE message' }
  }

  if (!parsed.address) {
    return { ok: false, error: 'SIWE message missing address' }
  }

  const valid = await verifySiweMessage(client, {
    message: params.message,
    signature: params.signature,
    domain: params.domain,
    nonce: parsed.nonce,
    time: new Date(),
  })

  if (!valid) {
    return { ok: false, error: 'Invalid SIWE signature' }
  }

  if (parsed.chainId !== monadTestnet.id) {
    return { ok: false, error: `SIWE chainId must be ${monadTestnet.id}` }
  }

  if (getAddress(parsed.address) !== getAddress(params.expectedAddress)) {
    return { ok: false, error: 'SIWE address does not match originator' }
  }

  if (parsed.statement !== params.expectedStatement) {
    return { ok: false, error: 'SIWE statement does not match invoice action' }
  }

  return { ok: true }
}

export async function verifyFinanceSiwe(params: {
  message: string
  signature: `0x${string}`
  expectedAddress: string
  invoiceId: string
  domain: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return verifyIssuerSiwe({
    ...params,
    expectedStatement: financeSiweStatement(params.invoiceId),
  })
}

export async function verifySettleSiwe(params: {
  message: string
  signature: `0x${string}`
  expectedAddress: string
  invoiceId: string
  domain: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return verifyIssuerSiwe({
    ...params,
    expectedStatement: settleSiweStatement(params.invoiceId),
  })
}

export async function verifyMarkDefaultSiwe(params: {
  message: string
  signature: `0x${string}`
  expectedAddress: string
  invoiceId: string
  domain: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return verifyIssuerSiwe({
    ...params,
    expectedStatement: markDefaultSiweStatement(params.invoiceId),
  })
}
