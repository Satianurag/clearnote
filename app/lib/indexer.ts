export type IndexerTransfer = {
  id: string
  from: string
  to: string
  value: string
  token?: string
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

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const endpoint = process.env.INDEXER_GRAPHQL_URL?.trim() || 'http://localhost:8082/v1/graphql'
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

export async function queryIndexer(limit = 25) {
  try {
    const data = await gql<{
      Transfer?: IndexerTransfer[]
      Transfer_aggregate?: { aggregate?: { count?: number } }
      chain_metadata?: IndexerMetadata[]
    }>(TRANSFERS_QUERY, { limit })

    return {
      transfers: data.Transfer ?? [],
      total: data.Transfer_aggregate?.aggregate?.count ?? 0,
      metadata: data.chain_metadata?.[0] ?? null,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Indexer unreachable'
    return { transfers: [], total: 0, metadata: null, error: msg }
  }
}

export async function queryIndexerInvoices(limit = 50, originator?: string) {
  try {
    type InvoiceData = {
      InvoiceRegistered?: IndexerInvoice[]
      DuplicateAttempted?: IndexerDuplicate[]
      ObligorAccepted?: Array<{ invoiceId: string; obligor: string; deadline: string }>
      InvoiceFinanced?: Array<{ invoiceId: string; noteToken: string; units: string }>
    }

    const data = originator
      ? await gql<InvoiceData>(INVOICES_BY_ORIGINATOR_QUERY, { limit: Math.min(limit * 4, 200) })
      : await gql<InvoiceData>(INVOICES_ALL_QUERY, { limit })

    const allRegistered = data.InvoiceRegistered ?? []
    const invoices = originator
      ? allRegistered.filter(
          (inv) => inv.originator.toLowerCase() === originator.toLowerCase(),
        ).slice(0, limit)
      : allRegistered

    return {
      invoices,
      duplicates: data.DuplicateAttempted ?? [],
      accepted: data.ObligorAccepted ?? [],
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
