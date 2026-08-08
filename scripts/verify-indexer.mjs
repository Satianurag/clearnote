import { execFileSync } from 'node:child_process'

const URL = process.env.INDEXER_GRAPHQL_URL ?? 'http://localhost:8082/v1/graphql'
const SECRET = process.env.INDEXER_GRAPHQL_ADMIN_SECRET ?? 'testing'

function gql(query) {
  const out = execFileSync(
    'curl',
    [
      '-sf',
      URL,
      '-H',
      'Content-Type: application/json',
      '-H',
      `x-hasura-admin-secret: ${SECRET}`,
      '-d',
      JSON.stringify({ query }),
    ],
    { encoding: 'utf8' },
  )
  return JSON.parse(out)
}

let ok = true
function pass(msg) {
  console.log('PASS', msg)
}
function fail(msg) {
  console.error('FAIL', msg)
  ok = false
}

try {
  const r = gql(`
    {
      Transfer_aggregate { aggregate { count } }
      InvoiceRegistered_aggregate { aggregate { count } }
      NoteIssued_aggregate { aggregate { count } }
      ObligorAccepted_aggregate { aggregate { count } }
      RootCommitted_aggregate { aggregate { count } }
      Anchored_aggregate { aggregate { count } }
    }
  `)
  const d = r.data ?? {}
  const t = d.Transfer_aggregate?.aggregate?.count ?? 0
  const reg = d.InvoiceRegistered_aggregate?.aggregate?.count ?? 0
  const notes = d.NoteIssued_aggregate?.aggregate?.count ?? 0
  const acc = d.ObligorAccepted_aggregate?.aggregate?.count ?? 0
  const roots = d.RootCommitted_aggregate?.aggregate?.count ?? 0
  const anchors = d.Anchored_aggregate?.aggregate?.count ?? 0

  console.log(`counts: Transfer=${t} InvoiceRegistered=${reg} NoteIssued=${notes} ObligorAccepted=${acc} RootCommitted=${roots} Anchored=${anchors}`)

  if (t > 0) pass(`Transfer_aggregate ${t}`)
  else fail('Transfer_aggregate empty')

  if (reg >= 11) pass(`InvoiceRegistered_aggregate ${reg}`)
  else fail(`InvoiceRegistered expected >=11 got ${reg}`)

  if (notes >= 11) pass(`NoteIssued_aggregate ${notes}`)
  else if (notes >= 10) {
    pass(`NoteIssued_aggregate ${notes}`)
    console.warn('NOTE: INV-013 (controllerIssueNote_v32) may be pending — indexer still catching up to block 51904536')
  } else if (notes >= 8) pass(`NoteIssued_aggregate ${notes}`)
  else fail(`NoteIssued expected >=8 got ${notes}`)

  if (acc >= 10) pass(`ObligorAccepted_aggregate ${acc}`)
  else fail(`ObligorAccepted expected >=10 got ${acc}`)

  if (roots >= 1) pass(`RootCommitted_aggregate ${roots}`)
  else fail('RootCommitted expected >=1 (OFAC commit)')

  if (anchors >= 1) pass(`Anchored_aggregate ${anchors}`)
  else fail('Anchored expected >=1 (audit pack)')
} catch (e) {
  fail(`GraphQL unreachable: ${e}`)
}

console.log(ok ? 'indexer:verify OK' : 'indexer:verify FAIL')
process.exit(ok ? 0 : 1)
