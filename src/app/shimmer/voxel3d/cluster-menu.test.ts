// Run: npx tsx src/app/shimmer/voxel3d/cluster-menu.test.ts
// The Gardens menu's cluster rows, asserted on the model: canon's guards live here, not in JSX.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { clusterMenu, type Friend } from './cluster-menu'
import type { ClusterView } from '@/lib/accounts/clusters'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const friends: Friend[] = [
  { user_id: 'b', username: 'bo', status: 'accepted' }, { user_id: 'c', username: 'cy', status: 'accepted' },
  { user_id: 'd', username: 'di', status: 'pending' },
]
const view = (members: [string, 'ne' | 'nw' | 'sw' | 'se'][], offers: ClusterView['offers'] = []): ClusterView => ({
  cluster_id: 'c1', folded_by: 'a', offers,
  members: members.map(([id, q]) => ({ user_id: id, username: id === 'a' ? 'alex' : id, quarter: q, seed: 1, tier: 0 })),
})

// §1 outside a cluster
{
  const m = clusterMenu(null, null, [], friends, true)
  ok(m.mode === 'none' && m.canFold && !m.foldNeedsEnchant, '§1 Enchant → you may fold')
  ok(m.askable.length === 0 && !m.canWalk, '§1 nobody to ask and nothing to walk before a fold')
  const n = clusterMenu(null, null, [{ cluster_id: 'x', quarter: 'sw', keepers: ['alex'], waiting: 0 }], friends, false)
  ok(!n.canFold && n.foldNeedsEnchant, '§1 no Enchant → no fold, and the menu says why')
  ok(n.invites.length === 1, '★ §1 ★ joining needs NO rune: an invite shows to a keeper without Enchant')
}
// §2 a fold held open (you alone)
{
  const m = clusterMenu(view([['a', 'ne']]), 'ne', [], friends, true)
  ok(m.mode === 'held' && !m.canWalk && !m.canFold, '§2 a cluster of one: nothing to walk, no second fold')
  ok(m.askable.map(f => f.username).join() === 'bo,cy', '§2 accepted friends only are askable')
  ok(m.nextOpen === 'nw', '§2 the ask fills the first open slot')
}
// §3 two keepers, one pending offer
{
  const v = view([['a', 'ne'], ['b', 'nw']], [{ quarter: 'sw', invitee_id: 'c', invitee: 'cy', consented: ['a'] }])
  const m = clusterMenu(v, 'nw', [], friends, false)
  ok(m.mode === 'cluster' && m.canWalk, '§3 two keepers can walk it')
  ok(m.keepers.find(k => k.you)?.name === 'b', '§3 you are marked')
  ok(m.pending.length === 1 && m.pending[0].waiting === 1 && !m.pending[0].youSaidYes, '★ §3 bo has not said yes: the offer waits on one')
  ok(m.askable.length === 0, '§3 cy is already asked, bo is in, di is not a friend yet — nobody else to ask')
  ok(m.nextOpen === 'se', '§3 sw is offered, so the next ask is se')
  const a = clusterMenu(v, 'ne', [], friends, false)
  ok(a.pending[0].youSaidYes, '§3 the asker already said yes')
  ok(clusterMenu(v, 'nw', [{ cluster_id: 'x', quarter: 'se', keepers: [], waiting: 0 }], friends, true).invites.length === 0,
     '§3 one cluster per keeper: an invite elsewhere is not shown to a member')
}
// §4 a full frame asks nobody
{
  const m = clusterMenu(view([['a', 'ne'], ['b', 'nw'], ['c', 'sw'], ['x', 'se']]), 'ne', [], friends, true)
  ok(m.nextOpen === null && m.askable.length === 0, '§4 four keepers: the frame is full')
}
// §5 ⛔ the guards, on the model's shape and on the panel's source.
{
  const m = clusterMenu(view([['a', 'ne'], ['b', 'nw']]), 'ne', [], friends, true)
  ok(!/leader|owner|founder|head|admin|host|folded/i.test(JSON.stringify(m)), '⛔ §5 no title anywhere in the model (not even who folded it)')
  const panel = readFileSync(join(__dirname, 'cluster-panel.tsx'), 'utf8')
  ok(!/remove|kick|evict|expel|\bban\b|transfer|folded_by|leader|owner|founder/i.test(panel.replace(/\/\/.*$/gm, '')), '⛔ §5 the panel has no verb against another keeper and shows no folder')
  ok(/action: 'takeBack'/.test(panel), '§5 the one exit is there — your own corner')
  ok(!/Vacant|\bTrust\b/.test(panel), '⛔ §5 canon-struck words stay out (Vacant, Trust)')
}

if (fails.length) { for (const f of fails) console.log('  FAIL ', f); console.log(`cluster-menu: ${pass} passed, ${fails.length} FAILED`); process.exit(1) }
console.log(`cluster-menu: ${pass}/0`)
