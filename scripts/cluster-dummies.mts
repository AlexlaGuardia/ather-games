// Dummy cluster-mates for the owner's walk-through — cluster phase 3/4 dev tool (2026-09-23).
// Run from the repo root:
//   npx tsx scripts/cluster-dummies.mts up <you>     create 3 dummies, fold a cluster with <you> folding,
//                                                    two sign up, a third is ASKED (waiting on your yes)
//   npx tsx scripts/cluster-dummies.mts sign-up      the waiting dummy answers yes (after you say yes)
//   npx tsx scripts/cluster-dummies.mts down <you>   delete every dummy and take back <you>'s corner
//   npx tsx scripts/cluster-dummies.mts status <you>
//
// ★ EVERYTHING GOES THROUGH THE REAL RECORD (lib/accounts/clusters.ts), so canon's guards hold for the
// dummies exactly as for people: friends only, everyone's yes, no title, the only exit your own corner.
// You FOLD it (folded_by = you) — that is a record of who raised the barn, never a lead: it grants you
// nothing, and there is no way to remove a dummy through the game. `down` is this script's own cleanup,
// by account deletion, the same path a real keeper's erasure takes.
//
// ⚠ Writes the LIVE accounts db (data/accounts.db). Dummies are `dummy_*` usernames on google subs
// `dummy-cluster-*` (never a real Google id), each friended to you and to each other. Each gets a
// small hut in their garden as a plot snapshot, so their quarter shows a build, read-only.
import {
  _openAt, upsertGoogleAccount, claimUsername, addFriend, acceptFriend, getAccountByUsername, deleteAccount,
} from '../src/lib/accounts/db'
import * as C from '../src/lib/accounts/clusters'
import { DEFAULT_CLUSTER, NO_SLOTS, type ClusterConfig, type QuarterId } from '../src/app/shimmer/voxel/cluster'
import { clusterHeight } from '../src/app/shimmer/voxel/cluster-column'
import { quarterCentre } from '../src/app/shimmer/voxel/cluster'
import { SECTION } from '../src/app/shimmer/voxel/column'
import { MAT } from '../src/app/shimmer/voxel/depth'
import { buildSnapshot, readSnapshot } from '../src/app/shimmer/voxel/plot-snapshot'
import { GENERATOR_VERSION } from '../src/app/shimmer/voxel/edits'

// A dry run points at a copy: CLUSTER_DUMMIES_DB=/tmp/x.db
if (process.env.CLUSTER_DUMMIES_DB) _openAt(process.env.CLUSTER_DUMMIES_DB)

const DUMMIES = [
  { name: 'dummy_fern', quarter: 'nw' as const, seed: 4242, tier: 1, plank: MAT.PLANKS_SHIMMEROAK },
  { name: 'dummy_moss', quarter: 'sw' as const, seed: 7777, tier: 2, plank: MAT.PLANKS_DAWNWOOD },
  { name: 'dummy_reed', quarter: 'se' as const, seed: 9001, tier: 0, plank: MAT.PLANKS_GOLDWOOD },
]
const SUB = (n: string) => `dummy-cluster-${n}`
const die = (m: string): never => { console.error(`✗ ${m}`); process.exit(1) }
const must = <T,>(r: { ok: true; value: T } | { ok: false; error: string }, what: string): T => r.ok ? r.value : die(`${what}: ${r.error}`)

function account(name: string): string {
  const a = upsertGoogleAccount(SUB(name), null, null)
  if (!a.username) { const c = claimUsername(a.user_id, name); if (!c.ok) die(`claim ${name}: ${JSON.stringify(c)}`) }
  return a.user_id
}
function befriend(aId: string, bId: string, bName: string) {
  const r = addFriend(aId, bName)
  if (r.ok || /already/i.test((r as { error?: string }).error ?? '')) acceptFriend(bId, aId)
}

/**
 * A 5×5 hut in plot-local space, standing on the ground this quarter really generates (read off the
 * cluster, not the solo plot, so it can neither float nor bury). Foundation fills down to the ground.
 */
function hutSnapshot(q: QuarterId, cfg: ClusterConfig, plank: number) {
  const c = quarterCentre(q, cfg)
  const x0 = 10, z0 = 10, W = 5
  const ground = (x: number, z: number) => clusterHeight(x + c.x, z + c.z, cfg)
  let h = -Infinity
  for (let x = x0 - 1; x < x0 + W + 1; x++) for (let z = z0 - 1; z < z0 + W + 1; z++) {
    const g = ground(x, z); if (g === null) die(`hut site off the ground in ${q}`); h = Math.max(h, g!)
  }
  const cols = new Map<string, Map<number, number>>()
  const put = (x: number, y: number, z: number, m: number) => {
    const px = Math.floor(x / SECTION), pz = Math.floor(z / SECTION)
    const k = `${px},${pz}`
    if (!cols.has(k)) cols.set(k, new Map())
    cols.get(k)!.set((x - px * SECTION) + (z - pz * SECTION) * SECTION + y * SECTION * SECTION, m)
  }
  for (let x = x0; x < x0 + W; x++) for (let z = z0; z < z0 + W; z++) {
    for (let y = ground(x, z)! + 1; y < h; y++) put(x, y, z, MAT.COBBLESTONE)
    put(x, h, z, plank)
    const edge = x === x0 || x === x0 + W - 1 || z === z0 || z === z0 + W - 1
    for (let y = h + 1; y <= h + 3; y++) {
      const door = z === z0 && x === x0 + 2 && y <= h + 2
      const window = x === x0 && z === z0 + 2 && y === h + 2
      put(x, y, z, !edge || door ? 0 : window ? MAT.GLASS : plank)
    }
  }
  for (let x = x0 - 1; x <= x0 + W; x++) for (let z = z0 - 1; z <= z0 + W; z++) put(x, h + 4, z, MAT.THATCH)
  put(x0 + 1, h + 1, z0 + 3, MAT.MANA_LANTERN)
  const snap = buildSnapshot([...cols].map(([k, m]) => {
    const [px, pz] = k.split(',').map(Number)
    return { px, pz, edits: { version: GENERATOR_VERSION, idx: Uint32Array.from(m.keys()), mat: Uint16Array.from(m.values()) } }
  }))
  if (!readSnapshot(JSON.stringify(snap))) die('built an invalid snapshot')
  return { snap, floor: h }
}

const [cmd, youName] = process.argv.slice(2)
const you = youName ? getAccountByUsername(youName) : null

if (cmd === 'up') {
  if (!you) die('usage: up <your username>')
  if (C.myQuarter(you!.user_id)) die(`${youName} already stands in a cluster — run down first`)
  const ids = DUMMIES.map(d => account(d.name))
  for (let i = 0; i < DUMMIES.length; i++) {
    befriend(you!.user_id, ids[i], DUMMIES[i].name)
    for (let j = 0; j < i; j++) befriend(ids[j], ids[i], DUMMIES[i].name)
  }
  // You fold (NE). Canon: folding takes Enchant — the server takes the client's word, and here the
  // script is that client. Your own seed/tier is overwritten by your game's report on your next open.
  const view = must(C.foldCluster(you!.user_id, 'ne', true, 1337, 0), 'fold')
  const cid = view.cluster_id
  const [fern, moss] = ids
  must(C.offerQuarter(you!.user_id, DUMMIES[0].name, 'nw'), 'ask fern')
  must(C.answerOffer(fern, cid, 'nw', true, DUMMIES[0].seed, DUMMIES[0].tier), 'fern signs up')
  must(C.offerQuarter(you!.user_id, DUMMIES[1].name, 'sw'), 'ask moss')
  must(C.consentOffer(fern, 'sw'), 'fern says yes to moss')
  must(C.answerOffer(moss, cid, 'sw', true, DUMMIES[1].seed, DUMMIES[1].tier), 'moss signs up')
  // The third is asked by FERN, so the offer waits on YOUR yes — which is how you test Say yes.
  must(C.offerQuarter(fern, DUMMIES[2].name, 'se'), 'fern asks reed')
  must(C.consentOffer(moss, 'se'), 'moss says yes to reed')
  // Every dummy's garden gets its hut, laid on the ground their quarter really generates.
  const cfg: ClusterConfig = { ...DEFAULT_CLUSTER, slots: { ...NO_SLOTS, ne: { seed: 1337, tier: 0 },
    nw: { seed: DUMMIES[0].seed, tier: DUMMIES[0].tier }, sw: { seed: DUMMIES[1].seed, tier: DUMMIES[1].tier },
    se: { seed: DUMMIES[2].seed, tier: DUMMIES[2].tier } } }
  DUMMIES.forEach((d, i) => {
    const { snap, floor } = hutSnapshot(d.quarter, cfg, d.plank)
    // reed is not a member yet, so the server would refuse his upload (members only): it goes up at sign-up.
    if (i < 2) must(C.putPlotSnapshot(ids[i], JSON.stringify(snap)), `${d.name} uploads`)
    console.log(`  ${d.name}  ${d.quarter}  seed ${d.seed} tier ${d.tier}  hut floor y=${floor}`)
  })
  console.log(`✓ cluster ${cid}: ${youName} (ne, folded it) + fern (nw) + moss (sw); reed asked for se, waiting on ${youName}'s yes`)
  console.log('  → at the arch: Gardens → Cluster → Say yes under dummy_reed, then run: npx tsx scripts/cluster-dummies.mts sign-up')
} else if (cmd === 'sign-up') {
  const reed = getAccountByUsername(DUMMIES[2].name) ?? die('no dummy_reed — run up first')
  const inv = C.invitesFor(reed!.user_id)[0] ?? die('dummy_reed has no invite')
  if (inv!.waiting) die(`still waiting on ${inv!.waiting} yes — say yes in the Gardens menu first`)
  must(C.answerOffer(reed!.user_id, inv!.cluster_id, inv!.quarter, true, DUMMIES[2].seed, DUMMIES[2].tier), 'reed signs up')
  const v = C.getCluster(reed!.user_id)!
  const cfg: ClusterConfig = { ...DEFAULT_CLUSTER, slots: { ...NO_SLOTS } }
  for (const m of v.members) cfg.slots[m.quarter] = { seed: m.seed, tier: m.tier }
  must(C.putPlotSnapshot(reed!.user_id, JSON.stringify(hutSnapshot('se', cfg, DUMMIES[2].plank).snap)), 'reed uploads')
  console.log('✓ dummy_reed signed up (se) — four keepers. /space cluster (or Walk the cluster) again to see his garden.')
} else if (cmd === 'down') {
  for (const d of DUMMIES) { const a = getAccountByUsername(d.name); if (a) { deleteAccount(a.user_id); console.log(`  deleted ${d.name}`) } }
  if (you && C.myQuarter(you.user_id)) { C.takeBackCorner(you.user_id); console.log(`  ${youName} took back their corner`) }
  console.log('✓ dummies gone')
} else if (cmd === 'status') {
  console.log(JSON.stringify({ cluster: you ? C.getCluster(you.user_id) : null,
    plots: you ? Object.keys(C.matePlotSnapshots(you.user_id)) : [] }, null, 2))
} else die('usage: up <you> | sign-up | down <you> | status <you>')

