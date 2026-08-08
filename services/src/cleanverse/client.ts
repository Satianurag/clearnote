import { encryptPayload, isOkEnvelope, envelopePayload } from './crypto.js'

export interface CleanverseConfig {
  baseUrl: string
  apiId: string
  apiKey: string
}

export class CleanverseClient {
  constructor(private cfg: CleanverseConfig) {}

  async post(endpoint: string, body: unknown, encrypt = true) {
    const url = `${this.cfg.baseUrl}${endpoint}`
    const payload = encrypt ? { data: encryptPayload(body, this.cfg.apiKey) } : body
    const start = Date.now()
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-id': this.cfg.apiId },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    return { json, ms: Date.now() - start, ok: isOkEnvelope(json) }
  }

  async get(path: string) {
    const start = Date.now()
    const res = await fetch(`${this.cfg.baseUrl}${path}`, {
      headers: { 'api-id': this.cfg.apiId },
    })
    const json = await res.json()
    return { json, ms: Date.now() - start, ok: isOkEnvelope(json) }
  }

  /** Plain JSON per docs v5.6 */
  async queryApass(chain: string, address: string) {
    const r = await this.post('/query_apass', { chain, address }, false)
    return { ...r, data: envelopePayload(r.json) }
  }

  /** `atoken` = A-Token contract address (not symbol). */
  async verifyApass(chain: string, atokenAddress: string, address: string) {
    const r = await this.post('/verify_apass', { chain, atoken: atokenAddress, address }, false)
    return { ...r, data: envelopePayload(r.json) }
  }

  async queryTxs(
    chain: string,
    address: string,
    opts?: { symbol?: string; page?: number; pageSize?: number },
  ) {
    const body: Record<string, unknown> = { chain, address }
    if (opts?.symbol) body.symbol = opts.symbol
    if (opts?.page) body.page = opts.page
    if (opts?.pageSize) body.pageSize = opts.pageSize
    const r = await this.post('/query_txs', body, false)
    return { ...r, data: envelopePayload(r.json) }
  }

  async listMyAtokens(opts?: {
    page?: number
    pageSize?: number
    chain?: string
    applyStatus?: string
  }) {
    const q = new URLSearchParams()
    if (opts?.page) q.set('page', String(opts.page))
    if (opts?.pageSize) q.set('page_size', String(opts.pageSize))
    if (opts?.chain) q.set('chain', opts.chain)
    if (opts?.applyStatus) q.set('apply_status', opts.applyStatus)
    const suffix = q.toString() ? `?${q.toString()}` : ''
    return this.get(`/atoken/list_my_atokens${suffix}`)
  }
}
