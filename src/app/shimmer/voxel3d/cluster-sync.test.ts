// Run: npx tsx src/app/shimmer/voxel3d/cluster-sync.test.ts
// frameFromRecord: the shared record → the frame my plot space wears.
import { DEFAULT_PLOT } from '../voxel/plot'
import { frameFromRecord } from './cluster-sync'
import type { ClusterView } from '@/lib/accounts/clusters'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const view = (members: { quarter: 'ne' | 'nw' | 'sw' | 'se'; seed: number; tier: number }[]): ClusterView => ({
  cluster_id: 'c_x', folded_by: 'u1', offers: [],
  members: members.map((m, i) => ({ user_id: `u${i}`, username: null, ...m })),
})

ok(frameFromRecord(null, null, 1, 0, DEFAULT_PLOT) === null, 'no record, no frame')
ok(frameFromRecord(view([{ quarter: 'ne', seed: 1, tier: 0 }]), 'ne', 1, 0, DEFAULT_PLOT) === null, '★ a cluster of one is a fold held open — nothing to frame')
const two = view([{ quarter: 'ne', seed: 5, tier: 0 }, { quarter: 'sw', seed: 42, tier: 2 }])
const f = frameFromRecord(two, 'ne', 1337, 3, DEFAULT_PLOT)
ok(!!f && f.mine === 'ne', 'two keepers frame')
ok(f?.cfg.slots.ne?.seed === 1337 && f?.cfg.slots.ne?.tier === 3, '★ MY slot is my own save, never the server\'s stale report')
ok(f?.cfg.slots.sw?.seed === 42 && f?.cfg.slots.sw?.tier === 2, 'the mate\'s slot is their report')
ok(f?.cfg.slots.nw === null && f?.cfg.slots.se === null, 'an unfilled slot stays no ground')
ok(frameFromRecord(two, 'nw', 1, 0, DEFAULT_PLOT) === null, 'a quarter I do not stand in frames nothing')
ok(f?.cfg.base === DEFAULT_PLOT, 'the base plot rides through')

if (fails.length) { for (const m of fails) console.log('  FAIL ', m); console.log(`cluster-sync: ${pass} passed, ${fails.length} FAILED`); process.exit(1) }
console.log(`cluster-sync: ${pass}/0`)
