// Run: npx tsx src/app/shimmer/open/ather/waymarks-m75.test.ts
// BETA M75: player-placed waymarks. Alex 11-22: "keepers place waymarks anywhere in the Wilds; each links back to the garden".
// Canon holds the line: a waymark exists only once the place is KEPT (shimmer-folds-settlements.md:32; gates.md refuses a door
// onto a place "not walked to, not kept, not owned"). So: anywhere on KEPT ground = a settlement or ground the keeper CLEARED;
// never on ground the grey still holds; never before Greg folds a garden for it to lead home to (M71 s1).
import { existsSync, readFileSync } from 'node:fs'
import { PLANT_WHY, canPlant, plant, lift, groundOf, parseWaymarks, waymarksInWorld, GREG_WAYMARK, MIN_SPACING, MAX_WAYMARKS, type Waymark } from './waymarks'
import { BIOME } from './wilds'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }

type At = Parameters<typeof canPlant>[1]
const at = (x: number, z: number, o: Partial<At> = {}): At =>
  ({ tile: 'first-wilds', x, z, biome: BIOME.woods, grounded: true, swimming: false, settlement: null, ground: 'cleared', folded: true, ...o })
const none: Waymark[] = []

// ── the canon constraint ──
const v0 = canPlant(none, at(0, 0))
ok(v0.ok, 'cleared ground outside any settlement takes a waymark (Alex 11-22: anywhere in the Wilds)')
const inf = canPlant(none, at(0, 0, { ground: 'infected' }))
ok(!inf.ok && /grey/.test(inf.why), `infected ground refuses, with the reason (${!inf.ok && inf.why})`)
const unk = canPlant(none, at(0, 0, { ground: null }))
ok(!unk.ok && unk.why === PLANT_WHY.notKept, 'ground no node owns (spread not loaded) refuses: not known to be kept')
ok(canPlant(none, at(0, 0, { ground: null, settlement: 's1' })).ok, 'a settlement is kept ground (the 11-18 rule still holds)')
ok(canPlant(none, at(0, 0, { ground: 'infected', settlement: 's1' })).ok, 'a settlement is kept by its folk even on a grey node')
// older callers (no ground / folded fields) read as folded with no cleared ground = the 11-18 settlement-only rule
ok(!canPlant(none, { tile: 't', x: 0, z: 0, biome: BIOME.woods, grounded: true, swimming: false, settlement: null }).ok, 'an older caller outside a settlement still refuses')
ok(canPlant(none, { tile: 't', x: 0, z: 0, biome: BIOME.woods, grounded: true, swimming: false, settlement: 's1' }).ok, 'an older caller inside a settlement still plants')

// ── it links back to the garden: nothing to link to before the fold ──
const pre = canPlant(none, at(0, 0, { folded: false }))
ok(!pre.ok && pre.why === PLANT_WHY.unfolded, `a keeper Greg has not folded a garden for cannot plant (${!pre.ok && pre.why})`)
ok(!canPlant(none, at(0, 0, { folded: false, settlement: 's1' })).ok, 'not even inside a settlement before the fold')

// ── the standing rules still apply on cleared ground ──
ok(!canPlant(none, at(0, 0, { grounded: false })).ok, 'mid-air refuses')
ok(!canPlant(none, at(0, 0, { swimming: true })).ok, 'swimming refuses')
ok(!canPlant(none, at(0, 0, { biome: BIOME.water })).ok, 'water refuses')
ok(!canPlant(none, at(GREG_WAYMARK.x + 10, GREG_WAYMARK.z, { biome: BIOME.meadow })).ok, "too close to Greg's waymark refuses")
let list = plant(none, { tile: 'first-wilds', x: 0, y: 1, z: 0, biome: BIOME.woods, node: 'n-1' }, 1000)
ok(!canPlant(list, at(MIN_SPACING - 1, 0, { biome: BIOME.meadow })).ok, 'spacing holds between two cleared-ground waymarks')
ok(canPlant(list, at(MIN_SPACING + 1, 0, { biome: BIOME.meadow })).ok, 'two waymarks on cleared ground, far enough apart')
ok(canPlant(plant(none, { tile: 'first-wilds', x: 500, y: 1, z: 500, biome: BIOME.woods, settlement: 's1' }, 1), at(0, 0, { biome: BIOME.meadow })).ok,
  'the one-per-settlement rule does not reach cleared ground outside it')
let full: Waymark[] = []
for (let k = 0; k < MAX_WAYMARKS; k++) full = plant(full, { tile: `t${k}`, x: 0, y: 0, z: 0, biome: (k % 6) as 0, node: `n${k}` }, k)
ok(!canPlant(full, at(0, 0, { tile: 'zz', biome: BIOME.rock })).ok, 'the total cap holds')

// ── place / travel / remove ──
const w = list[0]
ok(w.node === 'n-1' && w.settlement === undefined && w.tile === 'first-wilds' && typeof w.id === 'string', 'a planted waymark records its cleared node and tile')
ok(waymarksInWorld(list).some(k => k.id === w.id && !k.greg), 'it is a stop on the map (travel target in world coords)')
ok(lift(list, w.id).length === 0 && lift(list, 'nope').length === 1, 'lift removes exactly that waymark')

// ── persistence + migration ──
const round = parseWaymarks(JSON.stringify(list))
ok(round.length === 1 && round[0].node === 'n-1' && round[0].x === 0, 'the ledger round-trips with the node')
const old = [{ id: 'wm-a-0', tile: 'first-wilds', x: 10, y: 1, z: 10, biome: 2, made: 5 }, { id: 'wm-b-1', tile: 'first-wilds', x: 90, y: 1, z: 90, biome: 3, made: 6, settlement: 's2' }]
ok(parseWaymarks(JSON.stringify(old)).length === 2, 'pre-11-18 (no settlement) and 11-18 (settlement) saves load unchanged')
ok(parseWaymarks(JSON.stringify([...old, null, { x: 1 }, { id: 'x', tile: 't', x: 'a', z: 0 }])).length === 2, 'malformed rows are dropped alone')
ok(parseWaymarks(null).length === 0 && parseWaymarks('{oops').length === 0 && parseWaymarks('{"a":1}').length === 0, 'no / broken / non-list ledger reads as none')

// ── ground words from the spread ──
ok(groundOf('n1', new Set(['n1'])) === 'infected' && groundOf('n1', new Set()) === 'cleared' && groundOf(null, new Set()) === null && groundOf(undefined, new Set(['n1'])) === null, 'groundOf')

// ── the canon line this rule rests on (fails loudly if Magii changes it) ──
const CANON = '/root/athernyx/CANON/game/shimmer-folds-settlements.md'
if (existsSync(CANON)) ok(readFileSync(CANON, 'utf8').includes('a waymark exists only once the place is kept'), 'canon still says a waymark exists only once the place is kept')

console.log(`waymarks-m75: ${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
