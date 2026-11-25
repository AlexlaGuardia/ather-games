// node test: npx tsx src/app/shimmer/open/shared/champ-share.test.ts (BETA M156 s3: one champion, one kill, a clear for everyone there)
import { applyChamp, applySnap, believeDown, champNetHit, encodeHand, encodeSnap, shownOf, takeHand, CHAMP_DPS_MAX, CHAMP_ID, DOWN_MS, SNAP_MAX, decodeChamp, encodeChamp, decodeKills, type HitBudget, type Shown } from './fight-share'
import { newCombat, stepCombat, spawnHollow, type Combat, type CombatEvent, type Terrain } from '../ather/combat'
import { CHAMP, THERE_R, wakeChampion } from '../ather/champion'
import { freshInfection, guestClue, fell, begin, parseInfection, purge, CLUES } from '../ather/infection'
import { freshTell, dueGiven, told, due, note, carried } from '../ather/infect-tell'
import type { WildsNode } from '../ather/nodes'
let fails = 0
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const T: Terrain = { heightAt: () => 0, walkable: () => true } as unknown as Terrain
const NODE = { id: 'n1', x: 0, z: 0 } as WildsNode, at = (x: number, z = 0) => ({ x, y: 0, z })
const run = (c: Combat, feet: { x: number; y: number; z: number }, s: number) => { const ev: CombatEvent[] = []; for (let t = 0; t < s; t += 0.05) { stepCombat(c, T, feet, 0.05); ev.push(...c.events) } return ev }
const up = (others?: Combat['others']) => { const c = newCombat(7); c.others = others; wakeChampion(c, T, NODE); run(c, at(20), 2.3); return c }
// alone = as ever
{ const c = up(); c.champ!.bar = 2; c.champ!.hp = 5; const g = champNetHit(c, T, { id: 'x', x: 5, z: 0 }, 50, new Map(), 0); ok(g && !c.champ, 'a guest round fells it'); const e = c.events.find(k => k.kind === 'champ-down') as { there?: string[] }; ok(e && e.there === undefined, 'alone: no roll of who was there') }
// the wire
const h = up([{ id: 'g', x: 8, y: 0, z: 0 }, { id: 'far', x: 300, y: 0, z: 0 }]); for (let k = 0; k < 60; k++) spawnHollow(h, T, 1000 + k / 10, -1000 - k / 10)
const snap = encodeSnap(h, { x: 1000, z: -1000 })
ok(JSON.stringify(snap).length < 2048 && snap.h.length === SNAP_MAX && snap.c, `it travels with a full crowd (${JSON.stringify(snap).length} bytes of 2048)`)
const g = newCombat(9); g.remote = true
applySnap(g, T, JSON.parse(JSON.stringify(snap))); applyChamp(g, T, snap.c, at(8))
ok(g.champ?.nodeId === 'n1' && g.champ.hp === CHAMP.barHp, 'the guest is shown it')
const x0 = g.champ!.x; g.champ!.state = 'idle'; run(g, at(8), 3)
ok(g.champ!.x === x0 && !g.champ!.attack && !g.spits.length, 'a guest decides nothing: it stands, starts no attack')
for (const bad of [null, 3, [], [...snap.c!].slice(1), ['n1', ...snap.c!.slice(1, 6), 5, ...snap.c!.slice(7)], ['n1', 0, 0, 0, 0, 0, 2, -5, 1, 1, -1, 0, 0], ['n1', 0, 0, 0, 0, 0, 2, NaN, 1, 1, -1, 0, 0]]) ok(decodeChamp(bad) === null, `junk refused ${JSON.stringify(bad)?.slice(0, 24)}`)
{ const c = newCombat(1); c.remote = true; applyChamp(c, T, snap.c, at(400)); ok(!c.champ, 'far off: not on screen') }
{ const c = newCombat(1); c.remote = true; applyChamp(c, T, snap.c, at(8)); applyChamp(c, T, undefined, at(8)); ok(!c.champ, 'gone from the word = gone') }
{ const c = newCombat(1); c.remote = true; const row = [...snap.c!]; applyChamp(c, T, row, at(8)); const r2 = [...row]; r2[6] = 1; const ev = applyChamp(c, T, r2, at(8)); ok(ev.length === 1 && ev[0].kind === 'champ-break', 'a bar broken is heard'); ok(!applyChamp(c, T, r2, at(8)).length, 'once') 
  const v = [...r2]; v[8] = 3; v[10] = 2; applyChamp(c, T, v, at(8)); applyChamp(c, T, v, at(8)); ok(c.spits.length === CHAMP.volley.n && c.spits.every(s => s.ghost), 'a volley is drawn once, as the host\'s'); const hp = c.keeper.hp; run(c, at(8), 3); ok(c.keeper.hp === hp, 'and hurts only by the host\'s word') }
{ const c = newCombat(1); c.remote = true; applyChamp(c, T, encodeChamp({ ...h.champ!, state: 'idle' }), at(8)); const hp = c.champ!.hp
  c.rounds.push({ x: c.champ!.x + 3, y: CHAMP.bodyY, z: c.champ!.z, vx: -100, vy: 0, vz: 0, life: 1, dmg: 9, crit: 18 } as Combat['rounds'][0]); stepCombat(c, T, at(8), 0.05)
  ok(c.champ!.hp === hp && c.netHits?.length === 1 && c.netHits[0].id === CHAMP_ID && c.netHits[0].dmg === 9, 'a guest\'s round is a word to the host, never damage here') }
// the host's side
{ const c = up([{ id: 'g', x: 8, y: 0, z: 0 }]), B = new Map<string, HitBudget>(), hp = c.champ!.hp
  ok(champNetHit(c, T, { id: 'g', x: 8, z: 0 }, 30, B, 0) && c.champ!.hp === hp - 30, 'a guest there hurts it')
  ok(!champNetHit(c, T, undefined, 30, B, 0) && !champNetHit(c, T, { id: 'far', x: 300, z: 0 }, 30, B, 0) && !champNetHit(c, T, { id: 'g', x: 8, z: 0 }, 201, B, 0) && !champNetHit(c, T, { id: 'g', x: 8, z: 0 }, -5, B, 0) && c.champ!.hp === hp - 30, 'nobody there, too far, too much, negative: nothing')
  let dealt = 0; for (let k = 0; k < 100; k++) if (champNetHit(c, T, { id: 'g', x: 8, z: 0 }, 10, B, 500)) dealt += 10
  ok(dealt + 30 <= CHAMP_DPS_MAX, `no more than ${CHAMP_DPS_MAX} a second (${dealt + 30})`); c.champ!.state = 'submerge'; ok((champNetHit(c, T, { id: 'g', x: 8, z: 0 }, 10, B, 5000), c.champ!.hp === hp - 30 - dealt || c.champ!.bar > 0), 'not while it sinks') }
// fights the nearest; a guest is hurt by the host's word; the leash counts all of us
{ const c = up([{ id: 'g', x: 3, y: 0, z: 0 }]), ev = run(c, at(40), 6); const k = ev.filter(e => e.kind === 'hurt-other'); ok(k.length > 0 && c.keeper.hp === c.keeper.maxHp, `it goes for the guest beside it (${k.length} blows), not the host 40 m off`)
  const c2 = up([{ id: 'g', x: 3, y: 0, z: 0 }]); run(c2, at(200), 4); ok(c2.champ && c2.champ.state !== 'home', 'the host walks off, a guest still on it: it stays up'); c2.others = []; run(c2, at(200), 30); ok(!c2.champ && c2.dormant?.n1 === 0, 'nobody near: it sinks, its bars remembered') }
// down: who was there
{ const c = up([{ id: 'g', x: 8, y: 0, z: 0 }, { id: 'far', x: THERE_R + 40, y: 0, z: 0 }]); c.champ!.bar = 2; c.champ!.hp = 1; champNetHit(c, T, { id: 'g', x: 8, z: 0 }, 5, new Map(), 0)
  const e = c.events.find(k => k.kind === 'champ-down') as { there: string[]; here: boolean }; ok(e.there.join() === 'g' && e.here === true && c.drops.length === 1 && c.events.filter(k => k.kind === 'champ-down').length === 1, 'down once: the guest there, not the third elsewhere') }
ok(decodeKills({ k: [[0, 0, CHAMP.chunk]] }).length === 0, 'the chunk never also comes by the kill rows (it comes with the fall, one each)')
const ch = { ...h.champ!, bar: 2 as const, state: 'idle' as const }; let S: Shown = shownOf(null, ch, 'H', 1000)
ok(believeDown(S, 'H', { n: 'n1', k: 1 }, at(8), 2000) === 'n1', 'believed: the host, the node, the last bar, near')
for (const [n, v] of [['another keeper says it', believeDown(S, 'X', { n: 'n1', k: 1 }, at(8), 2000)], ['another node', believeDown(S, 'H', { n: 'n2', k: 1 }, at(8), 2000)], ['not on its last bar', believeDown({ ...S, bar: 1 }, 'H', { n: 'n1', k: 1 }, at(8), 2000)], ['never shown one', believeDown(null, 'H', { n: 'n1', k: 1 }, at(8), 2000)], ['long ago', believeDown(S, 'H', { n: 'n1', k: 1 }, at(8), 1000 + DOWN_MS + 1)], ['I am elsewhere', believeDown(S, 'H', { n: 'n1', k: 1 }, at(200), 2000)], ['shown by another host', believeDown(S, 'X', { n: 'n1', k: 1 }, at(8), 2000)], ['junk', believeDown(S, 'H', null, at(8), 2000)]] as const) ok(v === null, `refused: ${n}`)
ok(believeDown({ ...S, up: false }, 'H', { n: 'n1', k: 1 }, at(8), 2000) === null && believeDown({ ...S, key: 1 }, 'H', { n: 'n1', k: 1 }, at(8), 2000) === null && believeDown({ ...S, key: 1 }, 'H', { n: 'n1', k: 2 }, at(8), 2000) === 'n1', 'refused while it rises; a repeat of a fall already believed; the next fall is its own')
S = { ...S, done: true }; ok(believeDown(S, 'H', { n: 'n1', k: 1 }, at(8), 2000) === null && shownOf(S, ch, 'H', 2100).done && !shownOf(S, { ...ch, state: 'rise' }, 'H', 9000).done, 'a replay: refused, until it rises anew')
// the hand-over
{ const c = newCombat(3); ok(takeHand(c, encodeHand({ ...ch, hp: 60 }), { x: 10, z: 0 }, NODE), 'the interim host gives the fight back'); wakeChampion(c, T, NODE); ok(c.champ!.bar === 2 && c.champ!.hp === 60, 'it rises on that bar with that health'); c.champ = undefined; wakeChampion(c, T, NODE); ok(c.champ!.hp === CHAMP.barHp, 'the health once') 
  const w = newCombat(3); wakeChampion(w, T, NODE); takeHand(w, { n: 'n1', b: 1, h: 40 }, { x: 10, z: 0 }, NODE); ok(w.champ!.bar === 1 && w.champ!.hp === 40, 'already rising: raised to it'); takeHand(w, { n: 'n1', b: 0, h: 140 }, { x: 10, z: 0 }, NODE); ok(w.champ!.bar === 1, 'never back')
  for (const [m, v] of [['a killed one', takeHand(newCombat(1), { n: 'n1', b: 2, h: 0 }, at(1), NODE)], ['a node I have not grey', takeHand(newCombat(1), { n: 'n1', b: 2, h: 9 }, at(1), undefined)], ['a quiet one', takeHand(newCombat(1), { n: 'n1', b: 2, h: 9 }, at(1), { ...NODE, quiet: true })], ['from afar', takeHand(newCombat(1), { n: 'n1', b: 2, h: 9 }, at(500), NODE)], ['bar 3', takeHand(newCombat(1), { n: 'n1', b: 3, h: 9 }, at(1), NODE)]] as const) ok(!v, `hand-over refused: ${m}`) }
// s3b: the guest's own next clue
{ const s0 = { ...freshInfection(1), told: 2, assigned: 2 }, s1 = guestClue(s0); ok(s1.told === 3 && s1.assigned === 3 && s1.given?.join() === '3' && !s1.saved.length && !s1.active, 'their own next (3), nothing saved or lost')
  const d = dueGiven(freshTell(1), s1)!; ok(d.text.startsWith('Grey matter from the bottom') && due(freshTell(1), s1, () => 'x')?.key === d.key && dueGiven(told(freshTell(1), d), s1) === null, 'its thing found is said once')
  ok(guestClue({ ...s0, told: CLUES, assigned: CLUES }).given === undefined, 'all seven told: nothing')
  const held = begin(s0, 's1-1', 5), hs = guestClue(held); ok(held.active!.clue === 3 && hs.told === 3 && hs.active!.clue === 4 && hs.assigned === 4, 'a place of theirs that held clue 3 now holds 4')
  const t = note(note(freshTell(1), held), hs); ok(t.clueOf['s1-1'] === 4 && carried(hs).length === 0, 'told so'); const f = fell(hs, 's1-1', 9); ok(f.s.told === 4 && f.events.length === 1, 'and saving it tells 4')
  const last = guestClue(begin({ ...s0, told: 6, assigned: 6 }, 'a', 1)); ok(last.told === 7 && last.active!.clue === 0, 'the seventh: the held place has none left')
  const lostCarry = guestClue({ ...s0, told: 0, assigned: 1, lost: ['b'] }); ok(lostCarry.told === 1 && lostCarry.assigned === 1 && !carried(lostCarry).length, 'one carried by folk who got away is their next')
  ok(JSON.stringify(parseInfection(JSON.parse(JSON.stringify(s1)), 1)) === JSON.stringify(s1) && purge(s1, 2).given?.join() === '3' && !('given' in parseInfection(JSON.parse(JSON.stringify(s0)), 1)), 'kept over a reload and the purge; a save with none is as it was') }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
