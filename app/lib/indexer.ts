import { createPublicClient, http } from 'viem'
import { monadTestnet } from 'viem/chains'
import { rpcUrl } from '@/lib/config'

export type IndexerTransfer = {
  id: string
  from: string
  to: string
  value: string
  token?: string
  /** Parsed from id (`chainId_block_logIndex`) or indexer when available */
  blockNumber?: number
  /** Unix seconds — from indexer or RPC `eth_getBlock` */
  blockTimestamp?: number
}

export type IndexerInvoice = {
  id: string
  invoiceId: string
  originator: string
  obligor: string
}

export type IndexerDuplicate = {
  id: string
  invoiceId: string
  wouldBeOriginator: string
  existingOriginator: string
}

export type IndexerOffer = {
  id: string
  offerId: string
  maker: string
  noteToken: string
  cashToken: string
  units: string
  pricePerUnit: string
  minFill: string
  expiry: string
}

export type IndexerMetadata = {
  chain_id: number
  latest_processed_block: number
  num_events_processed: number
}

/** Event id format: `{chainId}_{blockNumber}_{logIndex}` */
export function parseBlockFromTransferId(id: string): number | null {
  const parts = id.split('_')
  if (parts.length < 2) return null
  const block = Number(parts[1])
  return Number.isFinite(block) && block > 0 ? block : null
}

let blockTimeClient: ReturnType<typeof createPublicClient> | null = null

function getBlockTimeClient() {
  if (!blockTimeClient) {
    blockTimeClient = createPublicClient({ chain: monadTestnet, transport: http(rpcUrl) })
  }
  return blockTimeClient
}

async function enrichTransfersWithTimestamps(
  transfers: IndexerTransfer[],
): Promise<IndexerTransfer[]> {
  if (transfers.length === 0) return transfers

  const blocks = new Set<number>()
  for (const t of transfers) {
    if (t.blockTimestamp != null) continue
    const blockNumber = t.blockNumber ?? parseBlockFromTransferId(t.id)
    if (blockNumber != null) blocks.add(blockNumber)
  }
  if (blocks.size === 0) return transfers

  const timestamps = new Map<number, number>()
  const client = getBlockTimeClient()
  await Promise.all(
    [...blocks].map(async (blockNumber) => {
      try {
        const block = await client.getBlock({ blockNumber: BigInt(blockNumber) })
        timestamps.set(blockNumber, Number(block.timestamp))
      } catch {
        // omit — UI shows em dash
      }
    }),
  )

  return transfers.map((t) => {
    if (t.blockTimestamp != null) return t
    const blockNumber = t.blockNumber ?? parseBlockFromTransferId(t.id)
    if (blockNumber == null) return t
    const blockTimestamp = timestamps.get(blockNumber)
    return blockTimestamp != null
      ? { ...t, blockNumber, blockTimestamp }
      : { ...t, blockNumber }
  })
}

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const configured = process.env.INDEXER_GRAPHQL_URL?.trim()
  const endpoint =
    configured ||
    (process.env.VERCEL ? '' : 'http://localhost:8082/v1/graphql')
  if (!endpoint) throw new Error('Indexer not configured')
  const secret = process.env.INDEXER_GRAPHQL_ADMIN_SECRET?.trim() || 'testing'

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': secret,
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  })

  if (!res.ok) throw new Error(`Indexer HTTP ${res.status}`)

  const json = (await res.json()) as {
    data?: T
    errors?: Array<{ message: string }>
  }

  if (json.errors?.length) throw new Error(json.errors[0].message)
  return json.data as T
}

const TRANSFERS_QUERY = `
  query Transfers($limit: Int!) {
    Transfer(limit: $limit, order_by: { id: desc }) {
      id from to value token
    }
    Transfer_aggregate { aggregate { count } }
    chain_metadata { chain_id latest_processed_block num_events_processed }
  }
`

const TRANSFERS_FILTERED_QUERY = `
  query TransfersFiltered($limit: Int!, $where: Transfer_bool_exp!) {
    Transfer(limit: $limit, order_by: { id: desc }, where: $where) {
      id from to value token
    }
    Transfer_aggregate(where: $where) { aggregate { count } }
    chain_metadata { chain_id latest_processed_block num_events_processed }
  }
`

const COMPLIANCE_EVENTS_QUERY = `
  query ComplianceEvents($limit: Int!) {
    RootCommitted(limit: $limit, order_by: { id: desc }) {
      id root sourceUri publishedAt
    }
    SanctionedAdded(limit: $limit, order_by: { id: desc }) {
      id who
    }
    Anchored(limit: $limit, order_by: { id: desc }) {
      id anchorId packHash uri periodStart periodEnd
    }
  }
`

const INVOICES_ALL_QUERY = `
  query InvoicesAll($limit: Int!) {
    InvoiceRegistered(limit: $limit, order_by: { id: desc }) {
      id invoiceId originator obligor
    }
    DuplicateAttempted(limit: 20, order_by: { id: desc }) {
      id invoiceId wouldBeOriginator existingOriginator
    }
    ObligorAccepted(limit: $limit, order_by: { id: desc }) {
      id invoiceId obligor deadline
    }
    InvoiceFinanced(limit: $limit, order_by: { id: desc }) {
      id invoiceId noteToken units
    }
  }
`

const INVOICES_BY_ORIGINATOR_QUERY = `
  query InvoicesByOriginator($limit: Int!) {
    InvoiceRegistered(
      limit: $limit
      order_by: { id: desc }
    ) {
      id invoiceId originator obligor
    }
    DuplicateAttempted(limit: 20, order_by: { id: desc }) {
      id invoiceId wouldBeOriginator existingOriginator
    }
    ObligorAccepted(limit: $limit, order_by: { id: desc }) {
      id invoiceId obligor deadline
    }
    InvoiceFinanced(limit: $limit, order_by: { id: desc }) {
      id invoiceId noteToken units
    }
  }
`

const OFFERS_QUERY = `
  query Offers($limit: Int!) {
    OfferPosted(limit: $limit, order_by: { offerId: desc }) {
      id offerId maker noteToken cashToken units pricePerUnit minFill expiry
    }
    OfferFilled(limit: 10, order_by: { id: desc }) {
      id offerId buyer units cashPaid
    }
  }
`

const POSITIONS_QUERY = `
  query Positions($holder: String!, $limit: Int!) {
    NoteIssued(limit: $limit, order_by: { id: desc }, where: { to: { _eq: $holder } }) {
      id invoiceId units noteToken
    }
    OfferFilled(limit: $limit, order_by: { id: desc }, where: { buyer: { _eq: $holder } }) {
      id offerId units cashPaid
    }
    OfferPosted(limit: 200, order_by: { offerId: desc }) {
      offerId noteToken
    }
  }
`

export type IndexerPositionIssued = {
  invoiceId: string
  units: string
  noteToken: string
}

export type IndexerPositionFill = {
  offerId: string
  units: string
  cashPaid: string
  noteToken?: string
  invoiceId?: string
}

export type IndexerComplianceEvent =
  | { kind: 'root'; id: string; root: string; sourceUri: string; publishedAt: string }
  | { kind: 'sanctioned'; id: string; who: string }
  | {
      kind: 'anchored'
      id: string
      anchorId: string
      packHash: string
      uri: string
      periodStart: string
      periodEnd: string
    }

export async function queryIndexer(limit = 25, wallet?: string, token?: string) {
  try {
    const walletLc = wallet?.toLowerCase()
    const useFilter = Boolean(walletLc || token)

    const where: Record<string, unknown> = {}
    if (walletLc) {
      where._or = [{ from: { _eq: walletLc } }, { to: { _eq: walletLc } }]
    }
    if (token) {
      where.token = { _eq: token }
    }

    const data = useFilter
      ? await gql<{
          Transfer?: IndexerTransfer[]
          Transfer_aggregate?: { aggregate?: { count?: number } }
          chain_metadata?: IndexerMetadata[]
        }>(TRANSFERS_FILTERED_QUERY, { limit, where })
      : await gql<{
          Transfer?: IndexerTransfer[]
          Transfer_aggregate?: { aggregate?: { count?: number } }
          chain_metadata?: IndexerMetadata[]
        }>(TRANSFERS_QUERY, { limit })

    const transfers = await enrichTransfersWithTimestamps(data.Transfer ?? [])

    return {
      transfers,
      total: data.Transfer_aggregate?.aggregate?.count ?? 0,
      metadata: data.chain_metadata?.[0] ?? null,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Indexer unreachable'
    return { transfers: [], total: 0, metadata: null, error: msg }
  }
}

export async function queryIndexerCompliance(limit = 20) {
  try {
    const data = await gql<{
      RootCommitted?: Array<{ id: string; root: string; sourceUri: string; publishedAt: string }>
      SanctionedAdded?: Array<{ id: string; who: string }>
      Anchored?: Array<{
        id: string
        anchorId: string
        packHash: string
        uri: string
        periodStart: string
        periodEnd: string
      }>
    }>(COMPLIANCE_EVENTS_QUERY, { limit })

    const events: IndexerComplianceEvent[] = [
      ...(data.RootCommitted ?? []).map((row) => ({
        kind: 'root' as const,
        id: row.id,
        root: row.root,
        sourceUri: row.sourceUri,
        publishedAt: row.publishedAt,
      })),
      ...(data.SanctionedAdded ?? []).map((row) => ({
        kind: 'sanctioned' as const,
        id: row.id,
        who: row.who,
      })),
      ...(data.Anchored ?? []).map((row) => ({
        kind: 'anchored' as const,
        id: row.id,
        anchorId: row.anchorId,
        packHash: row.packHash,
        uri: row.uri,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
      })),
    ]

    events.sort((a, b) => b.id.localeCompare(a.id))

    return { events: events.slice(0, limit) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Indexer unreachable'
    return { events: [], error: msg }
  }
}

export async function queryIndexerInvoices(
  limit = 50,
  originator?: string,
  obligor?: string,
) {
  try {
    type InvoiceData = {
      InvoiceRegistered?: IndexerInvoice[]
      DuplicateAttempted?: IndexerDuplicate[]
      ObligorAccepted?: Array<{ invoiceId: string; obligor: string; deadline: string }>
      InvoiceFinanced?: Array<{ invoiceId: string; noteToken: string; units: string }>
    }

    const needsWideScan = Boolean(originator || obligor)
    const data = needsWideScan
      ? await gql<InvoiceData>(INVOICES_BY_ORIGINATOR_QUERY, { limit: Math.min(limit * 4, 200) })
      : await gql<InvoiceData>(INVOICES_ALL_QUERY, { limit })

    const allRegistered = data.InvoiceRegistered ?? []
    const accepted = data.ObligorAccepted ?? []
    const acceptedIds = new Set(accepted.map((row) => row.invoiceId.toLowerCase()))

    let invoices = allRegistered
    if (originator) {
      invoices = invoices.filter(
        (inv) => inv.originator.toLowerCase() === originator.toLowerCase(),
      )
    }
    if (obligor) {
      invoices = invoices.filter(
        (inv) => inv.obligor.toLowerCase() === obligor.toLowerCase(),
      )
      invoices = invoices.filter((inv) => !acceptedIds.has(inv.invoiceId.toLowerCase()))
    }
    invoices = invoices.slice(0, limit)

    let duplicates = data.DuplicateAttempted ?? []
    if (originator) {
      const originatorLc = originator.toLowerCase()
      duplicates = duplicates.filter(
        (d) =>
          d.wouldBeOriginator.toLowerCase() === originatorLc ||
          d.existingOriginator.toLowerCase() === originatorLc,
      )
    }

    return {
      invoices,
      duplicates,
      accepted,
      financed: data.InvoiceFinanced ?? [],
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Indexer unreachable'
    return { invoices: [], duplicates: [], accepted: [], financed: [], error: msg }
  }
}

export async function queryIndexerOffers(limit = 25) {
  try {
    const data = await gql<{
      OfferPosted?: IndexerOffer[]
      OfferFilled?: Array<{ offerId: string; buyer: string; units: string; cashPaid: string }>
    }>(OFFERS_QUERY, { limit })

    return {
      offers: data.OfferPosted ?? [],
      fills: data.OfferFilled ?? [],
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Indexer unreachable'
    return { offers: [], fills: [], error: msg }
  }
}

export async function queryIndexerPositions(holder: string, limit = 50) {
  try {
    const holderLc = holder.toLowerCase()
    const data = await gql<{
      NoteIssued?: IndexerPositionIssued[]
      OfferFilled?: Array<{ offerId: string; units: string; cashPaid: string }>
      OfferPosted?: Array<{ offerId: string; noteToken: string }>
    }>(POSITIONS_QUERY, { holder: holderLc, limit })

    const offerNote = new Map<string, string>()
    for (const offer of data.OfferPosted ?? []) {
      offerNote.set(offer.offerId, offer.noteToken)
    }

    const issued = (data.NoteIssued ?? []).map((row) => ({
      invoiceId: row.invoiceId,
      units: row.units,
      source: 'issued' as const,
      noteToken: row.noteToken,
    }))

    const fills = (data.OfferFilled ?? []).map((row) => ({
      invoiceId: undefined as string | undefined,
      units: row.units,
      source: 'dvp' as const,
      cashPaid: row.cashPaid,
      offerId: row.offerId,
      noteToken: offerNote.get(row.offerId),
    }))

    return { issued, fills, error: undefined as string | undefined }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Indexer unreachable'
    return { issued: [], fills: [], error: msg }
  }
}
