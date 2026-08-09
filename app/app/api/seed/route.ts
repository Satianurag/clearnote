import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { NextResponse } from 'next/server'
import { repoRoot } from '@/lib/repo-root'

export function GET() {
  const path = resolve(repoRoot(), 'seed/manifest.json')
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'))
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ invoices: [], error: 'manifest not found' })
  }
}
