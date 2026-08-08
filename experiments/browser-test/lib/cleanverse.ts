import crypto from 'crypto'

function resolveKeyAndAlgo(apiKey: string) {
  let key: Buffer
  if (apiKey.endsWith('=') || /^[A-Za-z0-9+/]+=*$/.test(apiKey)) {
    key = Buffer.from(apiKey, 'base64')
  } else {
    key = Buffer.from(apiKey, 'utf-8')
  }
  const algo =
    key.length === 32
      ? 'aes-256-cbc'
      : key.length === 24
        ? 'aes-192-cbc'
        : key.length === 16
          ? 'aes-128-cbc'
          : 'aes-128-cbc'
  if (algo === 'aes-128-cbc' && key.length !== 16) {
    const padded = Buffer.alloc(16, 0)
    key.copy(padded, 0, 0, Math.min(key.length, 16))
    key = padded
  }
  return { key, algo }
}

export function encryptPayload(obj: Record<string, unknown>, apiKey: string) {
  const { key, algo } = resolveKeyAndAlgo(apiKey)
  const iv = Buffer.alloc(16, 0)
  const plain = JSON.stringify(obj)
  const cipher = crypto.createCipheriv(algo, key, iv)
  let enc = cipher.update(plain, 'utf8', 'base64')
  enc += cipher.final('base64')
  return enc
}

function isSuccess(code: unknown) {
  return code === 4 || code === '0000' || code === '4'
}

export type CvResult = {
  ok: boolean
  raw: Record<string, unknown>
  data: unknown
  code: unknown
  message: unknown
}

export async function cvRequest(
  base: string,
  apiId: string,
  apiKey: string,
  endpoint: string,
  body: Record<string, unknown>,
  { encrypted = false } = {},
): Promise<CvResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'api-id': apiId }
  const payload = encrypted
    ? JSON.stringify({ data: encryptPayload(body, apiKey) })
    : JSON.stringify(body)

  const res = await fetch(`${base}${endpoint}`, {
    method: 'POST',
    headers,
    body: payload,
  })
  const json = (await res.json()) as Record<string, unknown>
  return {
    ok: isSuccess(json.code),
    raw: json,
    data: json.data ?? json.result ?? null,
    code: json.code,
    message: json.message,
  }
}

export function getCleanverseConfig() {
  const base = process.env.CLEANVERSE_API_BASE?.trim()
  const apiId = process.env.CLEANVERSE_API_ID?.trim()
  const apiKey = process.env.CLEANVERSE_API_KEY?.trim()
  if (!base || !apiId || !apiKey) return null
  return { base, apiId, apiKey }
}
