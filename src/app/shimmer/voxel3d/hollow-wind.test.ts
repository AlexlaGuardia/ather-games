// THE THIRD PRECONDITION — wind, and therefore seeds. Run: npx tsx src/app/shimmer/voxel3d/hollow-wind.test.ts
//
// ── CANON (ruled 2026-09-07, /magii + Alex, `game/shimmer-geography.md` › THE HOLLOWS) ────────
// A Hollow needs THREE things, not two. Drained ground and the dark are the 08-07 pair; the third
// is that **there must have been a seed lying there to be drained.** Mana Seeds are wind-borne, so:
//
//     ⛔ NO HOLLOW IN SEALED ROCK — not because darkness cannot substitute for drain, but because
//        no seed ever landed there. **The test is not depth and not light — it is whether the wind
//        could have put a seed there.**
//     ⚠ AND DARK IS NOT SEEDLESS. The Undergloam is sunless and has seeds. Read it as "no seeds
//        where no wind goes", never "no seeds in dark places."
//
// ── WHY THIS IS A GUARD AND NOT A RUNTIME GATE ────────────────────────────────────────────────
// The spawner does not model wind, and measuring it at runtime means a flood fill per anchor in a
// loop with a 3ms budget. It does not need to: **worldgen already satisfies the rule.** Measured
// over 24 columns, 5,335 spawns, both hours — **0 landed in a cell the wind cannot reach**, while
// the same instrument found 42,409 sealed cells (4.52% of non-solid space), so it can report
// "sealed" and simply never had to.
//
// ⚠⚠ THAT IS A PREMISE, NOT A PROPERTY, AND A PREMISE IN PROSE IS THE THING THIS REPO KEEPS
// GETTING WRONG. Worldgen is not obliged to keep caves connected; the day a generator opens a
// sealed vault, the spawner starts putting Hollows where canon says nothing can gather, silently
// and with every other guard green. So the premise is asserted instead of written down, and it is
// asserted DETERMINISTICALLY — every cell the spawner could choose in these columns, not a sample
// — because a statistical guard cannot see a rare new pocket, which is exactly what a new
// generator would produce.
import { Column, generateColumn, SECTION } from '../voxel/column'
import { MAT, DEFAULT_DEPTH, isSolid } from '../voxel/depth'
import { WOOD } from '../voxel/trees'
import { emitOf } from '../voxel/registry'
import { computeLight, spawnDark, type LightBounds } from '../voxel/light'
import { columnHeight } from '../voxel/height'
import { hollowFoots, hollowEligible, NIGHT_SKY_MAX } from './hollows'
import { WORLD_SEED } from './world-seed'

const SEED = WORLD_SEED, AIR = 0, H = 256
const LIGHT_PASSES = new Set<number>([
  WOOD.GOLDWOOD_LEAVES, WOOD.SHIMMEROAK_LEAVES, WOOD.STARWILLOW_LEAVES, WOOD.DAWNWOOD_LEAVES,
])
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

function apron(cx: number, cz: number) {
  const cols = new Map<string, Column>()
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++)
    cols.set(`${cx + dx},${cz + dz}`, generateColumn(new Column((cx + dx) * SECTION, (cz + dz) * SECTION), SEED))
  const voxel = (x: number, y: number, z: number): number => {
    if (y < 0 || y >= H) return AIR
    const gx = Math.floor(x / SECTION), gz = Math.floor(z / SECTION)
    const c = cols.get(`${gx},${gz}`); if (!c) return AIR
    const s = c.sections[(y / SECTION) | 0]; if (!s) return AIR
    return s.get(((x % SECTION) + SECTION) % SECTION, y % SECTION, ((z % SECTION) + SECTION) % SECTION)
  }
  const centre = cols.get(`${cx},${cz}`)!
  let lo = H - 1, hi = 0
  for (let i = 0; i < SECTION * SECTION; i++) { const s = centre.surface[i]; if (s < lo) lo = s; if (s > hi) hi = s }
  const y0 = Math.max(0, lo - 10)
  const b: LightBounds = { x0: cx * SECTION - SECTION, y0, z0: cz * SECTION - SECTION,
                           sx: SECTION * 3, sy: Math.min(H, hi + 16) - y0, sz: SECTION * 3 }
  const field = computeLight(b, {
    opaque: (x, y, z) => { const m = voxel(x, y, z); return m !== AIR && m !== MAT.WATER && !LIGHT_PASSES.has(m) },
    emit: (x, y, z) => emitOf(voxel(x, y, z)),
    windBlocks: (x, y, z) => isSolid(voxel(x, y, z)),
    openToSky: (x, z, y) => y > columnHeight(x, z, SEED),
  })
  // The wind: flood open space from every sky-open cell, 6-connected, no decay. Wind is not light.
  const idx = (x: number, y: number, z: number) => ((y - b.y0) * b.sz + (z - b.z0)) * b.sx + (x - b.x0)
  const open = new Uint8Array(b.sx * b.sy * b.sz)
  const q: number[] = []
  for (let z = b.z0; z < b.z0 + b.sz; z++) for (let x = b.x0; x < b.x0 + b.sx; x++)
    for (let y = b.y0 + b.sy - 1; y >= b.y0; y--) {
      if (isSolid(voxel(x, y, z))) break
      if (y > columnHeight(x, z, SEED)) { const i = idx(x, y, z); if (!open[i]) { open[i] = 1; q.push(x, y, z) } }
    }
  for (let h = 0; h < q.length; h += 3) {
    const x = q[h], y = q[h + 1], z = q[h + 2]
    for (const [dx, dy, dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
      const nx = x + dx, ny = y + dy, nz = z + dz
      if (nx < b.x0 || nx >= b.x0 + b.sx || ny < b.y0 || ny >= b.y0 + b.sy || nz < b.z0 || nz >= b.z0 + b.sz) continue
      const i = idx(nx, ny, nz)
      if (open[i] || isSolid(voxel(nx, ny, nz))) continue
      open[i] = 1; q.push(nx, ny, nz)
    }
  }
  let sealedCells = 0
  for (let z = b.z0; z < b.z0 + b.sz; z++) for (let y = b.y0; y < b.y0 + b.sy; y++) for (let x = b.x0; x < b.x0 + b.sx; x++)
    if (!isSolid(voxel(x, y, z)) && !open[idx(x, y, z)]) sealedCells++
  return { voxel, field, b, sealedCells, windReaches: (x: number, y: number, z: number) => open[idx(x, y, z)] === 1 }
}

// Deep wilds — the only sampled region where the drain gate actually opens, so the only one where
// this rule can be violated at all. (The Outfields and home are refused by greyness before the
// seed axis is ever consulted; see `hollow-ground.mts`.)
// ⚠⚠ THESE COLUMNS ARE CHOSEN, AND TWO EARLIER SETS WERE CHOSEN WRONG — both caught by the
// controls below rather than by review. The first three had no caves at all (`undergroundChecked
// === 0`), so the guard would have run green while structurally unable to test the only case it
// exists for. The second had caves but only SEALED ones, so it could not tell a correct gate from
// one that refuses everything.
//   · [380, 186] carries BOTH — 10 ventilated sub-surface candidates and 22 sealed — so one
//     fixture proves the rule and its limit at once.
//   · [381, 185] is a pure sealed vault: 70 candidates, and a 144x144 FULL-HEIGHT flood seeded
//     only from open sky reaches 0 of its 255 sub-surface standable cells. Genuinely sealed, not
//     merely unseen — which is how the "seed from the box faces too" fix was caught and reverted.
//   · [376, 186] is pure ventilated: 11, none sealed.
const COLS: [number, number][] = [[380, 186], [381, 185], [376, 186]]

let ungatedSealed = 0, ungatedVentUnder = 0
let gatedSealed = 0, gatedVentUnder = 0, gatedTotal = 0
let sealedCellsTotal = 0, disagreements = 0
const offenders: string[] = []
for (const [cx, cz] of COLS) {
  const { voxel, field, b, sealedCells, windReaches } = apron(cx, cz)
  sealedCellsTotal += sealedCells
  for (let z = cz * SECTION; z < cz * SECTION + SECTION; z++)
    for (let x = cx * SECTION; x < cx * SECTION + SECTION; x++) {
      const sh = columnHeight(x, z, SEED)
      for (let y = b.y0 + 1; y < b.y0 + b.sy - 1; y++) {
        if (!hollowFoots(y,
          (fy) => isSolid(voxel(x, fy, z)),
          (cy) => { const m = voxel(x, cy, z); return !isSolid(m) && m !== MAT.WATER })) continue
        // ⚠ A DIFFERENTIAL, NOT A MIRROR. `windReaches` is this file's own hand-written flood over
        // the same box; `field.windAt` is light.ts's sliced one. They were written separately, and
        // a disagreement is a finding about one of them — which is what stops this guard from
        // being a copy that agrees with its original (PATTERNS 08-22).
        const mine = windReaches(x, y, z)
        if (mine !== field.windAt(x, y, z)) disagreements++
        for (const day of [0, 1]) {
          if (!spawnDark(field.get(x, y, z), day, NIGHT_SKY_MAX)) continue
          if (!hollowEligible(x + 0.5, z + 0.5, SEED, field.get(x, y, z), day, sh, DEFAULT_DEPTH.seaLevel)) continue
          const under = y <= sh
          // ── what the spawner could choose BEFORE the wind gate ────────────────────────────
          if (!mine) ungatedSealed++
          else if (under) ungatedVentUnder++
          // ── and AFTER: the host's roll ANDs `lf.windAt` into its dark predicate ────────────
          if (!field.windAt(x, y, z)) continue
          gatedTotal++
          if (!mine) { gatedSealed++; if (offenders.length < 5) offenders.push(`(${x},${y},${z}) day=${day}`) }
          if (under) gatedVentUnder++
        }
      }
    }
}

// ── CONTROLS FIRST: without them, the rule assert below is satisfied by a gate that refuses
//    everything, by a fixture with no caves, and by a flood that marks all space open. ─────────
ok(sealedCellsTotal > 0,
   `★★ CONTROL: sealed space exists in these columns at all — ${sealedCellsTotal} cells`)
ok(disagreements === 0,
   `★★★ DIFFERENTIAL: light.ts's wind flood and this file's independently written one agree on`
   + ` every cell — ${disagreements} disagreements`)
ok(ungatedSealed > 0,
   `★★★ POSITIVE CONTROL — THE BUG, REPRODUCED: without the gate the spawner could choose`
   + ` ${ungatedSealed} candidates in SEALED rock. A 0 here means the guard has gone blind and the`
   + ` columns need re-picking, NOT a looser assert.`)
ok(ungatedVentUnder > 0,
   `★★ CONTROL: and these columns really do contain VENTILATED sub-surface candidates`
   + ` (${ungatedVentUnder}) — otherwise "the feature survives" would be untestable here`)

// ── THE RULE, AND ITS LIMIT — both, because either alone is satisfiable by a wrong gate ───────
ok(gatedSealed === 0,
   `★★★ THE THIRD PRECONDITION HOLDS: of ${gatedTotal} cells the spawner can now choose, ${gatedSealed}`
   + ` are in sealed rock${offenders.length ? ' — ' + offenders.join(', ') : ''}`)
ok(gatedVentUnder > 0,
   `★★★ AND THE GATE DID NOT DELETE THE FEATURE: ${gatedVentUnder} surviving candidates are BELOW`
   + ` the surface — *a cave with a mouth, a deep overhang, a warren* stays eligible, which is the`
   + ` half canon explicitly preserved`)

process.on('exit', () => {
  if (fails.length) {
    console.error(`❌ ${fails.length} failed (${pass} passed)`)
    for (const f of fails) console.error('  - ' + f)
    console.error('\n  ⚠ IF THE LAST ASSERT IS RED, the spawner can reach sealed pockets and canon says nothing')
    console.error('    may body there. If the POSITIVE CONTROL is red instead, the guard has gone blind — these')
    console.error('    columns no longer contain the phenomenon and need re-picking, NOT a looser assert.')
    process.exitCode = 1
  } else {
    console.log(`✅ no seeds where no wind goes — ${pass} passed (${gatedTotal} candidates survive, ${ungatedSealed} sealed ones refused, ${gatedVentUnder} of the survivors underground)`)
  }
})
