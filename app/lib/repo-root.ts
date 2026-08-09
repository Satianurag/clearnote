import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/** Resolve monorepo root locally or `app/bundle` on Vercel. */
export function repoRoot(): string {
  const candidates = [
    process.env.CLEARNOTE_REPO_ROOT?.trim(),
    resolve(process.cwd(), 'bundle'),
    resolve(process.cwd(), '..'),
  ].filter((c): c is string => Boolean(c))

  for (const root of candidates) {
    if (existsSync(resolve(root, 'seed/manifest.json'))) return root
  }

  return resolve(process.cwd(), '..')
}
