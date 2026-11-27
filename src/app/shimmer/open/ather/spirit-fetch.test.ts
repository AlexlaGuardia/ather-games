// Run: npx tsx src/app/shimmer/open/ather/spirit-fetch.test.ts
// M141 s2 SPIRITS FETCH: with and without a spirit, two spirits never take one drop, called off / reload / zone change mid-fetch
// never loses or doubles an item (s1's save + claims), a Hollow about or a fight = she stays, never faster than walking, the
// species table (one row each, Alex's OK'd manners), and the follow walk asks her fetch before her skit.
export {}
import { readFileSync } from 'node:fs'
let pass = 0
const fails: string[] = []
const ok = (c: unknown, m: string) => { if (c) pass++; else fails.push(m) }
const store = new Map<string, string>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as unknown as Record<string, any>, bus = new EventTarget()
g.window = g; g.addEventListener = bus.addEventListener.bind(bus); g.removeEventListener = bus.removeEventListener.bind(bus); g.dispatchEvent = bus.dispatchEvent.bind(bus)
g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)) }, removeItem: (k: string) => { store.delete(k) }, key: (i: number) => [...store.keys()][i] ?? null, get length() { return store.size } }
g.setInterval = (() => 0) as unknown

async function main() {
  const { setSaveOwner } = await import('@/lib/save-slot'); setSaveOwner('alex')
  const { KEEPER_SWAP_EVENT } = await import('@/lib/keeper-roster')
  const reload = () => g.dispatchEvent(new CustomEvent(KEEPER_SWAP_EVENT))
  const L = await import('./ground-loot'), S = await import('./spirit-fetch'), I = await import('../shared/inventory')
  type Spot = { x: number; y: number; z: number }
  const T0 = Date.now() - 60_000, K: Spot = { x: 0, y: 0, z: 0 }
  let inv = I.newInv(0)
  const bag = (item: string, n: number) => { const r = I.give(inv, item, n); inv = r.inv; return r.left }
  const count = (id = 'goldwood_log') => I.countOf(inv, id)
  const sum = (id = 'goldwood_log') => L.lootNow(T0 + 5000).reduce((a, d) => a + (d.item === id ? d.n : 0), 0)
  /** one drop (a pile of one: dropLoot splits n over up to 3 piles) */
  const put = (node: string, at: Spot, _n = 1, item = 'goldwood_log', t = T0) => L.dropLoot('tree', node, 9, [{ id: item, n: 1 }], [at], t)[0]
  const pos = new Map<string, Spot>()
  let hollow = false, fight = new Set<string>(), can = true, full = false, now = T0 + 5000, vSeen = 0
  const tick = (dt = 0.05) => S.tickFetch({ now, dt, keeper: K, loot: L.lootNow(now), at: id => pos.get(id) ?? null, hollow, fighting: id => fight.has(id), can,
    fits: () => !full, keeperTakes: d => L.inPull(d, K, now), pay: (id, who) => { L.payLoot(id, who, bag, now) } })
  /** her follow walk: toward her fetch slot (else her place beside the keeper) at no more than the slot's vMax */
  const walk = (id: string, dt = 0.05) => {
    const p = pos.get(id)!, s = S.fetchSlot(id) ?? { x: K.x + 1.7, z: K.z, vMax: 9 }
    const d = Math.hypot(s.x - p.x, s.z - p.z), st = Math.min(d, s.vMax * dt); vSeen = Math.max(vSeen, S.fetchSlot(id)?.vMax ?? 0)
    if (d > 1e-6) pos.set(id, { x: p.x + (s.x - p.x) / d * st, y: p.y, z: p.z + (s.z - p.z) / d * st })
  }
  const run = (ids: string[], secs: number, until?: () => boolean) => { for (let t = 0; t < secs && !until?.(); t += 0.05) { now += 50; tick(); ids.forEach(id => walk(id)) } }
  const phase = (id: string) => S.fetchState().find(r => r.id === id)?.phase ?? null
  const fresh = () => { S._resetFetch(); L._resetLoot(); inv = I.newInv(0); pos.clear(); hollow = false; fight = new Set(); can = true; full = false; now = T0 + 5000 }

  // ── the table: one row a species, Alex's manners, never faster than walking
  const loco = readFileSync(new URL('../shared/locomotion.ts', import.meta.url), 'utf8')
  ok(new RegExp(`WALK_SPEED = ${S.FETCH_WALK}\\b`).test(loco), 'FETCH_WALK is not the keeper\'s walk')
  const F = S.FETCH, sp = Object.keys(F) as (keyof typeof F)[]
  ok(sp.length === 10 && sp.every(k => F[k].v > 0 && F[k].v <= 1 && F[k].chance > 0 && F[k].chance <= 1 && F[k].r > 0), 'a row out of range')
  const fun = ['fox', 'frog', 'hummingbird', 'rabbit'] as const, suits = ['owl', 'bat', 'firefly', 'axolotl'] as const, rare = ['water-bear', 'turtle'] as const
  ok(Math.min(...fun.map(k => F[k].chance)) > Math.max(...suits.map(k => F[k].chance)) && Math.min(...suits.map(k => F[k].chance)) > Math.max(...rare.map(k => F[k].chance)), 'for fun > when it suits > rarely')
  ok(F.fox.v === 1 && F.axolotl.v < 0.6 && F.turtle.v <= Math.min(...sp.map(k => F[k].v)), 'Vulnyx dashes, Manalotl ambles, Shellmere slowest')
  ok(F.bat.r === Math.max(...sp.map(k => F[k].r)), 'Noctyx not the farthest (echo)'); ok(F['water-bear'].r === Math.min(...sp.map(k => F[k].r)), 'Dewbear not pressed close')
  ok(F.owl.wait === Math.max(...sp.filter(k => k !== 'turtle').map(k => F[k].wait)), 'Athowl does not wait'); ok(F.turtle.wait >= F.owl.wait && !F.turtle.tiny, 'Shellmere not patient, or picky')
  ok(F.firefly.tiny && sp.filter(k => F[k].tiny).length === 1, 'Luminara only tiny things'); ok(F.hummingbird.midAir && sp.filter(k => F[k].midAir).length === 1, 'Hovari plucks mid-air')
  ok(S.tinyLoot({ item: 'sky_shard', n: 1 }) && !S.tinyLoot({ item: 'goldwood_log', n: 1 }) && !S.tinyLoot({ item: 'mast', n: 1 }) && !S.tinyLoot({ item: 'sky_shard', n: 3 }), 'tiny')
  { let hits = 0; for (let i = 0; i < 2000; i++) if (S.wantRoll('dew', `d${i}`) < F['water-bear'].chance) hits++
    ok(hits > 150 && hits < 340, `Dewbear bothers ${hits}/2000`); ok(S.wantRoll('a', 'b') === S.wantRoll('a', 'b'), 'she changes her mind every look') }
  /** a node whose drop this spirit chooses to fetch (her choice is a fixed roll per drop) */
  const liked = (sid: string, tag: string, chance = 0.9) => Array.from({ length: 400 }, (_, i) => `${tag}${i}`).find(n => S.wantRoll(sid, `tree:${n}:9:0`) < chance)!

  // ── without a spirit: nothing moves
  fresh(); const a0 = put('a', { x: 4, y: 0, z: 0 }, 2); run([], 3); ok(L.holderOf(a0.id) === undefined && sum() === 1 && count() === 0, 'no spirit: something moved')

  // ── with a Vulnyx: goes, picks up, comes back, tosses; the keeper gets it once, on landing
  fresh(); S.joinFetch('v', 'fox'); pos.set('v', { x: 1.7, y: 0, z: 0 })
  const d1 = put(liked('v', 'b'), { x: -5, y: 0, z: 3 }, 2)
  tick(); ok(phase('v') === 'go' && L.holderOf(d1.id) === S.whoOf('v'), 'Vulnyx did not go')
  run(['v'], 10, () => phase('v') === 'carry'); ok(phase('v') === 'carry' && count() === 0 && sum() === 1, 'not picked up, or paid early')
  run(['v'], 10, () => phase('v') === 'toss'); ok(phase('v') === 'toss' && count() === 0, 'no toss, or paid before it landed')
  run(['v'], 2, () => phase('v') === null); ok(count() === 1 && sum() === 0 && L.holderOf(d1.id) === undefined, `the keeper did not get it once (bag ${count()}, ground ${sum()})`)
  run(['v'], 2); ok(count() === 1, 'paid twice'); reload(); ok(sum() === 0, 'a fetched drop came back on a reload')
  ok(vSeen > 0 && vSeen <= S.FETCH_WALK, `faster than walking: ${vSeen}`)
  // a slow one never goes faster than her share of a walk
  fresh(); S.joinFetch('s', 'turtle'); pos.set('s', { x: 1.7, y: 0, z: 0 }); vSeen = 0
  { const id = Array.from({ length: 200 }, (_, i) => `t${i}`).find(n => S.wantRoll('s', `tree:${n}:9:0`) < F.turtle.chance)!; put(id, { x: -4, y: 0, z: 0 }) }
  now += 4000; tick(); ok(phase('s') === 'go' && Math.abs(vSeen - 0) < 1e-9, 'Shellmere did not go'); walk('s'); ok(Math.abs(vSeen - S.FETCH_WALK * F.turtle.v) < 1e-9, 'Shellmere not at her own pace')

  // ── two spirits, one drop: one takes it, paid once
  fresh(); S.joinFetch('v1', 'fox'); S.joinFetch('v2', 'rabbit'); pos.set('v1', { x: 1.7, y: 0, z: 0 }); pos.set('v2', { x: -1.7, y: 0, z: 0 })
  const both = Array.from({ length: 300 }, (_, i) => `two${i}`).find(n => S.wantRoll('v1', `tree:${n}:9:0`) < F.fox.chance && S.wantRoll('v2', `tree:${n}:9:0`) < F.rabbit.chance)!
  const d2 = put(both, { x: 0, y: 0, z: 4 }, 3)
  tick(); const goers = ['v1', 'v2'].filter(id => phase(id) === 'go')
  ok(goers.length === 1 && L.holderOf(d2.id) === S.whoOf(goers[0]), `two spirits took one drop (${goers})`)
  run(['v1', 'v2'], 20, () => count() > 0 && phase('v1') === null && phase('v2') === null); run(['v1', 'v2'], 2)
  ok(count() === 1 && sum() === 0, `two spirits: bag ${count()}, ground ${sum()}`)
  // two drops, two spirits: each its own
  fresh(); S.joinFetch('v1', 'fox'); S.joinFetch('v2', 'fox'); pos.set('v1', { x: 1.7, y: 0, z: 0 }); pos.set('v2', { x: -1.7, y: 0, z: 0 })
  { const ids = Array.from({ length: 300 }, (_, i) => `pair${i}`).filter(n => S.wantRoll('v1', `tree:${n}:9:0`) < 0.9 && S.wantRoll('v2', `tree:${n}:9:0`) < 0.9).slice(0, 2)
    put(ids[0], { x: 4, y: 0, z: 0 }); put(ids[1], { x: -4, y: 0, z: 0 }); tick()
    ok(phase('v1') === 'go' && phase('v2') === 'go' && S.fetchState().find(r => r.id === 'v1')!.loot !== S.fetchState().find(r => r.id === 'v2')!.loot, 'two drops: not one each')
    run(['v1', 'v2'], 20, () => count() === 2); run(['v1', 'v2'], 2); ok(count() === 2 && sum() === 0, `two drops: bag ${count()}`) }

  // ── called off mid-fetch
  const setup = () => { fresh(); S.joinFetch('v', 'fox'); pos.set('v', { x: 1.7, y: 0, z: 0 }); const d = put(liked('v', 'c'), { x: 6, y: 0, z: 0 }, 2); tick(); return d }
  { const d = setup(); walk('v'); S.leaveFetch('v'); ok(L.holderOf(d.id) === undefined && sum() === 1 && L.lootNow(now)[0].x === 6, 'called off on her way: moved, lost, or still held')
    ok(L.claimLoot(d.id, 'keeper'), 'called off: the keeper cannot take it') }
  { const d = setup(); run(['v'], 10, () => phase('v') === 'carry'); const at = pos.get('v')!; S.leaveFetch('v')
    const l = L.lootNow(now); ok(l.length === 1 && l[0].id === d.id && l[0].n === 1 && Math.hypot(l[0].x - at.x, l[0].z - at.z) < 0.25 && L.holderOf(d.id) === undefined && count() === 0, 'called off carrying: not set down where she stood')
    reload(); ok(sum() === 1 && L.lootNow(now).length === 1, 'called off carrying: a reload lost or doubled it') }
  // reload mid-carry: on the ground where it lay, her run lets go, and it is paid exactly once in the end
  { const d = setup(); run(['v'], 10, () => phase('v') === 'carry'); reload()
    ok(L.holderOf(d.id) === undefined && sum() === 1 && L.lootNow(now)[0].x === 6, 'reload mid-carry: not where it lay'); tick(); ok(phase('v') !== 'carry' && phase('v') !== 'toss', 'reload mid-carry: she still carries a drop she does not hold')
    run(['v'], 30, () => count() === 1); run(['v'], 2); ok(count() === 1 && sum() === 0, `reload mid-carry: bag ${count()}, ground ${sum()}`) }
  // reload mid-toss
  { setup(); run(['v'], 20, () => phase('v') === 'toss'); reload(); run(['v'], 1); run(['v'], 30, () => count() === 1); run(['v'], 2); ok(count() === 1 && sum() === 0, `reload mid-toss: bag ${count()}, ground ${sum()}`) }
  // zone change / leave the Wilds mid-carry: the ground goes, the hold goes, the drop lies where it lay
  { const d = setup(); run(['v'], 10, () => phase('v') === 'carry'); S.endFetch(); S.leaveFetch('v')
    ok(L.holderOf(d.id) === undefined && sum() === 1 && L.lootNow(now)[0].x === 6 && count() === 0, 'zone change mid-carry: lost, doubled, or moved') }
  // her model unmounts first (the zone's spirits go), then the ground
  { const d = setup(); run(['v'], 10, () => phase('v') === 'carry'); S.leaveFetch('v'); S.endFetch(); ok(L.holderOf(d.id) === undefined && sum() === 1 && count() === 0, 'unmount order: lost or doubled') }

  // ── a Hollow about / a fight: she stays
  { fresh(); S.joinFetch('v', 'fox'); pos.set('v', { x: 1.7, y: 0, z: 0 }); const d = put(liked('v', 'h'), { x: 5, y: 0, z: 0 }); hollow = true; run(['v'], 2); ok(phase('v') === null && L.holderOf(d.id) === undefined, 'a Hollow about: she went')
    hollow = false; fight.add('v'); run(['v'], 2); ok(phase('v') === null, 'in a fight: she went'); fight.clear(); tick(); ok(phase('v') === 'go', 'Hollow gone: she never goes')
    run(['v'], 10, () => phase('v') === 'carry'); hollow = true; tick(); ok(phase('v') === null && L.holderOf(d.id) === undefined && sum() === 1 && count() === 0, 'a Hollow mid-fetch: not set down') }

  // ── the keeper can always pick it up unhelped: walk up to the one she is going for and she lets it go
  { fresh(); S.joinFetch('v', 'fox'); pos.set('v', { x: 8, y: 0, z: 8 }); const d = put(liked('v', 'k'), { x: 3, y: 0, z: 0 }); tick(); ok(phase('v') === 'go', 'keeper test: she did not go')
    K.x = 2; tick(); ok(phase('v') === null && L.holderOf(d.id) === undefined && L.claimLoot(d.id, 'keeper'), 'the keeper walked up: she kept it'); L.releaseLoot(d.id, 'keeper'); K.x = 0 }

  // ── manners
  { fresh(); S.joinFetch('l', 'firefly'); pos.set('l', { x: 1.7, y: 0, z: 0 })
    for (let i = 0; i < 60; i++) put(`lg${i}`, { x: 4, y: 0, z: i * 0.01 }); run(['l'], 1); ok(phase('l') === null, 'Luminara took a log')
    fresh(); S.joinFetch('l', 'firefly'); pos.set('l', { x: 1.7, y: 0, z: 0 }); for (let i = 0; i < 60; i++) put(`sh${i}`, { x: 4, y: 0, z: i * 0.01 }, 1, 'mast'); run(['l'], 1); ok(phase('l') === null, 'Luminara took a mast')
    fresh(); S.joinFetch('l', 'firefly'); pos.set('l', { x: 1.7, y: 0, z: 0 }); for (let i = 0; i < 60; i++) put(`sk${i}`, { x: 4, y: 0, z: i * 0.01 }, 1, 'blankstone_dust'); run(['l'], 1); ok(phase('l') !== null, 'Luminara never takes a tiny thing') }
  { // mid-air: a drop 0.2 s old
    fresh(); S.joinFetch('h', 'hummingbird'); S.joinFetch('f', 'fox'); pos.set('h', { x: 50, y: 0, z: 0 }); pos.set('f', { x: -50, y: 0, z: 0 })
    for (let i = 0; i < 40; i++) put(`air${i}`, { x: 4, y: 0, z: i * 0.01 }, 1, 'goldwood_log', now - 200); tick()
    ok(phase('h') === 'go' && phase('f') === null, 'mid-air: Hovari did not pluck it, or Vulnyx took one still falling') }
  { // radius: a drop 12 m out is Noctyx's, not Vulnyx's
    fresh(); S.joinFetch('b', 'bat'); S.joinFetch('f', 'fox'); pos.set('b', { x: 1, y: 0, z: 0 }); pos.set('f', { x: -1, y: 0, z: 0 }); now += 5000
    for (let i = 0; i < 40; i++) put(`far${i}`, { x: 12, y: 0, z: i * 0.01 }); tick(); ok(phase('b') === 'go' && phase('f') === null, 'echo: Noctyx did not find the far drop, or Vulnyx ran 12 m') }
  { // Athowl waits, then swoops
    fresh(); S.joinFetch('o', 'owl'); pos.set('o', { x: 1, y: 0, z: 0 }); for (let i = 0; i < 40; i++) put(`ow${i}`, { x: 4, y: 0, z: i * 0.01 }, 1, 'goldwood_log', now - 1000)
    tick(); ok(phase('o') === null, 'Athowl did not wait'); now += 2000; tick(); ok(phase('o') === 'go', 'Athowl never swoops') }
  // a full bag: she does not bother; bag full when her toss lands: it lies at the keeper's feet, not lost
  { fresh(); full = true; S.joinFetch('v', 'fox'); pos.set('v', { x: 1.7, y: 0, z: 0 }); put(liked('v', 'full'), { x: 4, y: 0, z: 0 }); run(['v'], 1); ok(phase('v') === null, 'full bag: she went')
    full = false; tick(); ok(phase('v') === 'go', 'room again: she never goes'); run(['v'], 20, () => phase('v') === 'toss')
    const st = I.itemDef('waymark').stack; inv = { v: 1, slots: Array.from({ length: I.SLOTS }, () => ({ id: 'waymark', n: st })) } as import('../shared/inventory').Inv
    run(['v'], 2, () => phase('v') === null); const l = L.lootNow(now); ok(l.length === 1 && l[0].n === 1 && Math.hypot(l[0].x - K.x, l[0].z - K.z) < 1e-9 && L.holderOf(l[0].id) === undefined, 'tossed into a full bag: lost, or not at the keeper\'s feet') }
  // not drawn (the spirit is gone from the scene) mid-carry: set down where she was last seen
  { const d = setup(); run(['v'], 10, () => phase('v') === 'carry'); const at = pos.get('v')!; pos.delete('v'); tick()
    ok(phase('v') === null && L.holderOf(d.id) === undefined && Math.hypot(L.lootNow(now)[0].x - at.x, L.lootNow(now)[0].z - at.z) < 0.25 && sum() === 1, 'not drawn mid-carry: lost or held') }

  // ── wiring: the follow walk asks her fetch after a fight and before a skit; only a following spirit joins; the trot caps her speed
  const model = readFileSync(new URL('./spirit-model.tsx', import.meta.url), 'utf8'), trot = readFileSync(new URL('./spirit-trot.ts', import.meta.url), 'utf8')
  ok(/fightSlot\(id\) \?\? fetchSlot\(id\) \?\? skitSlot\(id, keeperAt\) \?\? formationSlot\(id\)/.test(model), 'fetch slot not between the fight and the skit')
  ok(/if \(on\) joinFetch\(id, sp\); else leaveFetch\(id\)/.test(model) && /leaveFormation\(id\); leaveFetch\(id\) \}/.test(model), 'join / leave not tied to following')
  ok(/Math\.min\(sl\?\.vMax \?\? F\.vMax, clamp\(/.test(trot), 'the trot ignores the fetch\'s vMax')
  const view = readFileSync(new URL('./ground-loot-view.tsx', import.meta.url), 'utf8')
  ok(/tickFetch\(/.test(view) && /endFetch\(\)/.test(view) && !/manamal/i.test(readFileSync(new URL('./spirit-fetch.ts', import.meta.url), 'utf8').replace(/Mana'mals never join/, '')), 'the ground does not tick or end the fetch')
  ok(!readFileSync(new URL('../shared/companion-follower.tsx', import.meta.url), 'utf8').includes('joinFetch'), 'a Mana\'mal fetches')

  if (fails.length) { console.error(`spirit-fetch: ${pass} pass, ${fails.length} FAIL`); for (const x of fails) console.error('  ✗ ' + x); process.exit(1) }
  console.log(`spirit-fetch: ${pass}/0`); process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
