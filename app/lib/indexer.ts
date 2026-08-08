export type IndexerTransfer = {
  id: string
  from: string
  to: string
  value: string
  token?: string
}

export type IndexerMetadata = {
  chain_id: number
  latest_processed_block: number
  num_events_processed: number
}

const TRANSFERS_QUERY = `
  query Transfers($limit: Int!) {
    Transfer(limit: $limit, order_by: { id: desc }) {
      id
      from
      to
      value
      token
    }
    Transfer_aggregate {
      aggregate {
        count
      }
    }
    chain_metadata {
      chain_id
      latest_processed_block
      num_events_processed
    }
  }
`

export async function queryIndexer(limit = 25): Promise<{
  transfers: IndexerTransfer[]
  total: number
  metadata: IndexerMetadata | null
  error?: string
}> {
  const endpoint = process.env.INDEXER_GRAPHQL_URL?.trim() || 'http://localhost:8082/v1/graphql'
  const secret = process.env.INDEXER_GRAPHQL_ADMIN_SECRET?.trim() || 'testing'

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hasura-admin-secret': secret,
      },
      body: JSON.stringify({ query: TRANSFERS_QUERY, variables: { limit } }),
      cache: 'no-store',
    })

    if (!res.ok) {
      return { transfers: [], total: 0, metadata: null, error: `Indexer HTTP ${res.status}` }
    }

    const json = (await res.json()) as {
      data?: {
        Transfer?: IndexerTransfer[]
        Transfer_aggregate?: { aggregate?: { count?: number } }
        chain_metadata?: IndexerMetadata[]
      }
      errors?: Array<{ message: string }>
    }

    if (json.errors?.length) {
      return { transfers: [], total: 0, metadata: null, error: json.errors[0].message }
    }

    return {
      transfers: json.data?.Transfer ?? [],
      total: json.data?.Transfer_aggregate?.aggregate?.count ?? 0,
      metadata: json.data?.chain_metadata?.[0] ?? null,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Indexer unreachable'
    return { transfers: [], total: 0, metadata: null, error: msg }
  }
}
