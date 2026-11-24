// Run: npx tsx src/app/shimmer/open/ather/infect-tell.test.ts
// BETA M128 s2: the signed script word for word against canon, and who is told what, once.
import { existsSync, readFileSync } from 'node:fs'
import { INFECT_CARRY, INFECT_CLUE, INFECT_OPEN, INFECT_SAVED, MOREL_INFECT } from './infect-lines'
import { carried, due, freshTell, heardSay, loadTell, note, parseTell, refugees, refugeeSpots, saveTell, settlerSay, told, type Due, type Tell } from './infect-tell'
import { begin, fell, freshInfection, purge, step, CLUES, INFECT_WEEK_MS as W, type Infection } from './infection'
import { folkTalk, ASK, type FolkTalkActs } from './folk-talk'
import { folkOf, freshTrust } from './settlement-folk'
import { LISTEN } from './yarrow-teach'
import { STALL_STOPPED } from './infect-lines'
import { canTravel, DARK_WHY, LOST_WHY, type Waymark } from './waymarks'
import { infectId } from './infect-id'
import { burrfolkOf, BURRFOLK_BARKS } from './burrfolk'
import type { Network } from './network'
import { GARDEN_KEY_SPECS } from '@/lib/keeper-key-specs'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }
const same = (a: unknown, b: unknown, m: string) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`)
const net = JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network
const P = (id: string) => net.settlements.find(s => s.id === id)!, name = (id: string) => P(id)?.name ?? '', A = 's1-9', B = 's1-5', C = 's1-3'
// ── the words ──
const all = [...Object.values(MOREL_INFECT), ...INFECT_CLUE.flatMap(c => [c.folk, ...(c.obj ? [c.obj] : [])]), INFECT_CARRY, INFECT_SAVED, INFECT_OPEN]
ok(all.length === 4 + 7 + 6 + 3, `20 lines (${all.length})`); ok(!all.some(l => /hollow king|silt|nolmir|champion|—|;/i.test(l)), 'no name, no banned word')
const F = '/root/athernyx/CANON/game/shimmer-infection-story-script.md'
if (existsSync(F)) {
  const md = readFileSync(F, 'utf8'); ok(/✅ SIGNED 2026-11-24 by Alex/.test(md), 'signed')
  const row = (k: string) => { const l = md.split('\n').find(x => x.startsWith('|') && x.includes('`' + k + '`')) ?? ''; return /\*\*(.+?)\*\*/.exec(l)?.[1] ?? '' }
  for (const k of ['start', 'hold', 'second', 'lost'] as const) same(MOREL_INFECT[k], row(`MOREL_INFECT.${k}`), `canon ${k}`)
  INFECT_CLUE.forEach((c, i) => { same(c.folk, row(`INFECT_CLUE.${i + 1}.folk`), `canon clue ${i + 1}`); if (c.obj) same(c.obj, row(`INFECT_CLUE.${i + 1}.obj`), `canon obj ${i + 1}`) })
  same(INFECT_CARRY, row('INFECT_CARRY.open'), 'canon carry'); same(INFECT_SAVED, row('INFECT_SAVED.thanks'), 'canon thanks'); same(INFECT_OPEN, row('INFECT_OPEN.narrator'), 'canon opening')
  ok(!all.includes(row('INFECT_OPEN.morel')), 'E2 is cut')
} else console.log('SKIP canon: not on this machine')
const H = '/root/athernyx/CANON/game/shimmer-lines-batch-2026-11-24h.md'
if (existsSync(H)) { const md = readFileSync(H, 'utf8'), mains = md.split('\n').filter(l => l.startsWith('| ') && l.includes('**')).map(l => /\*\*(.+?)\*\*/.exec(l)![1]); ok(/✅ SIGNED 2026-11-24 by Alex/.test(md), '24h signed'); same([LOST_WHY, STALL_STOPPED], mains, 'canon 24h') }
{ const w = (settlement?: string) => ({ id: 'w', tile: 't', x: 0, y: 0, z: 0, biome: 2, made: 0, settlement, node: settlement ? undefined : 'n1' }) as unknown as Waymark, dark = new Set([infectId(A), infectId(B), 'n1']), why = (x: Waymark) => { const v = canTravel(x, dark, [A]); return v.ok ? '' : v.why }
  same([why(w(A)), why(w(B)), why(w())], [LOST_WHY, DARK_WHY, DARK_WHY], 'lost, held, plain grey ground') }
// ── pings ──
const drain = (t: Tell, s: Infection): [Tell, Due[]] => { const out: Due[] = []; for (let d = due(t, s, name); d && out.length < 50; d = due(t, s, name)) { out.push(d); t = told(t, d) } return [t, out] }
const go = (s: Infection, now: number, played = 0) => step(s, { season: 1, now, played, known: [A, B, C], rng: () => 0 }).s
const t0 = 5e11; let s = begin(freshInfection(1), A, t0), t = note(freshTell(1), s)
ok(note(t, s) === t, 'note: nothing new = the same object'); ok(due(freshTell(1), freshInfection(1), name) === null, 'nothing infected = nothing said')
let d: Due[]; [t, d] = drain(t, s); same(d.map(x => [x.text, x.morel]), [[`Hollow ground is spreading at ${name(A)}. Its waymark has gone dark.`, true]], 'start')
;[t, d] = drain(parseTell(JSON.parse(JSON.stringify(t)), 1), s); same(d, [], 'a reload says nothing twice')
s = go(s, t0 + W / 2); [t, d] = drain(t, s); same(d.map(x => x.text), [`${name(A)} is still holding. Trade has stopped there.`], 'hold')
s = go(s, t0 + W); [t, d] = drain(t, s); same(d.map(x => x.text), [`That is a long while for ${name(A)}. It will not hold much longer.`], 'second')
same(drain(freshTell(1), s)[1].map(x => x.key), [`start:${A}`, `hold:${A}`, `second:${A}`], 'fired before this shipped: each still told, in order')
ok(due(freshTell(1), s, () => '') === null, 'a place with no name yet: it waits')

// saved
const won = fell(s, A, t0 + W).s; const w = drain(t, won); same(w[1].map(x => [x.text, x.morel]), [[INFECT_CLUE[0].obj, false]], 'the big one falls: clue 1\'s object'); same(drain(w[0], won)[1], [], 'once')
same(drain(freshTell(1), won)[1], [], 'a saved place\'s old pings are not told')
// lost
for (let k = 1; s.active; k++) s = go({ ...s, active: s.active && { ...s.active, online: W } }, t0 + W + 60000 * k, 15000)
same(s.lost, [A], 'lost'); [t, d] = drain(t, s); same(d.map(x => x.text), [`${name(A)} is lost to Hollow ground. Its folk got out safe.`], 'lost, told once'); same(drain(freshTell(1), s)[1].map(x => x.key), [`lost:${A}`], 'lost before this shipped: its lost line only')
// ── the carried clue ──
same(carried(s), [1], 'clue 1 is carried'); ok(refugees(t, s, () => folkOf(P(A), 1)).length === 0, 'nobody waits at a place that holds nothing')
let s2 = begin(s, B, t0 + 3 * W); t = note(t, s2); same([s2.active!.clue, carried(s2)], [2, [1]], 'the next place holds clue 2, clue 1 carried')
const r = refugees(t, s2, id => folkOf(P(id), 1)); same([r.length, r[0].from, r[0].clue, r[0].lines], [1, A, 1, [INFECT_CARRY, INFECT_CLUE[0].folk]], 'A\'s folk at B: opener, then clue 1'); ok(folkOf(P(A), 1).some(f => f.id === r[0].id && f.name === r[0].name), 'one of A\'s own')
let t2 = heardSay(t, { lines: r[0].lines, clues: [1], met: A }, 1); same([t2.heard, t2.met], [[], [A]], 'opener heard, not yet the clue'); t2 = heardSay(t2, { lines: r[0].lines, clues: [1], met: A }, 2); same(t2.heard, [1], 'clue heard')
same(refugees(t2, s2, id => folkOf(P(id), 1))[0].lines, [INFECT_CLUE[0].folk], 'met: the clue alone')
same(settlerSay(t, s2, B, true, r)!.lines, [INFECT_CLUE[1].folk], 'B\'s own folk: clue 2 only'); ok(settlerSay(t, s2, C, true, r) === null, 'another place: nothing')
same(settlerSay(t, s2, B, true, [])!.lines, [INFECT_CARRY, INFECT_CLUE[0].folk], 'none of A\'s folk can come: B\'s spokesman carries it'); same(settlerSay(t, s2, B, false, [])!.lines, [INFECT_CLUE[1].folk], '...only he')
const sp = refugeeSpots(P(B), r, [{ x: P(B).x, z: P(B).z + 9 }], null); ok(sp.length === 1 && Math.hypot(sp[0].x - P(B).x, sp[0].z - P(B).z) < 14 && Math.hypot(sp[0].x - P(B).x, sp[0].z - P(B).z - 9) >= 2.4, 'a spot on the green, clear of the folk')
// ── saved with clues unheard ──
s2 = fell(s2, B, t0 + 3 * W + 1).s; same(s2.told, 2, 'both told'); const say = settlerSay(t2, s2, B, false, [])!; same(say.lines, [INFECT_SAVED, INFECT_CLUE[1].folk], 'thanks, then the clue nobody asked for')
t2 = heardSay(t2, say, 1); same([t2.heard, t2.met], [[1], [A, B]], 'the thanks seen'); same(settlerSay(t2, s2, B, false, [])!.lines, [INFECT_CLUE[1].folk], 'the clue still waits'); t2 = heardSay(t2, settlerSay(t2, s2, B, false, [])!, 1); ok(settlerSay(t2, s2, B, true, []) === null, 'then the plain hello')
// ── the seven, the opening, the purge ──
{ let x = freshInfection(1), tt = freshTell(1); const ids = net.settlements.filter(p => /^s1-/.test(p.id)).map(p => p.id); const objs: string[] = []; let opens = 0
  for (let k = 0; k < CLUES; k++) { x = begin(x, ids[k], t0); tt = note(tt, x); same(settlerSay(tt, x, ids[k], false, [])!.lines, [INFECT_CLUE[k].folk], `place ${k + 1}: clue ${k + 1}`); x = fell(x, ids[k], t0).s; const [a, q] = drain(tt, x); tt = a; objs.push(...q.filter(y => y.key.startsWith('obj')).map(y => y.text)); opens += q.filter(y => y.text === INFECT_OPEN).length }
  same(objs, INFECT_CLUE.slice(0, 6).map(c => c.obj), 'six objects in order'); ok(opens === 1 && due(tt, x, name) === null, 'the opening, once')
  ok(due(parseTell(JSON.parse(JSON.stringify(tt)), 2), purge(x, 2), name) === null, 'not again next season') }
{ const lostOne = { ...freshInfection(1), lost: [A], told: 0, assigned: 1 }, n = begin(purge(lostOne, 2), 's2-1', t0), nt = parseTell({ ...freshTell(1), said: ['lost:x'], heard: [3], clueOf: { [A]: 1 }, met: [A] }, 2)
  same([nt.said, nt.clueOf, nt.met, nt.heard], [[], {}, [], [3]], 'the purge: places go, heard clues stay'); same([n.active!.clue, carried(n), refugees(nt, n, () => folkOf(P(A), 1)).length], [2, [1], 0], 'carried across the season, its folk\'s place gone')
  same(settlerSay(nt, n, 's2-1', true, [])!.lines, [INFECT_CARRY, INFECT_CLUE[0].folk], 'told by the place\'s spokesman') }
// ── the talk ──
{ const folk = folkOf(P(A), 1), act = (seen: unknown[]): FolkTalkActs => ({ go: x => { seen.push(x) }, give: () => {}, recruit: () => {}, bye: () => {} }), c = { folk, home: folk, trust: freshTrust(), have: () => 0, room: 1 }, st = { fid: folk[0].id, screen: 'hello' as const }, seen: any[] = []
  const plain = folkTalk(c, st, act([])); ok(plain.line === folk[0].dream, 'off: the dream'); same(folkTalk({ ...c, infect: null }, st, act([])), plain, 'null = the old talk')
  const one = folkTalk({ ...c, infect: { lines: ['X'] } }, st, act([])); ok(one.line === 'X' && one.options.some(o => o.label === ASK.inspect), 'one line: in the hello\'s place, its answers kept')
  const two = folkTalk({ ...c, infect: { lines: ['X', 'Y'] } }, st, act(seen)); same([two.line, two.options.map(o => o.label)], ['X', [LISTEN, ASK.bye]], 'two lines: one a screen'); two.options[0].pick(); ok(folkTalk({ ...c, infect: { lines: ['X', 'Y'] } }, seen[0], act([])).line === 'Y', 'then the next')
  { const b = burrfolkOf(P(A), 1, folk)!, at = { fid: b.id, screen: 'hello' as const }; same([folkTalk({ ...c, burr: b, stopped: true }, at, act([])).line, folkTalk({ ...c, burr: b }, at, act([])).line], [STALL_STOPPED, BURRFOLK_BARKS.greet], 'the stall, stopped and open') }
  const ref = folkTalk({ ...c, infect: { lines: ['X', 'Y'] }, refugee: true }, { fid: 'gone', screen: 'hello', beat: 1 }, act([])); same([ref.line, ref.options.map(o => o.label)], ['Y', [ASK.bye]], 'a refugee: the lines and goodbye') }
// ── the save ──
{ const mem = new Map<string, string>(); (globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k), key: () => null, length: 0 }
  same(loadTell(1), freshTell(1), 'empty'); ok(mem.size === 0, 'reading writes nothing'); saveTell(t2); same(loadTell(1), t2, 'round trip'); same(parseTell({ v: 1, season: 1, said: 'x', clueOf: { a: 99 }, heard: [0, 8, 2, 2] }, 1), { ...freshTell(1), heard: [2] }, 'rubbish is dropped')
  ok(GARDEN_KEY_SPECS.some(k => k.base === 'ather.infection-told.v1'), 'a garden key') }
{ const u = readFileSync(new URL('./use-infection.tsx', import.meta.url), 'utf8'); ok(/const ready = on && /.test(u) && (u.match(/if \(!ready/g) ?? []).length >= 4, 'the one switch gates it') }
console.log(`infect-tell: ${pass}/${fail}`); process.exit(fail ? 1 : 0)
