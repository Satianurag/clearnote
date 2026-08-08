#!/usr/bin/env node
/**
 * DEPRECATED — DvPEscrow uses AccessControl + Safe admin (no owner()).
 * Use: pnpm validator:register-pool
 * Or: node scripts/validator-register-pool.mjs <compliancePoolAddress>
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const deploy = JSON.parse(readFileSync(resolve(root, 'deployments/monad-10143.json'), 'utf8'))
const pool = deploy.compliancePool ?? deploy.e2e?.compliancePool

console.error('validator-register-dvp.mjs is deprecated.')
console.error('DvPEscrow has no Ownable.owner() — Cleanverse /validator/register requires pool owner EIP-191 sig.')
console.error(`Registered compliance pool: ${pool}`)
console.error('Run: pnpm validator:register-pool')
process.exit(1)
