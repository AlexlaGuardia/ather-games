// Edit-persistence oracle. Run: npx tsx src/app/shimmer/voxel/edits.test.ts
//
// Persistence fails in the way that costs the most trust: quietly, and only after the player has
// invested. A round trip that loses one block loses a doorway. A diff that stores no-ops grows a
// save forever. A stale-generator load puts a door in mid-air. None of it shows until someone comes
// back to a build they cared about, which is exactly why it gets asserted rather than eyeballed.

import { AIR } from './section'
import { MAT } from './depth'
import { SEAM } from './seams'
import { Column, SECTION, makeColumn } from './column'
import {
  GENERATOR_VERSION, editIndex, unpackIndex, recordEdit, applyEdits,
  packEdits, unpackEdits, isStale, type ColumnEdits,
} from './edits'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337
const WX = 512, WZ = 768

// ── 1. index packing round-trips ─────────────────────────────────────────────────────────────
{
  let bad = 0
  for (const [x, y, z] of [[0, 0, 0], [15, 255, 15], [7, 128, 3], [1, 1, 1], [15, 0, 0]] as const) {
    const u = unpackIndex(editIndex(x, y, z))
    if (u.x !== x || u.y !== y || u.z !== z) bad++
  }
  ok(bad === 0, 'editIndex/unpackIndex round-trip exactly')
  // Distinctness matters more than the formula: a collision silently merges two edits into one.
  const seen = new Set<number>()
  let dup = 0
  for (let y = 0; y < 256; y += 7) for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) {
    const i = editIndex(x, y, z)
    if (seen.has(i)) dup++
    seen.add(i)
  }
  ok(dup === 0, `every (x,y,z) packs to a distinct index (${dup} collisions)`)
}

// ── 2. ★ THE ROUND TRIP — regenerate + apply must reproduce the edited world exactly ─────────
// This is the whole promise of storing diffs instead of the world.
{
  const built = makeColumn(WX, WZ, SEED)
  const edits: ColumnEdits = new Map()

  // Carve a doorway and lay a floor — a plausible small build.
  const h = built.heightAt(8, 8)
  const changes: [number, number, number, number][] = []
  for (let dy = 0; dy < 3; dy++) changes.push([8, h - dy, 8, AIR])
  for (let x = 5; x < 11; x++) for (let z = 5; z < 11; z++) changes.push([x, h + 1, z, MAT.STONE])

  for (const [x, y, z, m] of changes) {
    const i = editIndex(x, y, z)
    recordEdit(edits, i, m, built.get(x, y, z))
    const s = (y / SECTION) | 0
    built.sections[s].set(x, y - s * SECTION, z, m)
  }
  ok(edits.size > 0, `the build recorded edits (${edits.size})`)

  // Now: throw the column away, regenerate from seed, re-apply the diff.
  const reloaded = makeColumn(WX, WZ, SEED)
  applyEdits(reloaded, edits)

  let diff = 0
  for (let i = 0; i < built.sections.length; i++)
    for (let k = 0; k < built.sections[i].data.length; k++)
      if (built.sections[i].data[k] !== reloaded.sections[i].data[k]) diff++
  ok(diff === 0, `★ regenerate + apply reproduces the edited world exactly (${diff} voxels differ)`)
}

// ── 3. ★ AN EDIT THAT RESTORES THE ORIGINAL IS DELETED, NOT STORED ───────────────────────────
// Mine a block and put it back: the save must return to EMPTY. Otherwise a player who tidies up
// leaves a file full of no-ops, and a column identical to procedural output costs storage forever.
{
  const col = makeColumn(WX, WZ, SEED)
  const edits: ColumnEdits = new Map()
  const h = col.heightAt(4, 4)
  const original = col.get(4, h, 4)

  recordEdit(edits, editIndex(4, h, 4), AIR, original)
  ok(edits.size === 1, 'mining records one edit')

  recordEdit(edits, editIndex(4, h, 4), original, original)
  ok(edits.size === 0, '★ putting the block back empties the save, it does not store a no-op')

  // And a genuinely different material still stores.
  recordEdit(edits, editIndex(4, h, 4), SEAM.RAW_MANA, original)
  ok(edits.size === 1, 'a real change is still recorded')
}

// ── 4. idempotence — applying twice is applying once ─────────────────────────────────────────
// Without this, "resume" and "run again" diverge, which is the same trap the Stage enum exists for.
{
  const a = makeColumn(WX, WZ, SEED)
  const edits: ColumnEdits = new Map([[editIndex(2, 100, 2), MAT.SAND], [editIndex(3, 100, 3), AIR]])
  applyEdits(a, edits)
  const snapshot = a.sections.map(s => Uint16Array.from(s.data))
  applyEdits(a, edits)
  let diff = 0
  for (let i = 0; i < snapshot.length; i++) for (let k = 0; k < snapshot[i].length; k++)
    if (snapshot[i][k] !== a.sections[i].data[k]) diff++
  ok(diff === 0, 'applying the same edits twice changes nothing')
}

// ── 5. absence means regenerate, and costs nothing ───────────────────────────────────────────
// The whole point of diffs: walking a thousand columns must cost ZERO bytes.
{
  const col = makeColumn(WX, WZ, SEED)
  const before = col.sections.map(s => Uint16Array.from(s.data))
  applyEdits(col, undefined)
  applyEdits(col, new Map())
  let diff = 0
  for (let i = 0; i < before.length; i++) for (let k = 0; k < before[i].length; k++)
    if (before[i][k] !== col.sections[i].data[k]) diff++
  ok(diff === 0, 'an unedited column is untouched by loading')
  ok(packEdits(new Map()).idx.length === 0, 'an unedited column serialises to nothing')
}

// ── 6. pack / unpack round-trips ─────────────────────────────────────────────────────────────
{
  const edits: ColumnEdits = new Map()
  for (let i = 0; i < 500; i++) edits.set(i * 37, (i % 7) + 1)
  const round = unpackEdits(packEdits(edits))
  ok(round.size === edits.size, `packing preserves the count (${round.size} vs ${edits.size})`)
  let bad = 0
  for (const [k, v] of edits) if (round.get(k) !== v) bad++
  ok(bad === 0, `packing preserves every entry (${bad} wrong)`)
  ok(packEdits(edits).version === GENERATOR_VERSION, 'the packed save carries the generator version')
  // A corrupt or empty payload must degrade, not throw — a bad save should cost the edits, not the game.
  ok(unpackEdits(null).size === 0, 'a missing save unpacks to no edits')
  ok(unpackEdits({ version: 1, idx: new Uint32Array(3), mat: new Uint16Array(1) }).size === 1,
     'a truncated save unpacks the entries it actually has')
}

// ── 7. ★ a stale generator is DETECTABLE, which is all it can be ─────────────────────────────
// Retune the height spline and a saved "I removed this block" may point at a block that never
// existed. Nothing can fix that in general — the research flagged it open. What must not happen is
// silence.
{
  ok(!isStale(packEdits(new Map())), 'a save from this generator is not stale')
  ok(isStale({ version: GENERATOR_VERSION + 1, idx: new Uint32Array(0), mat: new Uint16Array(0) }),
     '★ a save from a different generator version is flagged')
  ok(!isStale(null), 'no save is not a stale save')
}

// ── 8. a stale save must not throw ───────────────────────────────────────────────────────────
// Out-of-range indices are exactly what an old save produces after a world-height change.
{
  const col = makeColumn(WX, WZ, SEED)
  const evil: ColumnEdits = new Map([
    [editIndex(0, 9999, 0), MAT.STONE],      // above the world
    [editIndex(0, 0, 0), MAT.STONE],         // fine
  ])
  let threw = false
  try { applyEdits(col, evil) } catch { threw = true }
  ok(!threw, 'an out-of-range edit is skipped rather than thrown')
  ok(col.get(0, 0, 0) === MAT.STONE, 'and the valid edits in the same save still land')
}

console.log(`\nedit persistence: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ what you build survives')
