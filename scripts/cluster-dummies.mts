// Dummy cluster-mates for the owner's walk-through — cluster phase 3/4 dev tool (2026-09-23).
// Run from the repo root:
//   npx tsx scripts/cluster-dummies.mts up <you>     create 3 dummies, fold a cluster with <you> folding,
//                                                    two sign up, a third is ASKED (waiting on your yes)
//   npx tsx scripts/cluster-dummies.mts sign-up      the waiting dummy answers yes (after you say yes)
//   npx tsx scripts/cluster-dummies.mts down <you>   delete every dummy and take back <you>'s corner
//   npx tsx scripts/cluster-dummies.mts status <you>
//   npx tsx scripts/cluster-dummies.mts refresh      re-upload every signed-up dummy's garden (after a change here)
//
// ★ EVERYTHING GOES THROUGH THE REAL RECORD (lib/accounts/clusters.ts), so canon's guards hold for the
// dummies exactly as for people: friends only, everyone's yes, no title, the only exit your own corner.
// You FOLD it (folded_by = you) — that is a record of who raised the barn, never a lead: it grants you
// nothing, and there is no way to remove a dummy through the game. `down` is this script's own cleanup,
// by account deletion, the same path a real keeper's erasure takes.
//
// ⚠ Writes the LIVE accounts db (data/accounts.db). Dummies are `dummy_*` usernames on google subs
// `dummy-cluster-*` (never a real Google id), each friended to you and to each other.
// ★ Each dummy's garden is a NEW KEEPER'S (Alex, 2026-09-24: *"each player's plot should start out the
// same with the gate station being the only building"*): their gate station at zero waymarks, from the
// same stamp the world's court pass lays (`freshStation`), and nothing else. The first cut gave each a
// hut, which pictured a plot no keeper ever starts with. No dummy is ever in the world, so every
// dummy's station shows DORMANT — which is also the away state, seen without logging anyone out.
import {
  _openAt, upsertGoogleAccount, claimUsername, addFriend, acceptFriend, getAccountByUsername, deleteAccount,
} from '../src/lib/accounts/db'
import * as C from '../src/lib/accounts/clusters'
import { SECTION } from '../src/app/shimmer/voxel/column'
import { plotForTier } from '../src/app/shimmer/voxel/plot'
import { freshStation } from '../src/app/shimmer/voxel3d/court-blueprint'
import { buildSnapshot, readSnapshot } from '../src/app/shimmer/voxel/plot-snapshot'
import { GENERATOR_VERSION } from '../src/app/shimmer/voxel/edits'

// A dry run points at a copy: CLUSTER_DUMMIES_DB=/tmp/x.db
if (process.env.CLUSTER_DUMMIES_DB) _openAt(process.env.CLUSTER_DUMMIES_DB)

const DUMMIES = [
  { name: 'dummy_fern', quarter: 'nw' as const, seed: 4242, tier: 1 },
  { name: 'dummy_moss', quarter: 'sw' as const, seed: 7777, tier: 2 },
  { name: 'dummy_reed', quarter: 'se' as const, seed: 9001, tier: 0 },
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
 * A new keeper's garden: their gate station at zero waymarks, in their own PLOT cells — exactly where
 * the court pass would lay it on their solo plot, so the picture is the one their own client would
 * upload. Absolute cells, like every snapshot edit, so no baseline diff is needed. Lamps ride along.
 */
function stationSnapshot(seed: number, tier: number) {
  const fs = freshStation(seed, plotForTier(tier)) ?? die(`no station stands on seed ${seed} tier ${tier}`)
  const cols = new Map<string, Map<number, number>>()
  for (const c of fs!.cells) {
    const px = Math.floor(c.x / SECTION), pz = Math.floor(c.z / SECTION)
    const k = `${px},${pz}`
    if (!cols.has(k)) cols.set(k, new Map())
    cols.get(k)!.set((c.x - px * SECTION) + (c.z - pz * SECTION) * SECTION + c.y * SECTION * SECTION, c.m)
  }
  const snap = buildSnapshot([...cols].map(([k, m]) => {
    const [px, pz] = k.split(',').map(Number)
    return { px, pz, edits: { version: GENERATOR_VERSION, idx: Uint32Array.from(m.keys()), mat: Uint16Array.from(m.values()) } }
  }), fs!.lamps)
  if (!readSnapshot(JSON.stringify(snap))) die('built an invalid snapshot')
  return { snap, cells: fs!.cells.length }
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
  // Every dummy's garden is a new keeper's: the gate station and nothing else.
  DUMMIES.forEach((d, i) => {
    const { snap, cells } = stationSnapshot(d.seed, d.tier)
    // reed is not a member yet, so the server would refuse his upload (members only): it goes up at sign-up.
    if (i < 2) must(C.putPlotSnapshot(ids[i], JSON.stringify(snap)), `${d.name} uploads`)
    console.log(`  ${d.name}  ${d.quarter}  seed ${d.seed} tier ${d.tier}  station ${cells} cells`)
  })
  console.log(`✓ cluster ${cid}: ${youName} (ne, folded it) + fern (nw) + moss (sw); reed asked for se, waiting on ${youName}'s yes`)
  console.log('  → at the arch: Gardens → Cluster → Say yes under dummy_reed, then run: npx tsx scripts/cluster-dummies.mts sign-up')
} else if (cmd === 'sign-up') {
  const reed = getAccountByUsername(DUMMIES[2].name) ?? die('no dummy_reed — run up first')
  const inv = C.invitesFor(reed!.user_id)[0] ?? die('dummy_reed has no invite')
  if (inv!.waiting) die(`still waiting on ${inv!.waiting} yes — say yes in the Gardens menu first`)
  must(C.answerOffer(reed!.user_id, inv!.cluster_id, inv!.quarter, true, DUMMIES[2].seed, DUMMIES[2].tier), 'reed signs up')
  must(C.putPlotSnapshot(reed!.user_id, JSON.stringify(stationSnapshot(DUMMIES[2].seed, DUMMIES[2].tier).snap)), 'reed uploads')
  console.log('✓ dummy_reed signed up (se) — four keepers. /space cluster (or Walk the cluster) again to see his garden.')
} else if (cmd === 'refresh') {
  for (const d of DUMMIES) {
    const a = getAccountByUsername(d.name)
    if (!a || !C.myQuarter(a.user_id)) { console.log(`  ${d.name}: not in a cluster, skipped`); continue }
    const { snap, cells } = stationSnapshot(d.seed, d.tier)
    must(C.putPlotSnapshot(a.user_id, JSON.stringify(snap)), `${d.name} uploads`)
    console.log(`  ${d.name}  ${d.quarter}  station ${cells} cells, ${snap.lamps?.length ?? 0} lamps`)
  }
  console.log('✓ refreshed — walk back into your plot (or /space cluster) to see it')
} else if (cmd === 'down') {
  for (const d of DUMMIES) { const a = getAccountByUsername(d.name); if (a) { deleteAccount(a.user_id); console.log(`  deleted ${d.name}`) } }
  if (you && C.myQuarter(you.user_id)) { C.takeBackCorner(you.user_id); console.log(`  ${youName} took back their corner`) }
  console.log('✓ dummies gone')
} else if (cmd === 'status') {
  console.log(JSON.stringify({ cluster: you ? C.getCluster(you.user_id) : null,
    plots: you ? Object.keys(C.matePlotSnapshots(you.user_id)) : [] }, null, 2))
} else die('usage: up <you> | sign-up | down <you> | status <you>')

