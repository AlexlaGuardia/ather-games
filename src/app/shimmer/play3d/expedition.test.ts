/**
 * THE EXPEDITION (2026-09-29): the generated floor is a place you can always finish, the puzzle is a shortcut and never
 * a lock, and the loot odds hold. Run: `npx tsx src/app/shimmer/play3d/expedition.test.ts`
 */
import { ELITE_AGGRO } from './expedition-run'
import { generateExpedition, rollCache, lootRng, EXP_FLOOR, EXP_WALL, EXP_WARP, EXP_SIZE, TERRACE_TIERS, HELD_CHANCE, ELITE_HUNTER } from './expedition'
import { RANGE_HUNTER } from '../engine/hunter-ai'
import { readFileSync } from 'node:fs'
import { ZONES, rerollExpedition } from '../world/zones'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }

/** Walk the floor as a keeper without movement casts: step to a 4-neighbour that is not a wall, up at most one tier. */
function reach(L: ReturnType<typeof generateExpedition>): Set<string> {
  const seen = new Set<string>([`${L.start.x},${L.start.z}`]), q = [[L.start.x, L.start.z]]
  while (q.length) {
    const [x, z] = q.shift()!
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz, k = `${nx},${nz}`
      if (seen.has(k) || nx < 0 || nz < 0 || nx >= EXP_SIZE || nz >= EXP_SIZE) continue
      if (L.grid[nz][nx] === EXP_WALL) continue
      if (L.heights[nz][nx] - L.heights[z][x] > 1) continue   // a cliff: only a cast clears it
      seen.add(k); q.push([nx, nz])
    }
  }
  return seen
}

for (const seed of [1, 7, 42, 1337, 90210, 424242, 5, 99]) {
  const L = generateExpedition(seed)
  const walk = reach(L)
  ok(L.grid.length === EXP_SIZE && L.grid.every((r) => r.length === EXP_SIZE), `seed ${seed}: the floor is ${EXP_SIZE} square`)
  ok(L.grid[L.exit.z][L.exit.x] === EXP_WARP && walk.has(`${L.exit.x},${L.exit.z}`), `★ seed ${seed}: the exit is reachable on foot, no cast needed`)
  ok(L.caches.every((c) => walk.has(`${c.x},${c.z}`)), `★★ seed ${seed}: every cache, the puzzle one too, is reachable the long way (${L.caches.length} caches)`)
  const t = L.caches.find((c) => c.puzzle)
  ok(!!t && L.heights[t.z][t.x] === TERRACE_TIERS && !!L.stair && L.heights[L.stair.z][L.stair.x] === 1, `seed ${seed}: the puzzle cache is on the terrace, with its one-tier stair`)
  // the terrace's room side IS a cliff: from the room floor beside it, a walker cannot step up
  // the room side of the terrace is a two-tier drop to open floor (the shortcut is a cast)
  const cliff = t && [[1, 0], [0, 1]].some(([dx, dz]) => L.grid[t.z + dz]?.[t.x + dx] === EXP_FLOOR && L.heights[t.z + dz][t.x + dx] === 0)
  ok(!!cliff, `seed ${seed}: the terrace stands two tiers over the room (the shortcut is a cast)`)
  ok(L.elites.length >= 3 && L.elites.every((e) => L.grid[Math.floor(e.z)][Math.floor(e.x)] === EXP_FLOOR), `seed ${seed}: ${L.elites.length} elites, each on open floor`)
  ok(L.grid[L.start.z][L.start.x] === EXP_FLOOR, `seed ${seed}: you start on open floor`)
}
{ // ★ a sweep: 400 floors, every one finishable on foot, every cache reachable the long way
  let bad = 0
  for (let seed = 1000; seed < 1400; seed++) {
    const L = generateExpedition(seed), w = reach(L)
    if (!w.has(`${L.exit.x},${L.exit.z}`) || !L.caches.every((c) => w.has(`${c.x},${c.z}`)) || !L.caches.some((c) => c.puzzle)) bad++
    if (L.elites.some((e) => Math.hypot(e.x - L.start.x, e.z - L.start.z) < ELITE_AGGRO + 2)) bad++
  }
  ok(bad === 0, `★★ 400 floors: every exit and every cache reachable without a cast, each with a puzzle cache, no elite within reach of where you land (${bad} bad)`)
}
ok(JSON.stringify(generateExpedition(42)) === JSON.stringify(generateExpedition(42)), 'the same seed is the same floor (a party would agree)')
ok(JSON.stringify(generateExpedition(42).grid) !== JSON.stringify(generateExpedition(43).grid), 'a new seed is a new floor')

// loot: the puzzle cache is the only one that can hold, at about HELD_CHANCE
const r = lootRng(12345)
let held = 0, groundHeld = 0
for (let i = 0; i < 4000; i++) { if (rollCache(r, true).held) held++; if (rollCache(r, false).held) groundHeld++ }
ok(groundHeld === 0, 'only a PUZZLE cache can hold together')
ok(Math.abs(held / 4000 - HELD_CHANCE) < 0.025, `★ a puzzle cache holds about ${HELD_CHANCE * 100}% of the time (${(held / 40).toFixed(1)}%): usually it breaks`)
ok(ELITE_HUNTER.hp >= RANGE_HUNTER.hp * 3, 'an elite is a real fight (several times the range hunter)')

// the host wiring
const zone = ZONES.find((z) => z.id === 'expedition')!
const L2 = rerollExpedition(77)
ok(!!zone && zone.realm === 'outside' && !zone.peaceful && zone.grid === L2.grid && zone.heights === L2.heights, '★ the expedition is an armed zone, and a reroll rewrites its floor + tiers in place')
ok(zone.warps.length === 1 && zone.warps[0].toZone === 'travelers-station' && zone.warps[0].fromX === L2.exit.x, 'its exit goes home to the Station')
const p3 = readFileSync(new URL('./Shimmer3D.tsx', import.meta.url), 'utf8')
ok(p3.includes(': zone.heights ? zone.heights.map((row) => [...row])'), 'a generated zone brings its own tiers (the terrace stands)')
ok(p3.includes('const carried = coopParty ? 0 : takeWrackForRun()') && p3.includes('holdRef.current.wrack += carried'), '★ banked wrack is carried into a solo Breach run')
ok(p3.includes('bankWrack(d.n); expRun.wrack += d.n'), 'wrack banks the moment it is picked up (a fall never loses it)')
ok(p3.includes('if (zoneIdRef.current === EXP_ZONE) { expFell.current = true; return }'), 'a fall in an expedition ends it and takes you home')
ok(p3.includes("createFleet(roster, L.seed, ELITE_HUNTER)") && p3.includes('if (heldIdx.has(r.member.index)) continue'), 'elites are the fleet brain with an elite body, and hold their room until you come near')
ok(p3.includes("if (loot.held) { recordFind({ kind: 'held-cache'"), 'a cache that holds is recorded for the garden, never lost')
ok(p3.includes('steady={props.zone.id === EXP_ZONE ? EXP_STEADY_HOUR : undefined} />') && (p3.match(/steady=\{props\.zone\.id === EXP_ZONE/g) || []).length === 2 && p3.includes('const p = steady ?? dayProgress()'), '★ an expedition keeps one steady light: the sun AND the sky/fog ignore the day clock there')

console.log(`expedition: ${pass} passed, ${fails.length} failed`)
if (fails.length) { for (const f of fails) console.log('  ✗ ' + f); process.exit(1) }
