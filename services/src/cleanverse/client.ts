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

  async queryApass(chain: string, address: string) {
    const r = await this.post('/query_apass', { chain, address })
    return { ...r, data: envelopePayload(r.json) }
  }
}
