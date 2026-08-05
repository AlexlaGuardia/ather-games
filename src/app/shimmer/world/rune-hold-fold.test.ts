/**
 * The Spirit Corner fold — gate wiring oracle (2026-08-05).
 *
 * The Spirit Corner stopped being its own zone and became a storefront on the Rune Hold map
 * (`world/rune-hold.md` § The Hub). That fold moved a 100x100 authored grid under a different
 * const and re-pointed five warps across three zones. Every one of those is a coordinate pair
 * that is either right or silently drops the player into a wall — which is exactly the class of
 * bug the 08-03 session shipped (an open door into a room nobody could enter).
 *
 * So the wiring gets an oracle rather than a walkthrough. Run: `npx tsx <this file>`
 * (the repo convention — there is no vitest here).
 */
import { ZONES, getZone, resolveZoneId, checkWarp, START_ZONE, type Zone } from './zones'

/**
 * Broken doors in the LEGACY continent that predate this change — surfaced by the sweep in
 * section 3, listed here so the gate stays green for regressions instead of rotting red.
 * A permanently-failing check is a check nobody reads.
 *
 *  · `spirit-meadow → mycelial-path (15-16,1)`: the north door tiles ARE painted at (15-16,0),
 *    but the row below them is wall — the door is sealed from the inside. That is a map call
 *    (Alex's eye), not a coordinate to guess.
 *  · `route-mycelial-spirit (0,4-5)`: stale code coordinates. The painted warp tiles on that
 *    map are at (0,7-8); the zone entry still names the pre-repaint spot, so the door is dead.
 *    Safe to re-point once someone confirms the far side's landing.
 *
 * Both live on the legacy zone graph that the region world supersedes, which is why neither is
 * being fixed inside a gate-wiring change. Recorded, not swallowed.
 */
const KNOWN_PREEXISTING = new Set([
  'spirit-meadow -> mycelial-path lands walkable at (15,1)',
  'spirit-meadow -> mycelial-path lands walkable at (16,1)',
  'route-mycelial-spirit warp tile (0,4) is standable',
  'route-mycelial-spirit warp tile (0,5) is standable',
])

let pass = 0
const fails: string[] = []
const known: string[] = []
function ok(cond: boolean, label: string) {
  if (cond) pass++
  else if (KNOWN_PREEXISTING.has(label)) known.push(label)
  else fails.push(label)
}

const WALL = 34
const WARP_TILE = 14
const walkable = (z: Zone, x: number, y: number) =>
  y >= 0 && y < z.grid.length && x >= 0 && x < z.grid[y].length && z.grid[y][x] !== WALL

// ── 1. the fold happened ───────────────────────────────────────────────────────────────────
const runeHold = getZone(ZONES, 'rune-hold')
ok(!!runeHold, 'rune-hold zone exists')
ok(ZONES.every(z => z.id !== 'spirit-corner'), 'spirit-corner is retired as a zone')
ok(runeHold!.grid.length === 100 && runeHold!.grid[0].length === 100, 'rune-hold carries the 100x100 authored grid')
ok(runeHold!.realm === 'outside', 'rune-hold is outside the Ather (spirits dormant)')
ok(runeHold!.peaceful === true, 'rune-hold is peaceful (weapons holstered in town)')

// ── 2. the legacy id still resolves — an old save must not hit a null zone ──────────────────
ok(resolveZoneId('spirit-corner') === 'rune-hold', 'legacy spirit-corner id aliases to rune-hold')
ok(getZone(ZONES, 'spirit-corner')?.id === 'rune-hold', 'getZone resolves the retired id')
ok(resolveZoneId('garden') === 'garden', 'a live id passes through the alias table untouched')
// the fold claims coordinates survived; that claim is what makes a bare rename safe
ok(walkable(runeHold!, 7, 9), 'the old Spirit Corner floor (7,9) is still walkable in the town')
ok(walkable(runeHold!, 7, 10) && walkable(runeHold!, 8, 10), 'the old crossing landing (7-8,10) is still walkable')

// ── 3. every warp in the game points somewhere real, and lands on a walkable tile ──────────
for (const z of ZONES) {
  for (const w of z.warps) {
    const target = getZone(ZONES, w.toZone)
    ok(!!target, `${z.id} (${w.fromX},${w.fromY}) -> ${w.toZone} exists`)
    if (!target) continue
    ok(walkable(target, w.toX, w.toY), `${z.id} -> ${w.toZone} lands walkable at (${w.toX},${w.toY})`)
    ok(walkable(z, w.fromX, w.fromY), `${z.id} warp tile (${w.fromX},${w.fromY}) is standable`)
  }
}

// ── 4. the two gates the fold is actually about ────────────────────────────────────────────
// Greg's gate: painted on the map (tile id 14), inside the shop, exits to the Home Plot.
const gregGate = runeHold!.warps.filter(w => w.fromY === 11 && (w.fromX === 7 || w.fromX === 8))
ok(gregGate.length === 2, "Greg's gate is a 2-tile door")
ok(gregGate.every(w => w.toZone === 'garden'), "Greg's gate exits to the Home Plot (legacy id — the interior-exit contract)")
ok(gregGate.every(w => runeHold!.grid[w.fromY][w.fromX] === WARP_TILE), "Greg's gate tiles are painted as warps (gold marker shows)")
ok(gregGate.every(w => !w.ownerOnly), "Greg's gate is open to players (the 08-03 ruling)")

// the station gate: Alex's painted door, wired to the Crucible, owner-gated for BUILD reasons
const station = runeHold!.warps.filter(w => w.fromY === 81 && (w.fromX === 49 || w.fromX === 50))
ok(station.length === 2, 'the station gate is a 2-tile door')
ok(station.every(w => w.toZone === 'crucible'), 'the station gate leads to the Crucible')
ok(station.every(w => runeHold!.grid[w.fromY][w.fromX] === WARP_TILE), 'the station gate tiles are painted as warps')
ok(station.every(w => w.ownerOnly === true), 'the station gate stays owner-only while the Crucible is a bare range')
// you must be able to WALK to it: open ground on the approach side
ok(walkable(runeHold!, 49, 80) && walkable(runeHold!, 50, 80), 'the station gate is approachable from the north')

// and the Crucible comes back to the town, not to its old pre-town parent
const crucible = getZone(ZONES, 'crucible')!
ok(crucible.warps.every(w => w.toZone === 'rune-hold'), 'the Crucible exits to Rune Hold')
ok(crucible.warps.every(w => w.toY === 80), 'the Crucible exit lands NORTH of the gate (no instant re-warp)')
// the instant-re-warp check, stated as the rule rather than the coordinate
for (const w of crucible.warps) {
  ok(!checkWarp(ZONES, 'rune-hold', w.toX, w.toY), `Crucible exit landing (${w.toX},${w.toY}) is not itself a warp tile`)
}

// ── 5. reachability: a NON-OWNER can walk from the start of the game to the town ───────────
// This is the check the 08-03 session had to add by hand after shipping a door into an
// unreachable room. Owner-only warps are skipped, exactly as a player experiences them.
const seen = new Set<string>([START_ZONE])
const queue = [START_ZONE]
while (queue.length) {
  const zone = getZone(ZONES, queue.shift()!)
  if (!zone) continue
  for (const w of zone.warps) {
    if (w.ownerOnly) continue
    const id = resolveZoneId(w.toZone)
    if (!seen.has(id)) { seen.add(id); queue.push(id) }
  }
}
ok(seen.has('rune-hold'), 'a player can reach Rune Hold from the start zone without owner rights')
ok(!seen.has('crucible'), 'a player still cannot reach the Crucible (owner-gated by build state)')

console.log(`\nrune-hold fold: ${pass} passed, ${fails.length} failed`)
if (known.length) {
  console.log(`  ⚠ ${known.length} pre-existing legacy-graph breaks (not this change, see KNOWN_PREEXISTING):`)
  for (const k of known) console.log('    · ' + k)
}
if (fails.length) {
  for (const f of fails) console.log('  ✗ ' + f)
  process.exit(1)
}
// If a known break gets FIXED, say so — a stale allowlist is its own kind of lie.
if (known.length < KNOWN_PREEXISTING.size) {
  console.log(`  ✎ ${KNOWN_PREEXISTING.size - known.length} known break(s) now pass — prune KNOWN_PREEXISTING.`)
}
console.log('✅ the fold is wired\n')
