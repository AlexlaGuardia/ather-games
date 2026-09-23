// The TWO-TALL STATIONS — the second cell, and the rack that lives in it.
// Run: npx tsx src/app/shimmer/voxel3d/station-tall.test.ts
//
// ★ WHY THIS FILE EXISTS BESIDE `station-models.test.ts`. That file owns the MODEL contract (a
// tall model's ceiling, and the two-way agreement between `tall` and `TALL_STATIONS`). This one
// owns the half that has no pure module to test: a tall station is two cells, and every rule that
// keeps them one object — place both, break both, spill the rack, never strand its record — lives
// inside `VoxelWorld.tsx`. Those are asserted as SOURCE FACTS, the same way §3 asserts the mesher
// wiring, because the alternative is asserting nothing at all about the half that can actually
// lose a keeper's items.
//
// ⚠ WHAT A GREP CAN AND CANNOT SEE. It can see that a call exists and that two calls are in the
// right ORDER; it cannot see that they run. So the ordering assert below (contents read BEFORE the
// write that deletes them) is the one this file most needs and the one most worth distrusting —
// it is a statement about the text, and the behaviour it stands for is the spill, which is checked
// for real against `adoptRack`/`createRack` further down.
import { readFileSync } from 'node:fs'
import { codeOnly, noComments, justBefore } from '../testing/guard'
import { MAT, TALL_STATIONS, isTallStation, isStationRack } from '../voxel/depth'
import { stationOf } from '../voxel/workshop'
import { blockDef } from '../voxel/registry'
import { createRack, adoptRack, adoptChest, RACK_SLOTS, RACK_COLS, CHEST_SLOTS } from './chest'
import { blueprintCells } from '../voxel/blueprints'
import { stampWorldCells } from '../voxel/stamps'
import { PLACED_STAMPS } from '../data/blueprints/placed'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const src = readFileSync(new URL('./VoxelWorld.tsx', import.meta.url), 'utf8')
const host = codeOnly(src)
/**
 * ⚠ `codeOnly` STRIPS STRING LITERALS, so an assert about a MESSAGE the keeper reads cannot use it
 * — it silently looks for text the input no longer contains, and reports the code missing when it
 * is the instrument that removed it. Three asserts in this file's first cut failed exactly that
 * way. `noComments` keeps strings and drops comments, which is the form a "does it SAY this"
 * question needs; `host` stays the form every structural assert uses, for `blockAt`'s stated
 * reason (a comment describing what a block used to do must not satisfy a guard about what it does).
 */
const hostText = noComments(src)

// ── §1 the rack is a container, and it is sized like a shelf rather than a chest ──────────────
{
  ok(RACK_SLOTS === 16 && RACK_COLS === 8, '§1 a rack is 8 x 2 = 16')
  ok(RACK_SLOTS < CHEST_SLOTS, '§1 ★ a rack holds LESS than a chest — if it held a bagful there would be no reason to stand a chest beside the mill')
  ok(createRack().length === RACK_SLOTS && createRack().every(s => s === null), '§1 a fresh rack is empty at full length')
  // ★ THE MIGRATION IS THE POINT, AND IT IS THE SAME ONE A CHEST GETS. A rack off an older save is
  // grown, never cut; a rack that is somehow LONGER is compacted forward rather than truncated.
  const short = adoptRack([{ itemId: 'goldwood_log', count: 4 }])
  ok(short.length === RACK_SLOTS, '§1 a short saved rack is grown to full length')
  ok(short[0]?.count === 4, '§1 ★ and the stack stays exactly where the keeper left it')
  const over = adoptRack(Array.from({ length: RACK_SLOTS + 3 }, (_, i) => ({ itemId: 'stone', count: i + 1 })))
  ok(over.length === RACK_SLOTS, '§1 an over-long saved rack is made this build\'s length')
  ok(over.every(s => s !== null), '§1 ★ and the overflow is COMPACTED forward, not dropped on the floor')
  // ⚠ THE ONE MISTAKE THE KEY SPACE COULD NEVER HAVE CAUGHT: a rack read by the chest's adopt.
  ok(adoptChest([{ itemId: 'stone', count: 1 }]).length === CHEST_SLOTS,
    '§1 adoptChest still makes a CHEST-length grid')
  ok(adoptRack([{ itemId: 'stone', count: 1 }]).length !== adoptChest([{ itemId: 'stone', count: 1 }]).length,
    '§1 ★★ the two adopts give different lengths — which is why racks need their own save field')
  ok(adoptRack('not an array').length === RACK_SLOTS && adoptRack(null).length === RACK_SLOTS,
    '§1 junk off a disk a console can write to becomes an empty rack, never a crash')
}

// ── §2 the rack is occupancy, not a block and not a station ──────────────────────────────────
{
  ok(blockDef(MAT.STATION_RACK) === undefined,
    '§2 ★ the rack has NO BlockDef — like STRUCTURE, so the pick has nothing to chew and the hit is redirected instead')
  ok(stationOf(MAT.STATION_RACK) === null, '§2 a rack is not a workshop (no recipes, no job, no rate)')
  ok(isStationRack(MAT.STATION_RACK), '§2 isStationRack names it')
  ok([...TALL_STATIONS].every(m => !isStationRack(m)), '§2 ★ and no tall station IS its own rack')
  ok([...TALL_STATIONS].every(m => stationOf(m) !== null),
    '§2 every tall station is a real station — a rack over decor would open a panel that has nothing in it')
  // ⚠ THE BENCH JOINED THEM 2026-09-23 and this line used to assert the opposite — kept as a
  // POSITIVE claim about all three rather than deleted, because the workshop family standing at
  // one height is the thing Alex asked for and it should go red if one of them is ever shortened.
  // The negative half moved to a block that is genuinely not a station.
  ok(isTallStation(MAT.CRAFT_TABLE) && isTallStation(MAT.SAWMILL) && isTallStation(MAT.STONECUTTER),
    '§2 ★ the whole workshop family — bench, mill, cutter — stands two cells tall')
  ok(!isTallStation(MAT.CHEST) && !isTallStation(MAT.MANA_LANTERN) && !isTallStation(MAT.OVEN),
    '§2 ★ and a chest, a lantern and an oven are NOT tall — the flag is not creeping across the block table')
}

// ── §3 PLACING one writes BOTH cells, and refuses when there is no room ───────────────────────
{
  ok(host.includes('if (isTallStation(put)) setVoxel(hit.px, hit.py + 1, hit.pz, MAT.STATION_RACK)'),
    '§3 ★ placing a tall station writes the rack in the cell above')
  ok(host.includes('isTallStation(mat) && voxel(hit.px, hit.py + 1, hit.pz) !== AIR'),
    '§3 ★ and it REFUSES when that cell is not air')
  // ⚠ ORDER: the refusal must come BEFORE the branch that spends the item, or the keeper pays for
  // a station that never stands.
  //
  // ⚠⚠ AND IT IS WINDOWED, NOT SEARCHED. `removeItems(inv.current!, held, 1)` appears TWICE in
  // this file, and comparing against the FIRST of them compared the refusal to an unrelated branch
  // several hundred lines earlier — a guard that was red about correct code, which `justBefore`'s
  // own note calls the worst direction to fail in. The question is not "is the refusal somewhere
  // above some spend" but "is it immediately above THIS place branch", so the place branch is the
  // anchor and the refusal has to be inside the window that precedes it.
  const placeBranch = host.indexOf('countItem(inv.current!, held) > 0 && voxel(hit.px, hit.py, hit.pz) === AIR')
  ok(placeBranch > 0, '§3 the generic place branch is still findable (the anchor this section hangs on)')
  //
  // ⚠ AND IT IS COUNTED, NOT MEASURED IN CHARACTERS. A character window is the wrong ruler here:
  // `codeOnly` BLANKS comments to whitespace rather than deleting them (it preserves offsets), so
  // the distance between two adjacent branches is set by how much prose sits between them — a 600
  // window failed against perfectly adjacent code, and widening it until it passed would have been
  // fitting the bound to its own assert. What "immediately above" actually MEANS is that nothing
  // is interposed: exactly one `} else if (` between the two conditions, which is the place
  // branch's own opener. That stays true however the comments grow, and it goes red the moment a
  // third branch is slipped in between them.
  const refusal = host.indexOf('isTallStation(mat) && voxel(hit.px, hit.py + 1, hit.pz) !== AIR')
  ok(refusal > 0 && refusal < placeBranch,
    '§3 ★ the headroom refusal is above the branch that takes the item out of the bag')
  ok(refusal > 0 && host.slice(refusal, placeBranch).split('} else if (').length - 1 === 1,
    '§3 ★★ and NOTHING is interposed between them — no paying for a station that cannot stand')
  ok(hostText.includes('no room above'), '§3 and it SAYS so — a silent refusal reads as a broken right-click')
}

// ── §4 BREAKING one takes both cells and spills the rack ─────────────────────────────────────
{
  ok(host.includes('if (isTallStation(hit.material)) {'), '§4 ★ breaking a tall station has its own branch')
  ok(host.includes('setVoxel(hit.x, hit.y + 1, hit.z, AIR)'),
    '§4 ★★ the rack cell is cleared — left standing it is a solid invisible cell over a hole')
  // ★★ THE ORDERING ASSERT THIS FILE EXISTS FOR. `setVoxel` deletes the rack's contents record
  // when the rack material leaves the cell, so reading the grid afterwards hands back a fresh
  // empty one and the keeper's stock is gone with nothing thrown anywhere.
  const read = host.indexOf("const spilled = racksByCol.current.get(colOf(hit.x, hit.z))?.[rk]")
  const clear = host.indexOf('setVoxel(hit.x, hit.y + 1, hit.z, AIR)')
  ok(read > 0 && clear > 0 && read < clear,
    '§4 ★★ the contents are READ BEFORE the write that deletes their record')
  ok(host.includes('drops.current.push(spawnDrop(st.itemId, st.count, hit.x, hit.y + 1, hit.z))'),
    '§4 ★ and every stack is spilled as a drop rather than destroyed')
}

// ── §5 the record dies with the cell, through the one funnel every write passes ───────────────
{
  ok(host.includes('if (prevMat !== mat && (isStationRack(prevMat) || isStationRack(mat))) {'),
    '§5 ★ setVoxel drops a rack\'s record when the rack leaves — no path invented later can strand one')
  ok(host.includes('if (!Object.keys(rec).length) racksByCol.current.delete(k)'),
    '§5 and an emptied column record is dropped rather than kept as a husk')
  // The no-op guard carries real weight: RACK over RACK must not empty a shelf being stood at.
  ok(host.includes('prevMat !== mat && (isStationRack(prevMat)'),
    '§5 ★ under the prevMat !== mat guard — a redundant write is not a new rack')
}

// ── §6 it saves, it loads, and it is never poured into the bank ───────────────────────────────
{
  ok(host.includes('const racksByCol = useRef(new Map<string, Record<string, Slots>>())'),
    '§6 racks live per column, like chests and jobs')
  ok(host.includes('genRemoved: genRemovedByCol.current.get(k), chests, jobs, racks,'),
    '§6 ★ and they reach the column record — a rack that never writes is a rack that empties on refresh')
  ok(host.includes('have[rk] = adoptRack(g)'),
    '§6 ★★ loaded through adoptRack, NEVER adoptChest — the wrong adopt inflates a 16-slot shelf to 48 in silence')
  ok(!host.includes('adoptChest(g)\n            racksByCol'), '§6 and the two adopts are not crossed')
  ok(host.includes('racksByCol.current.clear()'), '§6 the space switch clears them (the "0,0" key collision)')
  ok(host.includes('pourInto(bank.current, adoptChest(g), maxStackOf)'),
    '§6 chests still pour into the plot bank on entry')
  ok(!host.includes('pourInto(bank.current, adoptRack'),
    '§6 ★★ and a RACK never does — the logs live AT the sawmill, which is the whole point of it')
}

// ── §7 one object, two verbs: the swing goes down, the right-click stays where it pointed ─────
{
  ok(host.includes('const hit = rawHit && isStationRack(rawHit.material)'),
    '§7 ★ the hit is redirected to the station below, so a swing at the top breaks the mill')
  ok(host.includes('&& isTallStation(voxel(rawHit.x, rawHit.y - 1, rawHit.z))'),
    '§7 ★ gated on the cell below really being a tall station — a stray rack answers for itself')
  ok(host.includes('const potMat = voxel(rawHit!.x, rawHit!.y, rawHit!.z)'),
    '§7 ★★ but the right-click reads the cell POINTED at — Alex\'s ruling: low opens recipes, high opens storage')
  ok(host.includes('if (rawHit && isStationRack(rawHit.material)) {'),
    '§7 the open handler has a rack branch')
  // ⚠ It must sit ABOVE the plot/bank test or every rack on the keeper's land opens the pool.
  // ⚠ ANCHORED ON THE BANK'S OWN CALL, NOT ON `space.current === 'plot'`. That condition is a
  // string comparison, so `codeOnly` removes the half that identifies it — and it appears dozens
  // of times in this file anyway, which is precisely the un-constrained match `justBefore`'s note
  // warns about. `fitBank(bank.current, cap)` occurs once and is the thing that must not be reached.
  const rackBranch = host.indexOf('if (rawHit && isStationRack(rawHit.material)) {')
  const bankDoor = host.indexOf('fitBank(bank.current, cap)')
  ok(rackBranch > 0 && bankDoor > 0 && rackBranch < bankDoor,
    '§7 ★★ and it is ABOVE the bank door — otherwise a rack on the plot shows a 48-slot pool in a 16-slot shelf')
  ok(host.includes('rack: true,'), '§7 the panel is told it is a rack (heading, rows, title)')
}

// ── §8 a WORLDGEN station gets its rack too, and the blueprints leave room for it ─────────────
// The player's placement is not the only way a sawmill reaches the world: Hazel's carpentry and
// Sax's stonery carry one in their blueprints, and those never touch the placement branch §3
// guards. `stampWorldCells` is where they get their second cell.
{
  const tallInBlueprints: { id: string; x: number; y: number; z: number; m: number }[] = []
  for (const st of PLACED_STAMPS) {
    for (const c of blueprintCells(st.bp)) if (isTallStation(c.m)) tallInBlueprints.push({ id: st.bp.id, ...c })
  }
  // ⚠ NOT SKIPPED WHEN EMPTY. If the world stops shipping a generated mill this section would
  // otherwise pass by looking at nothing — the vacuous green `modelFits` was corrected for.
  ok(tallInBlueprints.length > 0,
    `§8 ★ the world still lays tall stations from blueprints (found ${tallInBlueprints.length}) — if this goes to 0 this whole section is measuring nothing`)

  for (const st of PLACED_STAMPS) {
    const local = blueprintCells(st.bp)
    const occupied = new Map(local.map(c => [`${c.x},${c.y},${c.z}`, c.m]))
    for (const c of local) {
      if (!isTallStation(c.m)) continue
      // ★ THE ASSUMPTION `stampWorldCells` RESTS ON, MADE CHECKABLE. The blueprint wins at a
      // contested cell, so a mill authored under a beam would silently lose its rack and stand as
      // a half-station. Today both are clear; this is what makes that a fact rather than a memory.
      ok(!occupied.has(`${c.x},${c.y + 1},${c.z}`),
        `§8 ★★ ${st.bp.id}: the cell above its ${blockDef(c.m)?.name ?? c.m} is clear, so the rack can stand`)
      ok(c.y + 1 < st.bp.h,
        `§8 ★ ${st.bp.id}: and that cell is INSIDE the stamp's box — a rack above the box is never cleared to air first`)
    }
  }

  // And the emitted cells really carry it, at the right coordinate, for every placed stamp.
  for (const st of PLACED_STAMPS) {
    const world = stampWorldCells(st, 100)
    const stations = world.filter(c => isTallStation(c.m))
    for (const c of stations) {
      ok(world.some(r => isStationRack(r.m) && r.x === c.x && r.y === c.y + 1 && r.z === c.z),
        `§8 ★★ ${st.bp.id}: a rack cell is emitted directly above the station at ${c.x},${c.y},${c.z}`)
    }
    ok(world.filter(c => isStationRack(c.m)).length === stations.length,
      `§8 ${st.bp.id}: exactly one rack per tall station — no strays`)
  }
}

console.log(`station-tall: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
