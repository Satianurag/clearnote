import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getAddress, type Hex } from 'viem'
import { repoRoot } from '@/lib/repo-root'

export type OfacRootMeta = {
  sourceDate: string
  sourceUri?: string
  realCount: number
  demoCount: number
  totalCount: number
  root: Hex
}

type OfacRootFile = OfacRootMeta & {
  proofs?: Record<string, Hex[]>
}

export function loadOfacRoot(): OfacRootFile | null {
  const path = resolve(repoRoot(), 'seed/ofac/ofac-root.json')
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8')) as OfacRootFile
}

export function ofacRootMeta(): OfacRootMeta | null {
  const data = loadOfacRoot()
  if (!data) return null
  return {
    sourceDate: data.sourceDate,
    sourceUri: data.sourceUri,
    realCount: data.realCount,
    demoCount: data.demoCount,
    totalCount: data.totalCount,
    root: data.root,
  }
}

export function proofForAddress(address: string): Hex[] | null {
  const data = loadOfacRoot()
  if (!data?.proofs) return null
  const key = getAddress(address).toLowerCase()
  const proof = data.proofs[key]
  return proof?.length ? proof : null
}

export function addressInOfacList(address: string): boolean {
  const data = loadOfacRoot()
  if (!data?.proofs) return false
  return Boolean(data.proofs[getAddress(address).toLowerCase()])
}
