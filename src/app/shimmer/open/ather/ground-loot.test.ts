// Run: npx tsx src/app/shimmer/open/ather/ground-loot.test.ts
// M141 s1 GROUND LOOT: no loss and no double across a reload, a keeper swap, a zone change (claims), a full and half-full bag, the
// node's reset and a second tab; one drop = one claim (s2); spots on foot only, synthetic land and the real start tile.
export {}
import { readFileSync } from 'node:fs'
let pass = 0
const fails: string[] = []
const ok = (c: unknown, m: string) => { if (c) pass++; else fails.push(m) }
const store = new Map<string, string>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as unknown as Record<string, any>, bus = new EventTarget()
let quota = false
g.window = g; g.addEventListener = bus.addEventListener.bind(bus); g.removeEventListener = bus.removeEventListener.bind(bus); g.dispatchEvent = bus.dispatchEvent.bind(bus)
g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { if (quota) throw new Error('quota'); store.set(k, String(v)) }, removeItem: (k: string) => { store.delete(k) }, key: (i: number) => [...store.keys()][i] ?? null, get length() { return store.size } }
g.setInterval = (() => 0) as unknown
const KEY = 'u:alex:open.loot.v1'

async function main() {
  const { setSaveOwner } = await import('@/lib/save-slot'); setSaveOwner('alex')
  const { KEEPER_SWAP_EVENT } = await import('@/lib/keeper-roster')
  const reload = () => g.dispatchEvent(new CustomEvent(KEEPER_SWAP_EVENT))
  const L = await import('./ground-loot'), C = await import('./channel'), F = await import('./forestry'), D = await import('./gather-dials')
  const I = await import('../shared/inventory'), { GARDEN_KEY_SPECS } = await import('@/lib/keeper-key-specs')
  const T0 = Date.now(), at = { x: 5, y: 2, z: 5 }, spots = [at, { x: 6, y: 2, z: 5 }]
  const sum = (id?: string) => L.lootNow(T0 + 1).reduce((a, d) => a + (!id || d.item === id ? d.n : 0), 0)
  ok(GARDEN_KEY_SPECS.some(k => k.base === 'open.loot.v1'), 'not a garden key'); ok(L.LOOT_LIFE_MS >= 10 * 60_000, 'life under 10 minutes'); ok(L.LOOT_PULL_M === 2, 'pull dial')
  ok(readFileSync(new URL('./combat.ts', import.meta.url), 'utf8').includes('MAGNET_R = 4.5'), 'grey matter\'s magnet moved')

  // piles
  for (const n of [1, 2, 3, 4, 7, 10]) { const p = L.pilesOf([{ id: 'a', n }]); ok(p.reduce((a, s) => a + s.n, 0) === n && p.length === Math.min(3, n) && p.every(s => s.n > 0), `piles of ${n}`) }
  ok(L.pilesOf([{ id: 'a', n: 0 }]).length === 0, 'a pile of nothing')

  // the M136 yield, once a cycle, saved
  const w = C.beginWork('tree', 't1', () => ({ drops: [{ id: 'goldwood_log', n: 4 }, { id: 'mast', n: 1 }] }), 60_000, T0); w.p = 1
  const fin = C.finishWork(w, T0)!; L.dropLoot('tree', 't1', fin.until, w.drops, spots, T0)
  ok(sum() === 5 && sum('goldwood_log') === 4, 'yield on the ground'); L.dropLoot('tree', 't1', fin.until, w.drops, spots, T0); ok(sum() === 5, 'the same cycle put down twice doubled')
  ok(C.finishWork(w, T0) === null, 'work paid twice')
  reload(); ok(sum() === 5 && L.lootNow(T0 + 1).every(d => d.at === T0 && d.y === 2), 'a reload lost or moved a drop'); ok(JSON.parse(store.get(KEY)!).v === 1, 'saved record')
  // the next cycle is another set; the reset takes nothing
  F._resetForestry(); F.pruneCommit('goldwood', 't1', T0, fin.until); C.saveWork(T0 + 120_000)
  ok(!F.isPruned('t1', fin.until + 1) && L.lootNow(fin.until + 1).length === 4, 'the node\'s reset took its loot')
  L.dropLoot('tree', 't1', fin.until + 1, [{ id: 'goldwood_log', n: 2 }], spots, T0); ok(sum('goldwood_log') === 6, 'the next cycle did not drop'); L._resetLoot()

  // one drop = one claim
  const put = (id: string, n = 2, item = 'goldwood_log', t = T0) => L.dropLoot('tree', id, 9, [{ id: item, n }], [at], t)
  const [a, b] = put('c1')
  ok(L.claimLoot(a.id, 'keeper') && L.claimLoot(a.id, 'keeper') && !L.claimLoot(a.id, 'spirit:1'), 'two hold one drop'); L.releaseLoot(a.id, 'spirit:1'); ok(L.holderOf(a.id) === 'keeper', 'another\'s release let go')
  ok(L.payLoot(a.id, 'spirit:1', () => 0, T0) === null && sum() === 2, 'paid to one who does not hold it')
  ok(L.claimLoot(b.id, 'spirit:1') && L.payLoot(b.id, 'keeper', () => 0, T0) === null, 'a held drop paid to another')
  reload(); ok(sum() === 2 && L.holderOf(a.id) === undefined, 'mid-flight reload: lost, or still held'); ok(!L.claimLoot('nope', 'keeper'), 'a claim on nothing')
  ok(L.claimLoot(a.id, 'keeper'), 'a claim after a reload'); L.releaseLoot(a.id, 'keeper'); ok(sum() === 2 && L.claimLoot(a.id, 'spirit:1'), 'let go: not free again'); L.releaseLoot(a.id, 'spirit:1')
  // pay, once
  let inv = I.newInv(0); const bag = (item: string, n: number) => { const r = I.give(inv, item, n); inv = r.inv; return r.left }
  const n0 = I.countOf(inv, 'goldwood_log')
  ok(L.payLoot(a.id, 'keeper', bag, T0)?.got === 1 && L.payLoot(a.id, 'keeper', bag, T0) === null && I.countOf(inv, 'goldwood_log') === n0 + 1 && sum() === 1, 'paid twice, or not at all')
  reload(); ok(sum() === 1, 'a paid drop came back on a reload')
  // a second tab paid the last one: this tab's memory is stale
  L.lootNow(T0 + 1); store.set(KEY, JSON.stringify({ v: 1, drops: [] })); ok(L.payLoot(b.id, 'keeper', bag, T0) === null && I.countOf(inv, 'goldwood_log') === n0 + 1, 'two tabs paid one drop')
  // ...and one put down there is not wiped by ours
  store.set(KEY, JSON.stringify({ v: 1, drops: [{ id: 'z', item: 'mast', n: 1, ...at, at: T0 }] })); put('c2', 1); ok(sum() === 2 && JSON.parse(store.get(KEY)!).drops.length === 2, 'a drop of the other tab was wiped'); L._resetLoot(); store.delete(KEY)
  // a save that cannot be written: still paid once
  put('c3', 1); quota = true; ok(L.payLoot('tree:c3:9:0', 'keeper', bag, T0)?.got === 1 && L.payLoot('tree:c3:9:0', 'keeper', bag, T0) === null, 'no room to save: paid twice'); quota = false; L._resetLoot(); store.delete(KEY); reload()

  // full, and half full
  const st = I.itemDef('goldwood_log').stack, slots = Array.from({ length: I.SLOTS }, () => ({ id: 'waymark', n: I.itemDef('waymark').stack }))
  inv = { v: 1, slots } as import('../shared/inventory').Inv
  const [f1] = L.dropLoot('tree', 'full', 9, [{ id: 'goldwood_log', n: 9 }], [at], T0)   // piles of 3
  L.claimLoot(f1.id, 'keeper'); const before = store.get(KEY); ok(L.payLoot(f1.id, 'keeper', bag, T0)?.got === 0 && sum() === 9 && store.get(KEY) === before && L.holderOf(f1.id) === undefined, 'full bag: something moved')
  inv.slots[0] = { id: 'goldwood_log', n: st - 2 }
  const part = L.payLoot(f1.id, 'keeper', bag, T0); ok(part?.got === 2 && part.left === 1 && sum() === 7 && I.countOf(inv, 'goldwood_log') === st, 'half full: not exactly what fits'); reload(); ok(sum() === 7, 'half full: the rest did not survive a reload'); L._resetLoot(); store.delete(KEY); reload()

  // time: nothing goes early, everything goes at the end
  put('old', 1, 'mast', T0); ok(L.lootNow(T0 + 10 * 60_000).length === 1 && L.lootNow(T0 + L.LOOT_LIFE_MS - 1).length === 1 && L.claimLoot('tree:old:9:0', 'keeper'), 'gone early')
  ok(L.payLoot('tree:old:9:0', 'keeper', bag, T0 + L.LOOT_LIFE_MS) === null && L.lootNow(T0 + L.LOOT_LIFE_MS).length === 0 && L.holderOf('tree:old:9:0') === undefined, 'never goes'); reload(); ok(L.lootNow(T0).length === 0, 'came back')
  put('skew', 1, 'mast', T0 + 999_999); ok(L.lootNow(T0).length === 1, 'a clock set back took loot'); L._resetLoot()
  // rubbish rows
  store.set(KEY, JSON.stringify({ v: 1, drops: [{ id: 'g', item: 'mast', n: 1, ...at, at: T0 }, { id: 'g', item: 'mast', n: 1, ...at, at: T0 }, { id: 'q', n: -4 }, null, 7] })); reload(); ok(L.lootNow(T0).length === 1, 'rubbish kept, a twin kept, or the good row lost')
  store.set(KEY, 'not json'); reload(); ok(L.lootNow(T0).length === 0, 'rubbish save'); L._resetLoot(); store.delete(KEY)

  // pull
  const d = { id: 'p', item: 'mast', n: 1, ...at, at: T0 }, f = (dx: number, dy = 0) => ({ x: at.x + dx, y: at.y + dy, z: at.z }), t = T0 + 5000
  ok(L.inPull(d, f(1.99), t) && !L.inPull(d, f(2.01), t) && !L.inPull(d, f(0, 3), t) && !L.inPull(d, f(0), T0 + 100), 'pull: 2 m, not up a cliff, not mid-fall')

  // spots, synthetic
  const flat = () => 0, rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }; let seed = 7
  const trunk = (x: number, z: number) => Math.hypot(x, z) > 0.8, feet = { x: 6, y: 0, z: 0 }
  { const s = L.lootSpots({ x: 0, z: 0 }, feet, 5, trunk, flat, rnd); ok(s.length === 5 && s.every(p => { const r = Math.hypot(p.x, p.z); return r >= 0.9 && r <= 2.6 && trunk(p.x, p.z) }) && new Set(s.map(p => `${p.x},${p.z}`)).size === 5, `spots: not five places beside it ${JSON.stringify(s)}`) }
  { // a pit all round the node but a 2 m neck on the far (west) side that cannot be reached: the keeper's side of the pit
    const pit = (x: number, z: number) => Math.hypot(x, z) > 4; const s = L.lootSpots({ x: 0, z: 0 }, feet, 4, pit, flat, rnd)
    ok(s.every(p => pit(p.x, p.z) && Math.hypot(p.x, p.z) < 6), 'a node over a pit: not the nearest ground') }
  { // an island: good ground beside the node, a moat between
    const isle = (x: number, z: number) => { const r = Math.hypot(x, z); return (r > 0.8 && r < 2.6) || r > 4 }; const s = L.lootSpots({ x: 0, z: 0 }, feet, 4, isle, flat, rnd)
    ok(s.every(p => Math.hypot(p.x, p.z) > 4), 'dropped where the keeper cannot walk') }
  { // a shelf 3 m up
    const h = (x: number) => (x < 3 ? 3 : 0); const s = L.lootSpots({ x: 0, z: 0 }, feet, 4, trunk, h, rnd); ok(s.every(p => p.x >= 3 && p.y === 0), 'dropped up a cliff') }
  { // a 40 degree slope: level with the node, not up and down it
    const s = L.lootSpots({ x: 0, z: 0, y: 0 }, feet, 5, trunk, x => x * 0.84, rnd); ok(s.every(p => Math.abs(p.y) <= 0.8 && Math.hypot(p.x, p.z) <= 2.6), 'slope: scattered up and down it') }
  { const s = L.lootSpots({ x: 0, z: 0 }, feet, 4, () => false, flat, rnd); ok(s.length === 1 && s[0].x === feet.x, 'nowhere: not at the keeper\'s feet') }
  { const s = L.lootSpots({ x: 0, z: 0 }, { x: 4.4, y: 0, z: 0 }, 3, (x, z) => trunk(x, z) && Math.hypot(x - 4.4, z) > 0.4, flat, rnd); ok(s.every(p => Math.hypot(p.x, p.z) <= 2.6), 'standing half over an edge: gave up') }

  // spots, the real start tile with its voids and paths: every finished node, worked from 8 m out
  const { W, V } = await import('../../../../../scripts/lib/' + 'lone-tree.mts') as unknown as { W: import('./wilds').Wilds; V: { weight(x: number, z: number): number } }
  const { walkableIn } = await import('./wilds'), { FALL_LIP } = await import('./wilds-voids')
  const free = (x: number, z: number) => walkableIn(W, x, z, 0.35) && V.weight(x, z) < FALL_LIP / 2 && W.heightAt(x, z) > W.meta.waterY
  let seenN = 0, bad = 0, beside = 0
  for (const n of [...W.trees.filter((_, i) => i % 11 === 0), ...W.crystals.filter((_, i) => i % 3 === 0)]) {
    const k = [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ x: n.x + Math.cos(i * 0.785) * 8, z: n.z + Math.sin(i * 0.785) * 8 })).find(p => free(p.x, p.z)); if (!k) continue
    const s = L.lootSpots(n, { x: k.x, y: W.heightAt(k.x, k.z), z: k.z }, 4, free, (x, z) => W.heightAt(x, z), rnd); seenN++
    if (s.some(p => !free(p.x, p.z))) bad++
    if (s.every(p => Math.hypot(p.x - n.x, p.z - n.z) <= 2.7)) beside++
  }
  ok(seenN > 100 && bad === 0, `real tile: ${bad} of ${seenN} nodes dropped in a pit, a trunk or the water`); ok(beside / seenN > 0.9, `real tile: only ${beside} of ${seenN} beside the node`)
  void D
  // the page: the one place that pays a node
  const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8')
  ok((page.match(/dropLoot\(/g) ?? []).length === 1 && /finishWork\(ch\.w\); if \(!fin\) \{ stopChannel\(\); return \}[\s\S]{0,1400}dropLoot\(ch\.node, ch\.w\.id, fin\.until/.test(page), 'the page drops without finishWork')
  if (fails.length) { console.error(`ground-loot: ${pass} pass, ${fails.length} FAIL`); for (const x of fails) console.error('  ✗ ' + x); process.exit(1) }
  console.log(`ground-loot: ${pass}/0 (real tile: ${beside}/${seenN} beside)`); process.exit(0)
}
main()
