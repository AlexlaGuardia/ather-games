// Run: npx tsx src/app/shimmer/open/ather/infection.test.ts
// BETA M128 s1: the weekly settlement infections' engine (canon: CANON_GAPS › Weekly settlement infections + The infection story,
// Alex 11-24): the picker never repeats and never picks while one holds; the loss clock counts played time only and survives
// reloads and absence; a save relights; a loss is for the season; the purge resets all but the clues; the clue order with losses;
// the switch off is the old game.
import { readFileSync } from 'node:fs'
import { step, begin, fell, pick, pickable, purge, freshInfection, parseInfection, loadInfection, saveInfection, blank, infectNodes, infectedGround, championSpot, spentIds, nextAfter, NO_NODES, INFECT_WEEK_MS as W, ONLINE_TICK_MAX_MS as MAX, CLUES, type Infection, type InfectEvent, type StepIn } from './infection'
import { infectId, infectedPlace, INFECT_R } from './infect-id'
import { isLit, canTravel, canPlant, groundOf, lastLit, plant, type Waymark } from './waymarks'
import { folkTalk, ASK, type FolkTalkActs } from './folk-talk'
import { folkOf, freshTrust } from './settlement-folk'
import { burrfolkOf, BURR_LABEL } from './burrfolk'
import { DIGGER_LABEL } from './digger-trade'
import { GLADE } from './moonwell-glade'
import { GLEANER_POST } from './gleaner'
import { SETTLEMENT } from './first-settlement'
import { GAME_DAY_MS } from './nodes'
import { BIOME } from './wilds'
import type { Network } from './network'
import { GARDEN_KEY_SPECS } from '@/lib/keeper-key-specs'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }
const net = JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network
const IDS = net.settlements.filter(pickable).map(s => s.id), t0 = 1000 * GAME_DAY_MS
const go = (s: Infection, o: Partial<StepIn>) => step(s, { season: 1, now: t0, played: 0, known: IDS, rng: () => 0, ...o })

ok(W === 5 * 64 * 60 * 1000, 'an in-game week = 5 days x 64 min')
// ── who may be picked ──
ok(IDS.length === 10 && !IDS.includes('s1-10'), `the ten generated settlements, not Bryonydell (the ship repair's Digger): ${IDS.join()}`)
ok(!pickable(GLADE as never) && !pickable(GLEANER_POST as never) && !pickable({ id: 's1-99', name: 'x', x: SETTLEMENT.x + 50, z: SETTLEMENT.z }), 'never the Glade, Gleaner\'s post, or ground by Greg\'s stone')
// ── nothing discovered = nothing at all ──
{ const f = freshInfection(1), r = go(f, { known: [] }); ok(r.s === f && !r.events.length && blank(r.s), 'nothing discovered: no clock, nothing to write')
  const far = go(f, { known: [], now: t0 + 50 * W }); ok(far.s === f, 'however long') }
// ── the first week ──
let s = go(freshInfection(1), {}).s
ok(s.next === t0 + W && !s.active, 'the clock starts at the first discovery, one week out')
ok(!go(s, { now: t0 + W - 1 }).s.active, 'not before the week is out')
ok(!go(s, { now: t0 + W, mayStart: false }).s.active, 'not under the keeper\'s feet')
{ const r = go(s, { now: t0 + W }); ok(r.s.active?.id === [...IDS].sort()[0] && r.events.map(e => e.kind).join() === 'start' && r.events[0].clue === 1, 'then one starts, with clue 1 and the start ping') }
{ const r = go(s, { now: t0 + 40 * W }); ok(r.s.active?.at === t0 + 40 * W, 'after a long absence it starts NOW: no away time eats the week') }
{ const seen = new Set(Array.from({ length: 40 }, (_, k) => pick(freshInfection(1), IDS, () => k / 40))); ok(seen.size === IDS.length, 'random over every discovered one'); ok(pick(freshInfection(1), IDS, () => 0.9999999) !== null && pick(freshInfection(1), IDS, () => 1) !== null, 'edge roll') }
// ── never the same twice, none while one holds ──
{ let c = freshInfection(1), now = t0; const hit: string[] = []; c = go(c, { now }).s
  for (let k = 0; k < 400; k++) { now += W / 4; const r = go(c, { now, rng: () => (k * 0.37) % 1, played: 0 }); if (r.s.active && r.s.active !== c.active && r.s.active.id !== c.active?.id) { ok(!c.active, 'none while one holds'); hit.push(r.s.active.id) } c = r.s; if (c.active && k % 3 === 0) c = fell(c, c.active.id, now).s }
  ok(hit.length === CLUES && new Set(hit).size === hit.length, `never the same one twice, and none after the seventh is told (${hit.join()})`) }
{ const a = begin(freshInfection(1), 'a', t0); ok(begin(a, 'b', t0) === a && go(a, { now: t0 + 20 * W }).s.active?.id === 'a', 'it holds however long the keeper is away')
  const b = fell(a, 'a', t0).s; ok(begin(b, 'a', t0) === b && pick(b, ['a'], () => 0) === null && spentIds(b).join() === 'a', 'a saved one is safe after') }
// ── the clocks: week one = world time; the loss = played time only ──
const held = begin({ ...freshInfection(1), next: t0 }, 's1-2', t0)
ok(go(held, { now: t0 + W - 1, played: MAX }).s.active?.online === 0, 'played time in the first week does not count')
{ const r = go(held, { now: t0 + 100 * W, played: 0 }); ok(r.s.active?.online === 0 && !r.s.lost.length, '100 weeks away: not a second of the loss clock') }
{ const r = go(held, { now: t0 + W + 5000, played: 60 * 60 * 1000 }); ok(r.s.active?.online === 5000, 'only what lies past the first week'); const r2 = go(held, { now: t0 + 9 * W, played: 60 * 60 * 1000 }); ok(r2.s.active?.online === MAX, 'a slept hour is capped at one tick') ; ok(go(held, { now: t0 + 9 * W, played: -5000 }).s.active?.online === 0, 'never runs back') }
ok(go(held, { now: t0 - 3 * W, played: MAX }).s.active?.at === t0 - 3 * W && !go(held, { now: t0 - 3 * W, played: MAX }).s.lost.length, 'the clock set back: the week starts over, never a loss')
{ let c = held, now = t0 + W, played = 0; const ev: InfectEvent[] = []
  const kinds = () => ev.map(e => e.kind).join()
  { const r = go(c, { now: t0 + W * 0.5 }); c = r.s; ev.push(...r.events) } ok(kinds() === 'hold', 'the hold ping, half way')
  { const r = go(c, { now: t0 + W * 0.6 }); ok(r.s === c && !r.events.length, 'once') }
  for (let k = 0; k < 3000 && !c.lost.length; k++) {
    now += 10_000; played += 10_000
    if (k % 500 === 499) { now += 30 * W; c = parseInfection(JSON.parse(JSON.stringify(c)), 1) }   // away 30 weeks, then a reload
    const r = go(c, { now, played: 10_000 }); c = r.s; ev.push(...r.events)
  }
  ok(played === W && c.lost.join() === 's1-2' && !c.active, `lost after exactly one played week, across reloads and absence (${played / W})`)
  ok(kinds() === 'hold,second,lost', `each ping once: ${kinds()}`)
  ok(c.next! > now && c.next! <= now + W && (c.next! - t0) % W === 0, 'the next may start on the next week\'s grid')
  // ── loss is for the season ──
  ok(!fell(c, 's1-2', now).events.length && go(c, { now: now + 50 * W, played: MAX, known: ['s1-2'] }).s.lost.join() === 's1-2', 'a lost one stays lost and is never picked again')
  ok(c.told === 0 && c.assigned === 1, 'its clue is carried, not told') }
{ const near = { ...held, active: { ...held.active!, online: W, sent: ['start', 'hold', 'second'] as never } }
  const r = go(near, { now: t0 + 3 * W, mayLose: false }); ok(r.s.active?.id === 's1-2' && !r.s.lost.length, 'never lost in the middle of its fight'); const d = fell(r.s, 's1-2', t0 + 3 * W); ok(d.s.saved.join() === 's1-2' && !d.s.lost.length, '...and the fight can still save it') }
ok(nextAfter(0, 1) === W && nextAfter(0, W) === 2 * W && nextAfter(0, W * 2.5) === 3 * W, 'one per week')
// ── the clues ──
const run = (plan: string) => { let c = freshInfection(1); const order: string[] = []; let k = 0
  for (const p of plan) { c = begin(c, `x${k++}`, t0); const id = c.active!.id, clue = c.active!.clue; if (p === 'S') { const before = c.told, r = fell(c, id, t0); c = r.s; for (let n = before + 1; n <= c.told; n++) order.push(String(n)); if (r.events.some(e => e.kind === 'open')) order.push('open') } else c = { ...c, active: null, lost: [...c.lost, id] }; void clue }
  return { c, order: order.join('') } }
ok(run('SSSSSSS').order === '1234567open', 'seven saved: 1..7, then the opening')
ok(run('SLSSSSS').order === '1234567open', 'a lost one\'s clue passes to the next cleared, in order')
ok(run('SLLS').c.told === 4 && run('SLL').c.told === 1, 'two lost: both passed on')
ok(run('SSSSSSL').c.told === 6 && run('SSSSSSL').order === '123456', 'the seventh lost: no opening yet')
ok(run('SSSSSSLS').order === '1234567open' && run('SSSSSSLLS').order === '1234567open', 'it waits for the next cleared, however many are lost')
ok(begin(run('SSSSSSL').c, 'z', t0).active?.clue === 0, 'an eighth holds no clue of its own')
ok(run('LLLLLLLS').order === '1234567open', 'the quest always finishes')
ok(!fell(held, 'other', t0).events.length && fell(held, 'other', t0).s === held, 'another place\'s champion changes nothing')
// ── the season purge ──
{ const { c } = run('SSLS'), live = begin(c, 'q', t0), p = purge(live, 2)
  ok(p.season === 2 && !p.lost.length && !p.saved.length && !p.active && p.next === null && p.told === 4 && p.assigned === 4, 'the purge: places gone, clues kept, a held one\'s clue handed out again')
  ok(purge(run('SL').c, 2).assigned === 2 && purge(run('SL').c, 2).told === 1, 'a carried clue is carried across')
  ok(step(live, { season: 2, now: t0, played: 0, known: [], rng: () => 0 }).s.season === 2 && JSON.stringify(parseInfection(JSON.parse(JSON.stringify(live)), 2)) === JSON.stringify(p), 'on the step and on the load')
  ok(begin(purge(live, 2), 's2-0', t0).active?.clue === 5, 'the next clue in order') }
// ── the save: old and broken ones ──
for (const bad of [null, undefined, 5, 'x', [], {}, { v: 2 }, { v: 1 }, { v: 1, season: 'a' }]) ok(JSON.stringify(parseInfection(bad, 1)) === JSON.stringify(freshInfection(1)), `no save / a broken one reads as none: ${JSON.stringify(bad)}`)
{ const g = parseInfection({ v: 1, season: 1, next: 'x', active: { id: 3 }, saved: ['a', 7], lost: ['a', 'b'], told: 99, assigned: -1 }, 1); ok(g.next === null && !g.active && g.saved.join() === 'a' && g.lost.join() === 'b' && g.told === 7 && g.assigned === 7, 'fields one by one; a saved place is never also lost') }
ok(parseInfection({ ...held, saved: ['s1-2'] }, 1).active === null, 'a saved place is never also held')
{ const mem = new Map<string, string>(); (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v) } }
  ok(JSON.stringify(loadInfection(1)) === JSON.stringify(freshInfection(1)) && !mem.size, 'a load writes nothing'); saveInfection(held); ok(JSON.stringify(loadInfection(1)) === JSON.stringify(held), 'round trip') }
ok(GARDEN_KEY_SPECS.some(k => k.base === 'ather.infection.v1'), 'its key is a garden key (each garden its own Wilds)')
// ── the ground, the champion, the waymark ──
const p2 = net.settlements.find(p => p.id === 's1-2')!, off = freshInfection(1), lost: Infection = { ...off, lost: ['s1-2'] }, spot = (p: typeof p2) => championSpot(p, [], () => true), tile = () => 't'
ok(infectNodes(null, net.settlements, spot, tile, BIOME.meadow) === NO_NODES && infectNodes(off, net.settlements, spot, tile, BIOME.meadow) === NO_NODES, 'off / none: the very same empty list')
{ const n = infectNodes(held, net.settlements, spot, tile, BIOME.meadow); ok(n.length === 1 && n[0].id === infectId('s1-2') && !n[0].quiet && Math.hypot(n[0].x - p2.x, n[0].z - p2.z) <= 30, 'held: one champion, at the place') }
{ const n = infectNodes(lost, net.settlements, spot, tile, BIOME.meadow); ok(n.length === 1 && n[0].quiet === true, 'lost: the ground, no champion') }
ok(infectNodes(fell(held, 's1-2', t0).s, net.settlements, spot, tile, BIOME.meadow) === NO_NODES, 'saved: gone')
{ const c = championSpot(p2, [], () => true); ok((p2.pads ?? []).length > 0 && p2.pads!.every(q => Math.hypot(q[0] - c.x, q[1] - c.z) >= 10.5), 'clear of every home'); const cf = championSpot(p2, [c], () => true); ok(Math.hypot(cf.x - c.x, cf.z - c.z) >= 4, 'clear of the folk'); ok(championSpot(p2, [], () => false).x === p2.x, 'no open ground: the middle') }
for (const st of [held, lost]) ok(infectedGround(st, net.settlements, p2.x + INFECT_R - 1, p2.z) === infectId('s1-2') && infectedGround(st, net.settlements, p2.x + INFECT_R + 1, p2.z) === null, 'the ground round the homes, no further')
ok(infectedGround(off, net.settlements, p2.x, p2.z) === null && infectedGround(null, net.settlements, p2.x, p2.z) === null && infectedGround(fell(held, 's1-2', t0).s, net.settlements, p2.x, p2.z) === null, 'else the section\'s own')
ok(infectedPlace(infectId('s1-2')) === 's1-2' && infectedPlace('first-wilds:2,3') === null, 'node id <-> place')
const list: Waymark[] = plant([], { tile: 't', x: 0, y: 0, z: 0, biome: BIOME.shore, settlement: 's1-2' }, 1), w = list[0]
const dark = new Set(infectNodes(held, net.settlements, spot, tile, BIOME.meadow).map(n => n.id)), gone = new Set([infectId('s1-2')]), none = new Set(['first-wilds:0,0'])
ok(!isLit(w, dark) && !canTravel(w, dark).ok && !lastLit(list, dark), 'held: its waymark is dark, no travel, no fall lands there')
ok(!isLit(w, gone), 'lost: dark'); ok(isLit(w, none) && isLit(w, new Set()), 'saved / off: lit')
ok(isLit({ ...w, settlement: 's1-3' }, dark) && isLit({ ...w, settlement: undefined }, dark), 'no other waymark')
ok(!canPlant([], { tile: 't', x: 0, z: 0, biome: BIOME.shore, grounded: true, swimming: false, settlement: null, ground: groundOf(infectId('s1-2'), dark) }).ok, 'no planting on held ground')
// ── trade stopped, folk still talk ──
{ const tr = net.settlements.map(p => ({ p, f: folkOf(p, 1) })), acts: FolkTalkActs = { go: () => {}, give: () => {}, recruit: () => {}, bye: () => {}, trade: () => {}, barter: () => {} }
  const D = tr.find(q => q.f.some(f => f.profession === 'digger'))!, d = D.f.find(f => f.profession === 'digger')!, E = tr.find(q => q.f.some(f => f.employed))!, e = E.f.find(f => f.employed)!, b = burrfolkOf(E.p, 1, E.f)!
  const ls = (q: typeof E, fid: string, screen: 'hello' | 'needs' | 'stall', stopped?: boolean) => folkTalk({ folk: q.f, home: q.f, trust: freshTrust(), have: () => 99, room: 3, burr: b, ...(stopped === undefined ? {} : { stopped }) }, { fid, screen }, acts).options.map(o => o.label)
  ok(ls(D, d.id, 'hello').includes(DIGGER_LABEL.trade) && !ls(D, d.id, 'hello', true).includes(DIGGER_LABEL.trade), 'the Digger\'s barter stops')
  ok(ls(E, e.id, 'hello').includes(ASK.needs) && !ls(E, e.id, 'hello', true).includes(ASK.needs) && ls(E, e.id, 'needs').length > 1 && ls(E, e.id, 'needs', true).join() === ASK.back, 'the want-list stops')
  ok(ls(E, b.id, 'hello').includes(BURR_LABEL.look) && !ls(E, b.id, 'hello', true).includes(BURR_LABEL.look) && b.stock.every(k => !ls(E, b.id, 'stall', true).includes(BURR_LABEL.swap(k))), 'the stall stops')
  ok(ls(E, e.id, 'hello', true).includes(ASK.bye) && ls(E, e.id, 'hello', true).includes(ASK.inspect), 'the folk still talk')
  ok(ls(E, e.id, 'hello', false).join() === ls(E, e.id, 'hello').join(), 'switch off: the same answers') }
// ── the wiring: one switch, owner-only; off reads nothing ──
{ const u = readFileSync('src/app/shimmer/open/ather/use-infection.tsx', 'utf8'), pg = readFileSync('src/app/shimmer/open/ather/page.tsx', 'utf8'), cl = readFileSync('src/app/shimmer/open/ather/combat-layer.tsx', 'utf8'), ft = readFileSync('src/app/shimmer/open/ather/use-folk-talk.tsx', 'utf8')
  ok(/export function useInfectionsOn\(\): boolean \{ return useIsOwner\(\) \}/.test(u), 'the switch is the owner check')
  ok(/const ready = on && /.test(u) && (u.match(/loadInfection\(/g) ?? []).length === 5 && (u.match(/if \(!ready\) return\n/g) ?? []).length === 2 && /if \(!ready \|\| !state\) return null/.test(u) && /if \(!ready \|\| new URLSearchParams/.test(u) && /if \(net && ready\)/.test(u) && /const s = ready \? state : null/.test(u), 'off: no read, no clock, no hook')
  ok(!/loadInfection|saveInfection/.test(pg), 'the page never reads the save itself')
  ok(/infection\.lost\.length \? \{/.test(pg) && /if \(!infNodes\.length\) return nearNodes/.test(pg) && /!infNodes\.length \|\| !net \? nodeOwner/.test(pg), 'off: the same network, nodes and ground')
  ok(/if \(!n\.quiet && /.test(cl) && /champ-down' && infectionRef\.current\.down\(e\.nodeId\)\) \{[^\n]*continue \}/.test(pg), 'no champion on lost ground; its champion never touches the spread ledger')
  ok((ft.match(/if \(stopped\) return/g) ?? []).length === 3 && /panel\.s\.id === infection\.held/.test(pg), 'a swap, a trade and a gift are refused too')
  ok((u.match(/hudSay\(/g) ?? []).length === 1 && /saveTell\(told\(t, d\)\); hudSay\(d\.text/.test(u) && !/setToast/.test(u), 'the event has no words; the only words are a due line (infect-tell.ts, s2), written down as it is said') }
console.log(`infection: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
