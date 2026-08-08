import { createPublicClient, http } from 'viem'
import { hashInvoiceFile } from '../pint/cli.js'

const APASS_HAS = '0x7a28eae6'
const REGISTRY = '0xbA82D189540CaC9DC6FF46B6837CaC1BFdEC58B9'

export async function fallbackVerifyApass(address: string, rpc: string) {
  const client = createPublicClient({ transport: http(rpc) })
  try {
    const ok = await client.call({
      to: REGISTRY,
      data: (APASS_HAS + address.slice(2).padStart(64, '0')) as `0x${string}`,
    })
    return { hasApass: ok.data !== '0x', method: 'on-chain hasApass' }
  } catch {
    return { hasApass: false, method: 'on-chain hasApass (error)' }
  }
}

export async function fallbackValidatorVerify(xmlPath: string) {
  const h = hashInvoiceFile(xmlPath)
  return { ok: h.validation.ok, errors: h.validation.errors, method: 'local Schematron/structural' }
}

export async function fallbackQueryTxs(graphqlUrl: string) {
  const res = await fetch(graphqlUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hasura-admin-secret': 'testing' },
    body: JSON.stringify({
      query: 'query { Transfer_aggregate { aggregate { count } } }',
    }),
  })
  const json = await res.json()
  return { count: json.data?.Transfer_aggregate?.aggregate?.count, method: 'Envio GraphQL' }
}
