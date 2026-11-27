// Thistledown Fair tents + SMASH oracle (BETA M233 s1) — run: npx tsx src/lib/accounts/fair-smash.test.ts
import { readFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { _openAt, upsertGoogleAccount, claimUsername, deleteAccount } from './db'
import { smashBoard, recordSmash } from './fair-smash'
import { SMASH_TRIES, SMASH_SEASON, MAX_HIT, cleanHit, smashDay } from '@/app/shimmer/open/ather/fair-smash-rules'
import { pickTents, tentsOf, tentAtDoor, tentLabel, fairDoor, TENT_PLAN, TENT_SPACING, SEASON, type Network } from '@/app/shimmer/open/ather/network'
import { smashHit, smashMove } from '@/app/shimmer/open/ather/fair-smash'

let failures = 0, passes = 0
const ok = (c: boolean, label: string) => { if (c) passes++; else { failures++; console.log(`  FAIL  ${label}`) } }

// ── the tents: the baked season's network ──
const net = JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network
const T = tentsOf(net)
const count = (c: string, l?: string) => T.filter(t => t.contest === c && (l === undefined || t.level === l)).length
ok(T.length === TENT_PLAN.length && count('clash') >= 5 && count('clash', 'easy') === 2 && count('clash', 'average') === 2 && count('clash', 'difficult') === 1 && count('dash') === 1 && count('smash') === 1,
  `the season's plan: 5 Clash (2 easy, 2 average, 1 difficult), 1 Dash, 1 Smash (${T.map(t => tentLabel(t)).join(', ')})`)
ok(T.every(t => (t.contest === 'clash') === !!t.level), 'only Clash tents carry a difficulty')
ok(pickTents({ ...net, season: 1 }, () => true, [{ contest: 'smash' }, { contest: 'dash' }]).length === 2, 'the plan is data: a shorter plan pitches fewer tents')
ok(!!net.fair && T.some(t => t.x === net.fair!.x && t.z === net.fair!.z), 'the first big top still stands where it stood')
ok(T.every((a, i) => T.every((b, j) => i === j || Math.hypot(a.x - b.x, a.z - b.z) >= TENT_SPACING)), `the tents are spread (>= ${TENT_SPACING} m apart)`)
const pathD = (x: number, z: number) => Math.min(...net.paths.flatMap(p => p.pts.map(q => Math.hypot(q[0] - x, q[1] - z))))
ok(T.every(t => pathD(t.x, t.z) < 60 && pathD(fairDoor(t).x, fairDoor(t).z) < 40), 'each stands beside a path, its door toward it')
ok(T.every(t => { const d = fairDoor(t); return tentAtDoor(net, d.x, d.z) === t }) && !tentAtDoor(net, T[0].x + 200, T[0].z), 'each door answers its own tent, and nowhere else')
const again = pickTents(net, () => true), again2 = pickTents(net, () => true)
ok(JSON.stringify(again) === JSON.stringify(again2), 'same season, same tents (seeded)')
ok(pickTents({ ...net, season: 2 }, () => true).map(t => tentLabel(t)).join() !== again.map(t => tentLabel(t)).join(), 'which spot holds which contest changes by season')
ok(tentsOf({ ...net, tents: undefined }).length === 1 && tentsOf({ ...net, tents: undefined })[0].contest === 'smash' && tentsOf({ ...net, tents: undefined, fair: null }).length === 0, 'an older bake: the lone big top holds Smash')
ok(SMASH_SEASON === SEASON, 'the board season is the network season')

// ── the rules ──
const canon = readFileSync('/root/athernyx/CANON/game/thistledown-fair-script.md', 'utf8')
ok(/"Three tries each\. Nobody counts the misses\."/.test(canon) && SMASH_TRIES === 3, 'three tries a day: the signed bark B3')
ok(cleanHit(5) === 5 && cleanHit(0) === null && cleanHit(1.5) === null && cleanHit(MAX_HIT + 1) === null && cleanHit('x') === null, 'a hit is a whole number 1..MAX_HIT')

// ── the hit: the battle system's damage ──
const fixed = () => 0.5   // no crit (0.5 > 0.0625), mid spread
const fresh = smashHit('fox', undefined, 'base', fixed), grown = smashHit('fox', { form: 'base', g: {}, plays: 0, grown: 20 }, 'base', fixed)
ok(fresh.hit >= 1 && grown.hit > fresh.hit * 3, `a grown spirit hits far harder (fresh ${fresh.hit}, grown 20: ${grown.hit})`)
const trained = smashHit('fox', { form: 'base', g: { pwr: 20 }, plays: 0, grown: 20 }, 'base', fixed)
ok(smashMove('fox').power >= 40 && (trained.hit >= grown.hit), `her hardest move swings (${smashMove('fox').name}); training never lowers a hit (${grown.hit} -> ${trained.hit})`)
ok(smashHit('fox', undefined, 'base', () => 0.01).crit, 'a crit roll crits')

// ── the board ──
const path = join(tmpdir(), `fair-smash-${process.pid}.db`)
_openAt(path)
const mk = (name: string) => { const a = upsertGoogleAccount(`g-${name}`, null, null); claimUsername(a.user_id, name); return a.user_id }
const [a, b] = ['smash_a', 'smash_b'].map(mk)
const t0 = Date.UTC(2026, 10, 27, 12)
ok(smashBoard(1, null, t0).top.length === 0 && !smashBoard(1, null, t0).signedIn && smashBoard(1, a, t0).triesLeft === SMASH_TRIES, 'an empty board; three tries')
const r1 = recordSmash(a, 1, { hit: 40, spirit: 'Vulnyx' }, t0)
ok(r1.ok && r1.value.best === 40 && r1.value.triesLeft === 2, 'a swing lands and spends a try')
recordSmash(a, 1, { hit: 25, spirit: 'Vulnyx' }, t0)
ok(smashBoard(1, a, t0).best === 40, 'a lower hit keeps the best')
const r3 = recordSmash(a, 1, { hit: 55, spirit: 'Vulnore<script>' }, t0)
ok(r3.ok && r3.value.best === 55 && r3.value.top[0].spirit === 'Vulnorescript' && r3.value.triesLeft === 0, 'a higher hit takes the best; the spirit name is cleaned')
const r4 = recordSmash(a, 1, { hit: 999, spirit: 'x' }, t0)
ok(!r4.ok && smashBoard(1, a, t0).best === 55, 'a fourth swing that day is refused')
ok(recordSmash(a, 1, { hit: 30, spirit: 'x' }, t0 + 86400000).ok && smashDay(t0 + 86400000) !== smashDay(t0), 'the tries come back the next day')
ok(!recordSmash(b, 1, { hit: MAX_HIT + 5 }, t0).ok && smashBoard(1, b, t0).triesLeft === SMASH_TRIES, 'a hit past the cap is refused and spends no try')
recordSmash(b, 1, { hit: 70, spirit: 'Hexl' }, t0)
const seenByB = smashBoard(1, b, t0)
ok(seenByB.top.map(r => `${r.who}:${r.best}:${r.mine}`).join() === 'smash_b:70:true,smash_a:55:false', `keeper B sees both, best first (${seenByB.top.map(r => `${r.who}:${r.best}`)})`)
ok(smashBoard(2, b, t0).top.length === 0, 'a new season, a clean board')
deleteAccount(a)
ok(smashBoard(1, b, t0).top.length === 1, 'a deleted keeper leaves the board')
try { unlinkSync(path) } catch { /* */ }

console.log(`fair-smash: ${passes}/${failures}`)
process.exit(failures ? 1 : 0)
