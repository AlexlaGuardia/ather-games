// Thistledown Fair DASH oracle (BETA M233 s2) — run: npx tsx src/lib/accounts/fair-dash.test.ts
import { unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { _openAt, upsertGoogleAccount, claimUsername, deleteAccount } from './db'
import { dashBoard, recordDash } from './fair-dash'
import { DASH_TRIES, DASH_SEASON, RACERS, MIN_MS, MAX_MS, cleanTime, cleanStats, cleanSpecies, dashDay, type RaceStats } from '@/app/shimmer/open/ather/fair-dash-rules'
import { SMASH_SEASON } from '@/app/shimmer/open/ather/fair-smash-rules'
import { COURSE, COURSE_LEN, CHEER, runHeadless, startState, step, cheer, fillIn, seeded, speedIn, type Racer } from '@/app/shimmer/open/ather/fair-dash-race'
import { SPECIES_BASE } from '@/app/shimmer/open/ather/spirit-growth'
import type { Species } from '@/app/shimmer/spirits/spirit'

let failures = 0, passes = 0
const ok = (c: boolean, label: string) => { if (c) passes++; else { failures++; console.log(`  FAIL  ${label}`) } }

// ── the course: sections that test different things ──
const kinds = new Set(COURSE.map(s => s.kind))
ok(['run', 'swim', 'climb', 'glide', 'blocks'].every(k => kinds.has(k as never)), `the course has a run, a swim, a climb, a gap and blocks (${COURSE.map(s => s.kind)})`)
ok(COURSE.every((s, i) => i === 0 ? s.at === 0 : s.at === COURSE[i - 1].at + COURSE[i - 1].len) && COURSE_LEN > 60, 'the sections run end to end')

// ── species matter: each strong where its body is ──
const base = (sp: string): RaceStats => { const b = SPECIES_BASE[sp as Species]; return { pwr: b.pwr, grd: b.grd, agi: b.agi, vig: b.vig } }
const R = (sp: string, element = 'base'): Racer => ({ species: sp, element, stats: base(sp) })
const avg = (sp: string, el = 'base') => { const r = [1, 2, 3, 4, 5, 6, 7, 8].map(s => runHeadless(R(sp, el), s)); return { fin: r.reduce((a, x) => a + x.fin, 0) / r.length, by: (k: string) => r.reduce((a, x) => a + x.byKind[k as 'run'], 0) / r.length } }
const owl = avg('owl'), axo = avg('axolotl'), fox = avg('fox'), turtle = avg('turtle')
ok(owl.by('glide') < axo.by('glide') / 2 && owl.by('glide') < fox.by('glide') / 2, `fliers glide the gap (owl ${owl.by('glide').toFixed(1)} s vs fox ${fox.by('glide').toFixed(1)} s)`)
ok(axo.by('swim') < owl.by('swim') / 2 && axo.by('swim') < fox.by('swim'), `swimmers swim (axolotl ${axo.by('swim').toFixed(1)} s vs owl ${owl.by('swim').toFixed(1)} s)`)
ok(fox.by('climb') < turtle.by('climb') / 2 && fox.by('climb') < owl.by('climb'), `climbers climb (fox ${fox.by('climb').toFixed(1)} s vs turtle ${turtle.by('climb').toFixed(1)} s)`)
ok(turtle.by('blocks') < fox.by('blocks') * 0.75, `the heavy ones break blocks (turtle ${turtle.by('blocks').toFixed(1)} s vs fox ${fox.by('blocks').toFixed(1)} s)`)
const fins = (Object.keys(SPECIES_BASE) as Species[]).map(sp => avg(sp).fin)
ok(Math.max(...fins) / Math.min(...fins) < 1.2, `no species runs away with it at base stats (${Math.min(...fins).toFixed(1)}..${Math.max(...fins).toFixed(1)} s)`)
ok(avg('axolotl', 'water').by('swim') < axo.by('swim') && avg('owl', 'storm').by('glide') < owl.by('glide'), 'her element counts: Water swims, Storm flies better')
const grown: Racer = { species: 'fox', element: 'base', stats: { pwr: 200, grd: 180, agi: 210, vig: 190 } }
const gf = runHeadless(grown, 3).fin
ok(gf < fox.fin && gf > fox.fin / 2.5, `a grown spirit is faster, not a different sport (${gf.toFixed(1)} vs ${fox.fin.toFixed(1)} s)`)

// ── the cheer: a burst, then a cooldown; it ends a stop ──
let s = cheer(startState())
ok(s.burst === CHEER.burst && s.cool === CHEER.cooldown && cheer(s) === s, 'a cheer bursts, and cannot be spammed')
const v0 = step(R('fox'), startState(), 0.1, () => 0.99).d, v1 = step(R('fox'), s, 0.1, () => 0.99).d
ok(Math.abs(v1 / v0 - CHEER.mult) < 1e-6, `the burst runs her ${CHEER.mult}x`)
const stopped = { ...startState(), d: 5, stop: 1, doing: 'sniff' as const }
ok(cheer(stopped).stop === 0 && cheer(stopped).doing === 'run', 'a cheer snaps her out of a sniff')
const cheered = runHeadless(R('fox'), 4, x => x.cool <= 0).fin, plain = runHeadless(R('fox'), 4).fin
ok(cheered < plain - 2, `cheering on cooldown wins time (${plain.toFixed(1)} -> ${cheered.toFixed(1)} s)`)

// ── personality: she stops sometimes, never past MOMENTS ──
let moments = 0
for (let seed = 1; seed <= 30; seed++) { let x = startState(); const r = seeded(seed); while (x.fin == null) x = step(R('turtle'), x, 1 / 30, r); moments += x.moments; ok(x.moments <= 2, 'at most two moments a race') }
ok(moments > 0, `she stops to sniff or trips sometimes (${moments} in 30 races)`)
const hs = runHeadless(R('owl'), 5), sp = (() => { let x = startState(); const r = seeded(5); while (x.fin == null) x = step(R('owl'), x, 1 / 30, r); return x })()
ok(['run', 'swim', 'climb', 'glide', 'blocks'].every(k => Math.abs((sp.split[k as 'run'] ?? 0) - hs.byKind[k as 'run']) < 0.05), 'her splits = the time she spent in each kind of section')
ok(speedIn(R('owl'), 'swim') < speedIn(R('axolotl'), 'swim'), 'speedIn reads the species')
const f = fillIn(['fox', 'owl'], base, 9, 4)
ok(f.length === 4 && JSON.stringify(f) === JSON.stringify(fillIn(['fox', 'owl'], base, 9, 4)), 'fair entrants fill the heat, seeded')

// ── the rules ──
ok(DASH_SEASON === SMASH_SEASON && RACERS === 5 && DASH_TRIES === 3, 'five racers; the Smash season; three races a day')
ok(cleanTime(MIN_MS) === MIN_MS && cleanTime(MIN_MS - 1) === null && cleanTime(MAX_MS + 1) === null && cleanTime(12000.5) === null, 'a time is whole ms in the window')
ok(cleanStats({ pwr: 20, grd: 20, agi: 20, vig: 20 }) !== null && cleanStats({ pwr: 20, grd: 20, agi: 0, vig: 20 }) === null && cleanStats({ pwr: 'x' }) === null && cleanSpecies('dragon') === null, 'stats and species are checked')

// ── the board + ghost pool ──
const path = join(tmpdir(), `fair-dash-${process.pid}.db`)
_openAt(path)
const mk = (name: string) => { const a = upsertGoogleAccount(`g-${name}`, null, null); claimUsername(a.user_id, name); return a.user_id }
const [a, b, c] = ['dash_a', 'dash_b', 'dash_c'].map(mk)
const t0 = Date.UTC(2026, 10, 27, 12)
const body = (ms: number, spirit = 'Vulnyx', species = 'fox') => ({ ms, spirit, species, element: 'base', stats: base(species) })
ok(dashBoard(1, null, t0).top.length === 0 && dashBoard(1, a, t0).triesLeft === DASH_TRIES && dashBoard(1, a, t0).ghosts.length === 0, 'an empty board; three races; no ghosts yet')
const r1 = recordDash(a, 1, body(40000), t0)
ok(r1.ok && r1.value.best === 40000 && r1.value.triesLeft === 2, 'a race lands and spends a try')
recordDash(a, 1, body(45000), t0)
ok(dashBoard(1, a, t0).best === 40000, 'a slower time keeps the best')
const r3 = recordDash(a, 1, body(36000, 'Athowl<b>', 'owl'), t0)
ok(r3.ok && r3.value.best === 36000 && r3.value.top[0].spirit === 'Athowlb' && r3.value.triesLeft === 0, 'a faster time takes the best; the name is cleaned')
ok(!recordDash(a, 1, body(20000), t0).ok && dashBoard(1, a, t0).best === 36000, 'a fourth race that day is refused')
ok(!recordDash(b, 1, body(MIN_MS - 1), t0).ok && !recordDash(b, 1, { ...body(30000), species: 'dragon' }, t0).ok && dashBoard(1, b, t0).triesLeft === DASH_TRIES, 'a bad time or racer is refused and spends no try')
recordDash(b, 1, body(38000, 'Manalotl', 'axolotl'), t0)
const seenByB = dashBoard(1, b, t0)
ok(seenByB.top.map(r => `${r.who}:${r.ms}:${r.mine}`).join() === 'dash_a:36000:false,dash_b:38000:true', `keeper B sees both, fastest first (${seenByB.top.map(r => `${r.who}:${r.ms}`)})`)
ok(seenByB.ghosts.length === 1 && seenByB.ghosts[0].who === 'dash_a' && seenByB.ghosts[0].species === 'owl', 'B races A as a ghost: the spirit that ran A\'s best (owl)')
ok(dashBoard(1, c, t0).ghosts.length === 2 && dashBoard(1, a, t0).ghosts.every(g => g.who !== 'dash_a'), 'a keeper never races their own ghost')
ok(dashBoard(2, b, t0).top.length === 0, 'a new season, a clean board')
deleteAccount(a)
ok(dashBoard(1, b, t0).top.length === 1 && dashBoard(1, b, t0).ghosts.length === 0, 'a deleted keeper leaves the board and the pool')
ok(dashDay(t0) !== dashDay(t0 + 86400000), 'the races come back the next day')
try { unlinkSync(path) } catch { /* */ }

console.log(`fair-dash: ${passes}/${failures}`)
process.exit(failures ? 1 : 0)
