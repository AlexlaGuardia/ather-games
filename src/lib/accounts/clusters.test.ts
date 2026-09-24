// Cluster record oracle — run: npx tsx src/lib/accounts/clusters.test.ts
// The guards canon wrote against the landlord, asserted against a real sqlite file.
import { unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { _openAt, accountsDb, upsertGoogleAccount, claimUsername, addFriend, acceptFriend, deleteAccount } from './db'
import * as C from './clusters'

let failures = 0
const check = (label: string, ok: boolean, detail = '') => { if (!ok) { failures++; console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`) } }

const path = join(tmpdir(), `clusters-${process.pid}.db`)
_openAt(path)
const mk = (name: string) => { const a = upsertGoogleAccount(`g-${name}`, null, null); claimUsername(a.user_id, name); return a.user_id }
const friends = (a: string, b: string, bName: string) => { addFriend(a, bName); acceptFriend(b, a) }
const [alex, bo, cy, di, ed] = ['alex', 'bo_', 'cyn', 'dia', 'eddy'].map(mk)
friends(alex, bo, 'bo_'); friends(alex, cy, 'cyn'); friends(bo, cy, 'cyn'); friends(alex, di, 'dia')

// §1 folding takes Enchant; one cluster per keeper.
check('no Enchant, no fold', !C.foldCluster(alex, 'ne', false, 1, 0).ok)
const f = C.foldCluster(alex, 'ne', true, 1337, 2)
check('Enchant folds', f.ok && f.value.members.length === 1 && f.value.members[0].quarter === 'ne')
check('one cluster per keeper', !C.foldCluster(alex, 'sw', true, 1, 0).ok)
const cid = f.ok ? f.value.cluster_id : ''

// §2 offers: friends only, open quarter only.
check('a stranger cannot be offered', !C.offerQuarter(alex, 'eddy', 'sw').ok)
check('a taken quarter cannot be offered', !C.offerQuarter(alex, 'bo_', 'ne').ok)
check('a friend can', C.offerQuarter(alex, 'bo_', 'sw').ok)
check('one offer per quarter', !C.offerQuarter(alex, 'cyn', 'sw').ok)

// §3 ★ bo accepts: alex (the only member) offered, so the yes is complete.
const a1 = C.answerOffer(bo, cid, 'sw', true, 42, 1)
check('★ two keepers: the offer fills', a1.ok && a1.value?.members.length === 2)

// §4 ★★ EVERYONE'S YES: alex offers cyn; bo has not said yes, so cyn cannot fill it yet.
check('alex offers cyn', C.offerQuarter(alex, 'cyn', 'nw').ok)
{
  const inv = C.invitesFor(cy)
  check('★ the invitee sees who is in and how many yes are left', inv.length === 1 && inv[0].keepers.join() === 'alex,bo_' && inv[0].waiting === 1, JSON.stringify(inv))
  check('⛔ and nothing role-shaped', !/leader|owner|founder|head|admin|host|folded/i.test(JSON.stringify(Object.keys(inv[0]))))
  check('a keeper with no offer sees none', C.invitesFor(ed).length === 0)
}
const early = C.answerOffer(cy, cid, 'nw', true, 7, 0)
check('★★ you cannot give away someone else\'s corner — bo has not said yes', !early.ok && /Waiting on 1/.test(early.ok ? '' : early.error))
check('bo says yes', C.consentOffer(bo, 'nw').ok)
check('★ now cyn fills it', (() => { const r = C.answerOffer(cy, cid, 'nw', true, 7, 0); return r.ok && r.value?.members.length === 3 })())

// §5 a decline drops the offer; nobody else is touched.
C.offerQuarter(alex, 'dia', 'se')
check('dia declines', C.answerOffer(di, cid, 'se', false, 0, 0).ok)
check('the offer is gone, the members stand', (() => { const v = C.getCluster(alex)!; return v.offers.length === 0 && v.members.length === 3 })())

// §6 ⛔ GUARD 1: nobody can remove anyone. The module exports no such verb, and taking back your own
// corner touches only you.
const verbs = Object.keys(C).filter(k => typeof (C as Record<string, unknown>)[k] === 'function')
check('⛔ no export can remove another keeper', !verbs.some(v => /remove|kick|evict|expel|ban|transfer/i.test(v)), verbs.join(','))
check('bo takes back their corner', C.takeBackCorner(bo).ok)
check('★ only bo left — alex and cyn still stand', (() => { const v = C.getCluster(alex)!; return v.members.length === 2 && !v.members.some(m => m.user_id === bo) })())
check('the reopened quarter is simply open', C.getCluster(alex)!.members.every(m => m.quarter !== 'sw'))

// §7 ⛔ GUARDS 2+3: the view carries a record of who folded it and nothing role-shaped.
{
  const v = C.getCluster(cy)!
  const keys = JSON.stringify(Object.keys(v)) + JSON.stringify(Object.keys(v.members[0]))
  check('⛔ no title anywhere in the shape', !/leader|owner|founder|head|admin|host/i.test(keys), keys)
  check('folded_by is only a record', v.folded_by === alex)
}

// §8 reportFold updates only the reporter; erasure takes the corner back like the keeper could.
check('reportFold', C.reportFold(cy, 99, 2) && C.getCluster(alex)!.members.find(m => m.user_id === cy)?.tier === 2)
deleteAccount(cy)
check('★ erasure takes back the corner', C.getCluster(alex)!.members.length === 1)
C.takeBackCorner(alex)
check('a cluster with nobody in it is nothing', C.getCluster(alex) === null)
check('and a fresh fold is possible again', C.foldCluster(alex, 'se', true, 1, 0).ok)

// §9 ★ PLOT SNAPSHOTS: members only in, cluster-mates only out, and they leave with the corner.
{
  const sid = C.getCluster(alex)!.cluster_id
  check('★ a keeper outside a cluster uploads nothing', !C.putPlotSnapshot(ed, '{"v":1}').ok)
  check('alex (in) can', C.putPlotSnapshot(alex, '{"a":1}').ok)
  check('your own picture is not handed back to you as a mate', Object.keys(C.matePlotSnapshots(alex)).length === 0)
  check('bo is offered nw', C.offerQuarter(alex, 'bo_', 'nw').ok)
  check('bo joins', C.answerOffer(bo, sid, 'nw', true, 42, 1).ok)
  check('myQuarter', C.myQuarter(bo) === 'nw' && C.myQuarter(ed) === null)
  C.putPlotSnapshot(bo, '{"b":1}')
  check('★ alex sees bo\'s garden, in bo\'s quarter', C.matePlotSnapshots(alex).nw?.data === '{"b":1}')
  check('★ bo sees alex\'s', C.matePlotSnapshots(bo).se?.data === '{"a":1}')
  check('an overwrite replaces', C.putPlotSnapshot(bo, '{"b":2}').ok && C.matePlotSnapshots(alex).nw?.data === '{"b":2}')
  check('★★ a stranger reads nothing', Object.keys(C.matePlotSnapshots(ed)).length === 0)
  C.takeBackCorner(bo)
  check('★★ taking back your corner takes your garden with you', !C.matePlotSnapshots(alex).nw)
  check('and a former member reads nothing', Object.keys(C.matePlotSnapshots(bo)).length === 0)
  const rows = () => (accountsDb().prepare('SELECT COUNT(*) AS n FROM cluster_plots').get() as { n: number }).n
  check('bo\'s row is gone from the store', rows() === 1)
  deleteAccount(alex)
  check('★ erasure takes the picture too', rows() === 0)
}

// §AWAKE — the once-a-minute ping (2026-09-24). A lamp's business only; it never touches the record's ground.
{
  const [fay, gus, hal] = ['fay', 'gus', 'hal'].map(mk)
  friends(fay, gus, 'gus'); friends(fay, hal, 'hal')
  const fc = C.foldCluster(fay, 'ne', true, 5, 0)
  C.offerQuarter(fay, 'gus', 'sw'); C.answerOffer(gus, fc.ok ? fc.value.cluster_id : '', 'sw', true, 6, 0)
  const T = 1_000_000_000
  check('outside a cluster the ping answers null', C.markHere(hal, T) === null)
  const first = C.markHere(fay, T)
  check('a mate who never pinged is AWAY', first?.sw === false, JSON.stringify(first))
  check('the reply never names me', first !== null && !('ne' in first!))
  C.markHere(gus, T + 10_000)
  check('a mate who just pinged is awake', C.markHere(fay, T + 20_000)?.sw === true)
  check('still awake at the edge of the window', C.markHere(fay, T + 10_000 + C.AWAKE_MS)?.sw === true)
  check('★ away one tick past it', C.markHere(fay, T + 10_001 + C.AWAKE_MS)?.sw === false)
  const before = JSON.stringify(C.getCluster(fay))
  C.markHere(gus, T + 99_000_000)
  check('★ pinging changes nothing in the cluster record (folded once, holds)', JSON.stringify(C.getCluster(fay)) === before)
  C.takeBackCorner(gus)
  check('the seen row leaves with the corner', !accountsDb().prepare('SELECT 1 FROM cluster_seen WHERE user_id = ?').get(gus))
  C.markHere(fay, T); deleteAccount(fay)
  check('and with the account', !accountsDb().prepare('SELECT 1 FROM cluster_seen WHERE user_id = ?').get(fay))
}

try { unlinkSync(path) } catch { /* */ }
console.log(failures ? `❌ clusters: ${failures} failed` : '✅ clusters: all passed')
if (failures) process.exit(1)
