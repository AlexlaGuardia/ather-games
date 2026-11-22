// Run: npx tsx src/app/shimmer/dev/sounds/sections.test.ts
// BETA M92: the sounds page sorts into PENDING (top, the working list) / NAY (Remove or Try again) / APPROVED (collapsed, bottom).
import { sections, removeNay } from './sections'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
type R = { id: string; status: 'proposed' | 'yay' | 'nay'; area: string }
const rows: R[] = [
  { id: 'a', status: 'yay', area: 'ui' }, { id: 'b', status: 'proposed', area: 'rinning' }, { id: 'c', status: 'nay', area: 'ui' },
  { id: 'd', status: 'proposed', area: 'ui' }, { id: 'e', status: 'yay', area: 'rinning' },
]
const s = sections(rows)
ok(s.pending.map(r => r.id).join() === 'b,d', 'pending = proposed rows, file order: ' + s.pending.map(r => r.id))
ok(s.nay.map(r => r.id).join() === 'c', 'nay = nay rows')
ok(s.approved.map(r => r.id).join() === 'a,e', 'approved = yay rows')
ok(s.pending.length + s.nay.length + s.approved.length === rows.length, 'every row lands in exactly one section')
// vote moves: yay -> approved, try again -> pending
const moved = sections(rows.map(r => (r.id === 'b' ? { ...r, status: 'yay' as const } : r.id === 'c' ? { ...r, status: 'proposed' as const } : r)))
ok(moved.approved.some(r => r.id === 'b') && moved.pending.some(r => r.id === 'c') && moved.nay.length === 0, 'yay moves to approved, try again moves nay back to pending')
// remove: only a nay row, and only that row
const rm = removeNay(rows, 'c')
ok(rm.ok && rm.rows.length === 4 && !rm.rows.some(r => r.id === 'c'), 'remove drops the nay row')
ok(!removeNay(rows, 'a').ok && removeNay(rows, 'a').rows === rows, 'remove refuses a yay row (un-nay it first)')
ok(!removeNay(rows, 'b').ok, 'remove refuses a pending row')
ok(!removeNay(rows, 'zz').ok, 'remove refuses an unknown id')

console.log(`sounds sections: ${pass} pass, ${fails.length} fail`); for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
