import { createCipheriv, createDecipheriv } from 'node:crypto'

export function decryptPayload(data: string, apiKeyBase64: string): unknown {
  const key = Buffer.from(apiKeyBase64, 'base64')
  const iv = Buffer.alloc(16, 0)
  const decipher = createDecipheriv('aes-256-cbc', key, iv)
  let plain = decipher.update(data, 'base64', 'utf8')
  plain += decipher.final('utf8')
  return JSON.parse(plain)
}

export function encryptPayload(obj: unknown, apiKeyBase64: string): string {
  const key = Buffer.from(apiKeyBase64, 'base64')
  const iv = Buffer.alloc(16, 0)
  const cipher = createCipheriv('aes-256-cbc', key, iv)
  const plain = JSON.stringify(obj)
  let enc = cipher.update(plain, 'utf8', 'base64')
  enc += cipher.final('base64')
  return enc
}

export function isOkEnvelope(json: { code?: number | string }): boolean {
  return json.code === 4 || json.code === '0000'
}

export function envelopePayload<T>(json: { data?: T; result?: T }): T | undefined {
  return json.data ?? json.result
}
