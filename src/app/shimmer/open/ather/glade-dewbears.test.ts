// glade-dewbears.ts (BETA M182): seven young ones, each its own colour, none near Blue's dew-blue, smaller than Blue; they
// start in the garden on good ground, roam it, tumble, sit and lie, crowd a keeper (pressed in, never blocking: no solids)
// and let go when the keeper leaves; the frame-cost tiers. Canon: athernyx bcdceeb (characters/gregory.md › Party).
import { readFileSync } from 'fs'
import { BLUE_COLOR, hexRgb } from './blue-look'
import { YOUNG_N, YOUNG_SCALE, YOUNG_TINTS, GARDEN, CROWD_R, CROWD_FROM, APART, ANIM_FAR, DRAW_FAR, HULL_FAR, ANIM_HALF, gardenCentre, youngStart, stepYoung, pickMode, clipOf, lod, seeded, toWorld, youngTone, crowdSlot, type Frame, type Young } from './glade-dewbears'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }

// canon: eight in his garden (Blue + seven young), only Blue dew-blue
const canon = readFileSync('/root/athernyx/CANON/characters/gregory.md', 'utf8')
ok(/seven young wild Dewbears/.test(canon) && /Blue the only dew-blue one/.test(canon), 'canon still rules seven young + only Blue dew-blue')
ok(YOUNG_N === 7 && YOUNG_TINTS.length === 7, 'seven young ones, seven colours')
ok(YOUNG_SCALE > 0.4 && YOUNG_SCALE < 0.85, `young are smaller than Blue (${YOUNG_SCALE})`)
const hue = (h: string) => { const [r, g, b] = hexRgb(h), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0; const x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (x * 60 + 360) % 360 }
const hd = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
const blueHue = hue(BLUE_COLOR.deep)
for (const t of YOUNG_TINTS) ok(hd(hue(t), blueHue) > 60, `${t} is not dew-blue (hue ${hue(t).toFixed(0)} vs Blue ${blueHue.toFixed(0)})`)
for (let i = 0; i < 7; i++) for (let j = i + 1; j < 7; j++) { const a = hexRgb(YOUNG_TINTS[i]), b = hexRgb(YOUNG_TINTS[j]); ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > 0.12, `${YOUNG_TINTS[i]} and ${YOUNG_TINTS[j]} are distinct`) }
// the neutral ramp: plates go grey (so the tint is the colour), belly white, darks kept
const pl = youngTone(0x8f / 255, 0xc5 / 255, 0xd1 / 255); ok(pl[0] === pl[1] && pl[1] === pl[2] && pl[0] >= 0.8, `a plate tone goes neutral (${pl})`)
ok(youngTone(0.95, 0.95, 0.93).every(v => v === 1), 'the belly goes white')
ok(youngTone(0.1, 0.05, 0.04)[0] === 0.1, 'darks are kept')

const bench: Frame = { x: 100, z: 50, yaw: 0.7 }
const home = toWorld(bench, 0, -4), water = toWorld(bench, 0, 9)
const good = (x: number, z: number) => Math.hypot(x - home.x, z - home.z) > 2.4 && Math.hypot(x - water.x, z - water.z) > 3
const g = gardenCentre(bench)
const bs = youngStart(bench, good)
ok(bs.length === 7, 'seven start')
ok(bs.every(b => Math.hypot(b.x - g.x, b.z - g.z) <= GARDEN.r + 1e-6 && good(b.x, b.z)), 'every one starts in the garden, on good ground')
ok(new Set(bs.map(b => `${b.x.toFixed(2)},${b.z.toFixed(2)}`)).size === 7, 'each its own spot')
ok(JSON.stringify(youngStart(bench, good)) === JSON.stringify(bs), 'the start is seeded (the same every load)')
// the mode table covers all six and sums to 100
const seen = new Set<string>(); for (let r = 0; r < 1; r += 0.005) seen.add(pickMode(r))
ok(['wander', 'run', 'idle', 'tumble', 'sit', 'lie'].every(m => seen.has(m)), `every behaviour can be picked (${[...seen]})`)

// a minute alone: they roam, sit, lie, tumble, stay in or near the garden and on good ground, never inside each other for long
const rnd = seeded(7), modes = new Set<string>(), clips = new Set<string>()
let maxOut = 0, bad = 0, moved = 0
const sim = (list: Young[], secs: number, keeper: { x: number; z: number } | null) => { for (let t = 0; t < secs; t += 1 / 30) for (const b of list) { const x0 = b.x, z0 = b.z; stepYoung(b, 1 / 30, { keeper, rnd, ok: good, bench, others: list }); moved += Math.hypot(b.x - x0, b.z - z0); modes.add(b.mode); clips.add(clipOf(b)); if (!good(b.x, b.z)) bad++; if (!keeper) maxOut = Math.max(maxOut, Math.hypot(b.x - g.x, b.z - g.z)) } }
sim(bs, 60, null)
ok(['wander', 'tumble', 'sit', 'lie'].every(m => modes.has(m)), `alone they wander, tumble, sit and lie (${[...modes]})`)
ok(['walk', 'idle', 'sit', 'lie', 'run'].every(c => clips.has(c)), `and the rig plays walk / run / idle / sit / lie (${[...clips]})`)
ok(moved > 30, `they move about (${moved.toFixed(0)} m in a minute)`)
ok(bad === 0, `never on bad ground (${bad} frames)`)
ok(maxOut < GARDEN.r + 1.6, `they stay in the garden (furthest ${maxOut.toFixed(2)} m)`)
ok(!modes.has('crowd'), 'no keeper, no crowding')

// a keeper walks in: they press in round them (zero personal space)
const k = toWorld(bench, 0.5, 3.5)
sim(bs, 8, k)
const dk = bs.map(b => Math.hypot(b.x - k.x, b.z - k.z))
ok(bs.filter(b => b.mode === 'crowd').length >= 5, `most crowd the keeper (${bs.filter(b => b.mode === 'crowd').length}/7)`)
ok(dk.filter(d => d < CROWD_R + 0.25).length >= 5, `pressed right up to them (${dk.map(d => d.toFixed(2)).join(' ')})`)
let tight = 0; for (let i = 0; i < 7; i++) for (let j = i + 1; j < 7; j++) if (Math.hypot(bs[i].x - bs[j].x, bs[i].z - bs[j].z) < APART * 0.6) tight++
ok(tight === 0, `but not inside each other (${tight} pairs)`)
ok(new Set(bs.map((_, i) => JSON.stringify(crowdSlot(k, i)))).size === 7, 'each has its own slot round the keeper')
// the keeper walks away: they let go and go back to the garden
const far = toWorld(bench, 0, -30)
sim(bs, 1, far)
ok(bs.every(b => b.mode !== 'crowd'), 'a keeper who leaves is let go')
sim(bs, 20, far)
ok(bs.every(b => Math.hypot(b.x - g.x, b.z - g.z) < GARDEN.r + CROWD_FROM), 'and they wander back home')

// two dropped on one spot step apart; one sent across bad ground (his home) stops at its edge, never walks through
const mk = (i: number, x: number, z: number, mode: Young['mode'] = 'idle'): Young => ({ i, x, z, yaw: 0, mode, t: 99, tx: x, tz: z, roll: 0, moved: 0 })
const pair = [mk(0, g.x, g.z), mk(1, g.x + 0.01, g.z)]
for (let n = 0; n < 10; n++) for (const b of pair) stepYoung(b, 1 / 30, { keeper: null, rnd, ok: good, bench, others: pair })
ok(Math.hypot(pair[0].x - pair[1].x, pair[0].z - pair[1].z) > APART * 0.9, 'two on one spot step apart')
const runner = mk(0, home.x + 3, home.z, 'run'); runner.tx = home.x - 3; runner.tz = home.z
let inside = 0; for (let n = 0; n < 120; n++) { stepYoung(runner, 1 / 30, { keeper: null, rnd: () => 0.99, ok: good, bench, others: [runner] }); if (!good(runner.x, runner.z)) inside++ }
ok(inside === 0, `never walks through bad ground (${inside} frames inside)`)

// frame cost tiers
ok(lod(5, true).anim === 1 && lod(5, true).hull, 'near and seen: full rate + hull')
ok(lod(5, false).anim === 0 && lod(5, false).draw, 'off screen: drawn (shadow-free) but no animation')
ok(lod(ANIM_HALF + 1, true).anim === 2, 'past ANIM_HALF: half rate')
ok(lod(ANIM_FAR + 1, true).anim === 0, `past ${ANIM_FAR} m: no animation`)
ok(!lod(HULL_FAR + 1, true).hull, 'past HULL_FAR: no hull')
ok(!lod(DRAW_FAR + 1, true).draw, 'past DRAW_FAR: not drawn')

console.log(`glade-dewbears: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
