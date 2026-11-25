// Run: npx tsx src/app/shimmer/open/ather/glade-nodes.test.ts
// BETA M153 s1b: tutorial nodes. Ids (a move and a republish keep them, never used twice), the wait, the keeper's own copy (a REAL keeper
// swap), out of mana halfway finishes, no second yield inside one wait, a node rolled back away leaves a working save, loot by place.
export {}
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const store = new Map<string, string>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as unknown as Record<string, any>, bus = new EventTarget()
g.window = g; g.addEventListener = bus.addEventListener.bind(bus); g.removeEventListener = bus.removeEventListener.bind(bus); g.dispatchEvent = bus.dispatchEvent.bind(bus)
g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)) }, removeItem: (k: string) => { store.delete(k) }, key: (i: number) => [...store.keys()][i] ?? null, get length() { return store.size } }
g.setInterval = (() => 0) as unknown
const get = (k: string) => JSON.parse(store.get(`u:alex:${k}`) ?? 'null')

async function main() {
  const { setSaveOwner } = await import('@/lib/save-slot'); setSaveOwner('alex')
  const R = await import('@/lib/keeper-roster'), reload = () => g.dispatchEvent(new CustomEvent(R.KEEPER_SWAP_EVENT))
  const B = await import('../../world/builder-props'), N = await import('./glade-nodes'), C = await import('./channel'), F = await import('./forestry'), P = await import('./prospecting')
  const L = await import('./ground-loot'), S = await import('./scenery'), K = await import('./keeper-nodes'), D = await import('./gather-dials')
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-6, H = 3_600_000
  type Prop = import('../../world/builder-props').Prop

  // ── the piece ─────────────────────────────────────────────────────────────────────────────────────────────────
  const T = 1_764_000_000_000
  let ps: Prop[] = B.addProp([], { k: 'tree:grove', x: 0, z: 0, q: 0, s: 1.5 })!
  ps = B.addProp(ps, { k: 'node:goldwood', x: 3, z: 4, q: 0.5, s: 1.7, solid: false }, T)!
  ps = B.addProp(ps, { k: 'node:raw', x: 6, z: 4, q: 1, s: 0.5, w: 6 }, T)!
  ok(ps[0].id === 'p1' && ps[1].id === `n${T.toString(36)}` && ps[2].id === `n${(T + 1).toString(36)}`, `ids ${ps.map(p => p.id)}`)
  ok(ps[1].s === 1 && ps[2].s === 1 && !('solid' in ps[1]) && ps[0].s === 1.5, 'a node is true size, no toggle; scenery keeps its size')
  ok(!('w' in ps[1]) && B.nodeWaitH(ps[1]) === 24 && B.nodeWaitH(ps[2]) === 6, '24 h unless said')
  ok(B.cleanProp({ ...ps[1], w: 0 })!.w === 1 && B.cleanProp({ ...ps[1], w: 1e9 })!.w === 168 && B.cleanProp({ ...ps[1], w: 'x' })!.w === undefined && B.cleanProp({ ...ps[0], w: 5 })!.w === undefined, 'the wait is bounded, and a node\'s only')
  ok(B.addProp(ps, { k: 'tree:pale', x: 1, z: 1, q: 0, s: 1 })!.at(-1)!.id === 'p2', 'scenery still counts up from p1')
  const moved = B.changeProp(ps, ps[1].id, { x: 9, z: -2 }); ok(moved[1].id === ps[1].id && moved[1].x === 9, 'M keeps the id')
  const picked = B.removeProp(ps, ps[1].id), back = B.addProp(picked, { ...ps[1], x: 20 }, T + 50)!
  ok(back.at(-1)!.id === ps[1].id, 'picked up and put down: the same node'); ok(B.addProp(back, { ...ps[1], x: 30 }, T + 60)!.at(-1)!.id !== ps[1].id, 'a second one is a new node')
  ok(B.addProp(picked, { k: 'node:goldwood', x: 3, z: 4, q: 0, s: 1 }, T + 99)!.at(-1)!.id !== ps[1].id, 'a deleted node\'s id is not used again')
  ok(JSON.stringify(B.cleanProps(JSON.parse(JSON.stringify({ props: ps })))) === JSON.stringify(ps), 'the list survives a save whole')
  ok(JSON.stringify(B.propsCanon(ps)) !== JSON.stringify(B.propsCanon(B.changeProp(ps, ps[1].id, { w: 8 }))), 'a changed wait is a change to save')
  ok(JSON.stringify(B.cleanProp({ id: 'p1', k: 'tree:grove', x: 1, z: 2, q: 0, s: 1 })) === '{"id":"p1","k":"tree:grove","x":1,"z":2,"q":0,"s":1}', 'a scenery piece is stored as it was')

  // ── in the game ───────────────────────────────────────────────────────────────────────────────────────────────
  const flat = (x: number) => (x > 100 ? NaN : 2)
  const W = N.gladeNodes([...ps, { id: 'nzz', k: 'node:egg', x: 1, z: 1, q: 0, s: 1 }, { id: 'nzy', k: 'node:nope', x: 1, z: 1, q: 0, s: 1 }, { id: 'nzx', k: 'node:raw', x: 500, z: 1, q: 0, s: 1 }], flat)
  ok(W.trees.length === 1 && W.crystals.length === 1, 'nodes only: no scenery, no unknown kind, no hidden crystal, none off the land')
  const tree = W.trees[0], cry = W.crystals[0]
  ok(tree.id === `glade:${ps[1].id}:goldwood` && cry.id === `glade:${ps[2].id}:raw` && tree.waitMs === 24 * H && cry.waitMs === 6 * H && tree.y === 2, 'id, wait, ground')
  ok(N.gladeNodes(moved, flat).trees[0].id === tree.id && N.gladeNodes(back, flat).trees[0].id === tree.id, 'moved or republished: the same id')
  ok(N.gladeNodes([{ ...ps[1], k: 'node:dawnwood' }], flat).trees[0].id !== tree.id, 'another kind is another node')
  ok(N.NODE_TREES.length === 4 && N.NODE_CRYSTALS.length === 7 && [...N.NODE_TREES, ...N.NODE_CRYSTALS].every(k => S.SCENERY_BY.get(`node:${k}`)?.group === 'Nodes'), 'all 4 trees and 7 crystals in the palette')
  ok(S.sceneryBoxes(S.sceneryPlaced([ps[1]], flat)).length === 1 && S.sceneryBoxes(S.sceneryPlaced([ps[2]], flat)).length === 0, 'the trunk blocks, the crystal does not (as in the Wilds)')
  ok(W.treesNear(3, 4, 5).length === 1 && W.treesNear(50, 4, 5).length === 0, 'near')

  // ── out of mana halfway, walked off, reloaded, hours later: it finishes; one yield a wait ─────────────────────────
  const now = Date.now(), d = D.TREE_DIAL.goldwood, plan = () => ({ drops: F.prunePlan('goldwood') })
  const w0 = C.beginWork('tree', tree.id, plan, tree.waitMs!, now), low = { cur: 2 }
  let st = ''; for (let i = 0; i < 50 && st !== 'dry'; i++) st = C.stepWork(w0, d, 1, 0.1, low, now)
  ok(st === 'dry' && near(w0.p, 2 / 5), `dry at ${w0.p}`); C.saveWork(now)
  ok(!!get('open.gladework.v1')?.[`tree:${tree.id}`] && !(get('open.gather.v1') ?? {})[`tree:${tree.id}`], 'saved in the keeper\'s key, not the garden\'s')
  reload(); const w1 = C.workOf('tree', tree.id, now + 20 * H)
  ok(!!w1 && near(w1.p, 0.4) && F.pruneCheck('goldwood', tree.id, now + 20 * H).ok, '20 hours and a reload later: still 40% done and open')
  ok(C.beginWork('tree', tree.id, () => { throw new Error('rolled twice') }, tree.waitMs!, now + 20 * H) === w1, 'taken up again: the same roll')
  const rich = { cur: 100 }; st = ''; for (let i = 0; i < 50 && st !== 'done'; i++) st = C.stepWork(w1!, d, 1, 0.1, rich, now + 20 * H)
  ok(st === 'done' && near(rich.cur, 97), 'the other 3 mana finish it')
  const fin = C.finishWork(w1!, now + 20 * H)!; F.pruneCommit('goldwood', tree.id, now + 20 * H, fin.until)
  ok(fin.until === now + 24 * H && C.finishWork(w1!, now + 20 * H) === null, 'paid once, grows back a wait after the first touch')
  reload(); ok(F.isPruned(tree.id, now + 24 * H - 1) && !F.isPruned(tree.id, now + 24 * H), 'spent till then, over a reload')
  ok(get('open.gladespent.v1')?.[tree.id] === fin.until && !(get('open.pruned.v1') ?? {})[tree.id], 'the keeper\'s key, not the garden\'s')
  // the hole: whatever is let go of and taken up, a wait pays once
  { let paid = 0; const id = 'glade:nhole:goldwood', t0 = now + 100 * H
    for (let t = t0; t < t0 + 72 * H; t += 600_000) { if (F.isPruned(id, t)) continue; const w = C.beginWork('tree', id, plan, 24 * H, t); C.stepWork(w, d, 1, 0.2, { cur: 100 }, t); C.saveWork(t); reload(); const v = C.workOf('tree', id, t); if (v && v.p >= 1) { const f = C.finishWork(v, t); if (f) { paid++; F.pruneCommit('goldwood', id, t, f.until) } } }
    ok(paid === 3, `3 days of every trick pay 3 times (${paid})`) }
  { const id = 'glade:nlate:goldwood', w = C.beginWork('tree', id, plan, 24 * H, now); w.p = 0.5
    ok(C.stepWork(w, d, 1, 0.1, { cur: 9 }, now + 24 * H) === 'reset' && !C.workOf('tree', id, now + 24 * H) && F.pruneCheck('goldwood', id, now + 24 * H).ok, 'left a whole wait: whole again, and open at once') }
  K.setSpent(tree.id, fin.until, now)   // the loop above ran past it
  // the words
  F.pruneCommit('goldwood', 'glade:nw:goldwood', now, now + 24 * H - 120_000); P.mineCommit('raw', 'glade:nc:raw', now, now + 24 * H)
  ok(JSON.stringify(F.pruneCheck('goldwood', 'glade:nw:goldwood', now)) === '{"ok":false,"why":"Goldwood, regrowing (23:58:00)."}', 'the wait in hours')
  ok(JSON.stringify(P.mineCheck('raw', 'glade:nc:raw', now)) === '{"ok":false,"why":"Raw Mana, growing back (24:00:00)."}', 'and the crystal\'s')
  ok(K.waitClock(599) === '9:59' && K.waitClock(59) === '0:59' && K.waitClock(3599) === '59:59' && K.waitClock(3600) === '1:00:00', 'under an hour reads as it did')

  // ── the Wilds' own records do not move ────────────────────────────────────────────────────────────────────────
  F.pruneCommit('goldwood', 'first-wilds:7', now); const wc = C.beginWork('crystal', 'first-wilds:c9', () => ({ drops: [] }), 120_000, now); ok(wc.p === 0, 'a Wilds crystal is begun')
  ok(!!get('open.pruned.v1')?.['first-wilds:7'] && !!get('open.gather.v1')?.['crystal:first-wilds:c9'] && Object.keys(get('open.gladespent.v1')).every((k: string) => k.startsWith('glade:')), 'the Wilds\' are the garden\'s still')

  // ── loot: by place, by keeper ─────────────────────────────────────────────────────────────────────────────────
  const spot = [{ x: 1, y: 2, z: 3 }]
  L.dropLoot('tree', tree.id, fin.until, [{ id: 'goldwood_log', n: 3 }], spot, now); L.dropLoot('tree', 'first-wilds:7', now + 180_000, [{ id: 'goldwood_log', n: 2 }], spot, now)
  ok(L.lootNow(now, 'glade').length === 3 && L.lootNow(now).length === 2, 'the Glade\'s lies in the Glade, the Wilds\' in the Wilds')
  ok(L.dropLoot('tree', tree.id, fin.until, [{ id: 'goldwood_log', n: 3 }], spot, now).length === 0, 'one cycle put down twice is one set')
  reload(); const one = L.lootNow(now, 'glade')[0]
  ok(L.claimLoot(one.id, 'keeper') && L.payLoot(one.id, 'keeper', () => 0, now)?.got === 1 && L.lootNow(now, 'glade').length === 2 && L.lootNow(now).length === 2, 'picked up out of the right list')

  // ── ANOTHER KEEPER of the same account: a fresh copy; the first keeper's is there when they come back ───────────────
  R.ensureRoster(); const k1 = R.readRoster()!.active, k2 = R.addKeeper()!
  ok(!!k2 && (R.readRoster()!.active === k2 || R.swapKeeper(k2)), 'a second keeper'); reload()
  ok(R.readRoster()!.active === k2 && !F.isPruned(tree.id, now) && !C.workOf('tree', tree.id, now) && L.lootNow(now, 'glade').length === 0, 'their copy is fresh: whole, unworked, nothing lying')
  ok(F.isPruned('first-wilds:7', now), '...and the Wilds\' tree is spent for both, as ever')
  F.pruneCommit('goldwood', tree.id, now, now + 23 * H); ok(F.isPruned(tree.id, now), 'they gather it')
  ok(R.swapKeeper(k1), 'back'); reload()
  ok(F.isPruned(tree.id, now) && K.spentUntil(tree.id) === fin.until && L.lootNow(now, 'glade').length === 2, 'the first keeper\'s own time and loot')

  // ── rolled back: no node, records left over ───────────────────────────────────────────────────────────────────────
  const none = N.gladeNodes([], flat); ok(none.trees.length === 0 && none.treesNear(0, 0, 99).length === 0, 'rolled back: nothing there')
  C.saveWork(now); reload(); ok(F.pruneCheck('goldwood', 'first-wilds:8', now).ok && L.lootNow(now, 'glade').length === 2, 'the save with old records loads and works')
  store.set('u:alex:open.gladespent.v1', '{"glade:n1:raw":"x","glade:n2:raw":null}'); store.set('u:alex:open.gladework.v1', '[1]'); store.set('u:alex:open.gladeloot.v1', '7'); reload()
  ok(!P.isMined('glade:n1:raw', now) && !C.workOf('crystal', 'glade:n1:raw', now) && L.lootNow(now, 'glade').length === 0, 'rubbish is a fresh copy')

  if (fails.length) { console.error(`glade-nodes: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
  console.log(`glade-nodes: ${pass}/0`); process.exit(0)
}
main()
