import fs from 'fs'
import path from 'path'

let cached: Record<string, string> | null = null

function loadKeysFile(): Record<string, string> {
  if (cached) return cached
  const candidates = [
    path.resolve(process.cwd(), '..', 'clearnote.keys.env'),
    path.resolve(process.cwd(), 'clearnote.keys.env'),
  ]
  const out: Record<string, string> = {}
  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue
    const text = fs.readFileSync(filePath, 'utf8')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1)
    }
    break
  }
  cached = out
  return out
}

/** Server-only: env var first, then repo clearnote.keys.env (mirrors shell scripts). */
export function getServerSecret(name: string): string | undefined {
  const fromEnv = process.env[name]?.trim()
  if (fromEnv) return fromEnv
  return loadKeysFile()[name]?.trim()
}
