#!/usr/bin/env node
/**
 * Copy repo seed + deployments into app/bundle for Vercel serverless (root = app/).
 * Safe to run locally before `next build` in CI/Vercel.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const bundleRoot = resolve(repoRoot, 'app/bundle')

const pairs = [
  [resolve(repoRoot, 'seed'), resolve(bundleRoot, 'seed')],
  [resolve(repoRoot, 'deployments'), resolve(bundleRoot, 'deployments')],
]

if (existsSync(bundleRoot)) rmSync(bundleRoot, { recursive: true, force: true })
mkdirSync(bundleRoot, { recursive: true })

for (const [src, dest] of pairs) {
  if (!existsSync(src)) {
    console.warn(`prepare-vercel-bundle: skip missing ${src}`)
    continue
  }
  cpSync(src, dest, { recursive: true })
  console.log(`prepare-vercel-bundle: ${src} → ${dest}`)
}

console.log('prepare-vercel-bundle: done')
