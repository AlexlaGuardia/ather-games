// Run: npx tsx src/app/shimmer/open/ather/neglect.test.ts
// BETA M235 s2 NEGLECT HAS TEETH: an uncovered infected zone left beside a cleared one for pressDays threatens it (one at a time,
// never the zone stood in, never the Glade's, a home/settlement zone safe the first week); answered = the pressing zone cleared
// inside warnDays; not answered = LOST for the season (out of the ledger); a load warns but never executes; next season it is back;
// a lost zone's ground is void (lost-void.ts: 0 on the border, deep inside, never on a neighbour); the save round-trips.
import { neglect, zoneNeighbours, NEGLECT_RULE as R, lostSet, type NeglectCtx } from './neglect'
import { freshMap, parseMap, areaState, type SpreadMap } from './spread-map'
import { lostDepthAt, withLost, LOST_DEPTH, type LostGround } from './lost-void'
import { GAME_DAY_MS as D } from './nodes'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }
const ZONES = new Set(['z0,0', 'z1,0', 'z2,0', 'z0,1', 'z1,1'])
const nb = (id: string) => zoneNeighbours(id, k => ZONES.has(k))
ok(nb('z1,0').sort().join() === 'z0,0,z1,1,z2,0', `4-neighbours that exist (${nb('z1,0')})`)
ok(zoneNeighbours('zT:1,1', () => true).includes('zT:2,1'), 'a per-tile id keeps its tile prefix')
const t0 = 100 * D
const S0 = 7, N = new Set<string>()
// z0,0 cleared at t0; z1,0 uncovered (infected) at t0; z2,0 unseen
const base = (): SpreadMap => ({ ...freshMap(), seen: { 'z0,0': t0, 'z1,0': t0 }, rule: { seed: 1, day: 100, since: t0 - 30 * D } })
const ctx = (now: number, o: Partial<NeglectCtx> = {}): NeglectCtx => ({ now, season: S0, clean: ['z0,0', 'z0,1'], neighbours: nb, standing: N, never: N, home: N, onLoad: false, ...o })
// ── press: nothing before pressDays ──
let r = neglect(base(), ctx(t0 + (R.pressDays - 0.1) * D))
ok(!r.m.threat && !r.events.length, 'no threat before pressDays')
r = neglect(base(), ctx(t0 + R.pressDays * D))
ok(r.m.threat?.id === 'z0,0' && r.m.threat.by === 'z1,0' && r.events[0]?.kind === 'warn', `threat after pressDays: z0,0 by z1,0 (${JSON.stringify(r.m.threat)})`)
ok(r.m.threat!.until - r.m.threat!.at === R.warnDays * D, 'a window of warnDays')
ok(!neglect({ ...base(), seen: { 'z0,0': t0 } }, ctx(t0 + 9 * D)).m.threat, 'an UNSEEN infected neighbour is dormant: no threat')
ok(!neglect(base(), ctx(t0 + 9 * D, { standing: new Set(['z0,0']) })).m.threat, 'never the zone the keeper stands in')
ok(!neglect(base(), ctx(t0 + 9 * D, { never: new Set(['z0,0']) })).m.threat, 'never the Glade')
const young = { ...base(), rule: { seed: 1, day: 100, since: t0 } }
ok(!neglect(young, ctx(t0 + 4 * D, { home: new Set(['z0,0']) })).m.threat, 'home/settlement zone safe the first week')
ok(neglect(young, ctx(t0 + R.homeGraceDays * D, { home: new Set(['z0,0']) })).m.threat?.id === 'z0,0', '...and not after it')
ok(neglect({ ...base(), seen: { 'z0,0': t0 + 2 * D, 'z1,0': t0 } }, ctx(t0 + 4 * D)).m.threat === undefined, 'press counts from the later of the two (re-cleared recently = fresh)')
// ── one at a time ──
const two = { ...base(), seen: { 'z0,0': t0, 'z1,0': t0, 'z0,1': t0, 'z1,1': t0 } }
r = neglect(two, ctx(t0 + 5 * D))
ok(r.events.filter(e => e.kind === 'warn').length === 1, 'at most one threat at a time')
const w = r.m
ok(neglect(w, ctx(t0 + 5.5 * D)).events.length === 0 && neglect(w, ctx(t0 + 5.5 * D)).m.threat?.id === w.threat!.id, 'the threat holds inside the window, no second')
// ── answered ──
const th = neglect(base(), ctx(t0 + 3 * D)).m
r = neglect(th, ctx(t0 + 4 * D, { clean: ['z0,0', 'z0,1', 'z1,0'] }))
ok(r.events[0]?.kind === 'answered' && !r.m.threat && r.m.calm === t0 + 4 * D, 'answered: the pressing zone cleared inside the window')
ok(!neglect(r.m, ctx(t0 + 4.5 * D)).m.threat, 'calm after an answer (no instant re-threat)')
// ── lost ──
r = neglect(th, ctx(t0 + 3 * D + R.warnDays * D))
ok(r.events[0]?.kind === 'lost' && r.m.lost?.['z0,0']?.season === S0 && !r.clean.includes('z0,0') && !r.m.threat, 'not answered in time: LOST for the season, out of the ledger')
ok(areaState(r.m, 'z0,0', true) === 'lost' && lostSet(r.m).has('z0,0'), 'the map reads it lost')
const lostM = r.m
ok(!neglect(th, ctx(t0 + 3 * D + (R.warnDays - 0.01) * D)).events.length, 'not before the window ends')
ok(!neglect(th, ctx(t0 + 9 * D, { standing: new Set(['z0,0']) })).m.lost, 'never collapses under the keeper (waits)')
r = neglect(th, ctx(t0 + 3 * D + R.warnDays * D, { clean: ['z0,1'] }))
ok(!r.m.threat && !r.m.lost && !r.events.some(e => e.kind === 'lost'), 'the threatened zone already went grey (s1 return): the threat drops, nothing is lost')
// ── a load warns, never executes ──
r = neglect(th, ctx(t0 + 40 * D, { onLoad: true }))
ok(!r.m.lost && r.events[0]?.kind === 'warn' && r.m.threat!.until === t0 + 40 * D + R.warnDays * D, 'on load an expired threat re-warns with a fresh window')
r = neglect(two, ctx(t0 + 40 * D, { onLoad: true }))
ok(r.events.length === 1 && r.events[0].kind === 'warn' && !r.m.lost, 'a long absence threatens at most one zone, loses none')
// ── the lost zone stays lost, comes back next season ──
ok(neglect(lostM, ctx(t0 + 30 * D, { clean: ['z0,0', 'z0,1'] })).clean.includes('z0,0') === false, 'a lost zone never re-enters the ledger this season')
r = neglect(lostM, ctx(t0 + 30 * D, { season: S0 + 1 }))
ok(r.events[0]?.kind === 'back' && !r.m.lost, 'next season the Core breathes it back')
// ── round trip ──
const rt = parseMap(JSON.parse(JSON.stringify({ ...lostM, threat: { id: 'a', by: 'b', at: 1, until: 2 } })))
ok(rt.lost?.['z0,0']?.season === S0 && rt.threat?.until === 2 && rt.calm === lostM.calm, 'threat + lost + calm round-trip')
ok(parseMap({ v: 1, seen: {}, lost: { x: { at: 'no' } }, threat: { id: 1 } }).lost === undefined && parseMap({ v: 1, seen: {}, threat: { id: 1 } }).threat === undefined, 'bad threat/lost read as none')
// ── the void ──
const secs = [{ id: 'a', x: 0, z: 0 }, { id: 'b', x: 100, z: 0 }]
const g: LostGround = { tileAt: (x, z) => (x >= -500 && x < 500 && z >= -500 && z < 500 ? { sections: secs, x0: -500, z0: -500, x1: 500, z1: 500 } : null), zoneOf: id => id, lost: new Set(['a']) }
ok(lostDepthAt(g, 70, 0) === 0, 'the neighbour (not lost) never moves')
ok(Math.abs(lostDepthAt(g, 50, 0)) < 1e-9 && Math.abs(lostDepthAt(g, 20, 0) - 30) < 1e-9, `0 on the bisector, metres inside it (${lostDepthAt(g, 20, 0)})`)
const g2: LostGround = { ...g, tileAt: (x, z) => ({ sections: [...secs, { id: 'c', x: -100, z: 0 }], x0: -500, z0: -500, x1: 500, z1: 500 }), lost: new Set(['a', 'c']) }
ok(lostDepthAt(g2, -40, 0) > 30, `two lost sections side by side: no border between them (${lostDepthAt(g2, -40, 0)})`)
const V = withLost(null, g)!
ok(V.carve(0, 0, 10, -5) === 10 - LOST_DEPTH && V.carve(80, 0, 10, -5) === 10 && V.isVoid(0, 0) && !V.isVoid(80, 0), 'carved deep inside, untouched outside')
ok(withLost(null, { ...g, lost: new Set() }) === null, 'nothing lost = the field as it was')
console.log(fail ? `FAIL ${fail} (pass ${pass})` : `PASS ${pass}`); process.exit(fail ? 1 : 0)
