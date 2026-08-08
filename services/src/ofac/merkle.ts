import { createHash } from 'node:crypto'

function hashPair(a: string, b: string): string {
  const ah = a.replace(/^0x/, '').toLowerCase()
  const bh = b.replace(/^0x/, '').toLowerCase()
  const [left, right] = ah <= bh ? [ah, bh] : [bh, ah]
  return (
    '0x' +
    createHash('keccak256')
      .update(Buffer.from(left, 'hex'))
      .update(Buffer.from(right, 'hex'))
      .digest('hex')
  )
}

export function addressLeaf(addr: string): string {
  const bytes = Buffer.from(addr.replace(/^0x/i, ''), 'hex')
  return '0x' + createHash('keccak256').update(bytes).digest('hex')
}

export function buildMerkle(leaves: string[]): { root: string; proofs: Map<string, string[]> } {
  if (leaves.length === 0) {
    return { root: '0x' + '0'.repeat(64), proofs: new Map() }
  }
  const sorted = [...leaves].sort((a, b) => a.localeCompare(b))
  const proofs = new Map<string, string[]>()
  for (const l of sorted) proofs.set(l, [])

  let layer = sorted
  while (layer.length > 1) {
    const next: string[] = []
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i]
      const right = layer[i + 1] ?? left
      const parent = hashPair(left, right)
      next.push(parent)
      for (const [leaf, path] of proofs) {
        if (layer.includes(leaf)) {
          const idx = layer.indexOf(leaf)
          const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1
          if (siblingIdx >= 0 && siblingIdx < layer.length) {
            path.push(layer[siblingIdx])
          }
        }
      }
    }
    layer = next
  }
  return { root: layer[0], proofs }
}
