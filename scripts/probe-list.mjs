import crypto from 'crypto'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('/home/sati/Desktop/cleanverse.env', 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

function enc(obj) {
  const key = Buffer.from(env.CLEANVERSE_API_KEY, 'base64')
  const iv = Buffer.alloc(16, 0)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  let e = cipher.update(JSON.stringify(obj), 'utf8', 'base64')
  e += cipher.final('base64')
  return e
}

const base = env.CLEANVERSE_API_BASE
const headers = { 'api-id': env.CLEANVERSE_API_ID, 'Content-Type': 'application/json' }

for (const method of ['GET', 'POST']) {
  const opts = { method, headers }
  if (method === 'POST') {
    opts.body = JSON.stringify({
      data: enc({ chain: 'monad', wallet_address: '0x20a2A3cBDd040fdC24c4ebA6fE8531Dad068B7CB' }),
    })
  }
  const res = await fetch(`${base}/atoken/list_my_atokens`, opts)
  const text = await res.text()
  console.log(method, res.status, text.slice(0, 1200))
}
