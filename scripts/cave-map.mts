// ── CAN THE WIND — AND A KEEPER — ACTUALLY GET INTO THIS WORLD'S CAVES? ────────────────────────
//
// Run: npx tsx scripts/cave-map.mts [cols] [centreX] [centreZ]
//   npx tsx scripts/cave-map.mts 16 0 0          — 16x16 columns (256 blocks square) around origin
//   CAVE_SLICE=3 npx tsx scripts/cave-map.mts    — print 3 vertical cross-sections
//
// ★ WHY THIS EXISTS. Two open board rows (#1068, #1069) both bottom out on the same unmeasured
// question: nobody has ever met a Hollow underground, and nobody has ever LOOKED at the cave
// system from outside the game. `carve.ts` refuses to break the surface (`surfaceClearance: 3`)
// and `dens.ts` is the only feature allowed to open ground to the sky-side. Whether that leaves a
// connected, enterable cave network or a field of sealed bubbles has never been measured — it has
// only been reasoned about, in prose, in two files that agree with each other.
//
// ── ⚠ IT MEASURES TWO DIFFERENT CEILINGS AND THEY ARE NOT THE SAME QUESTION ────────────────────
//   1. WIND   — is a cave cell reachable from open sky through open space? That is canon's third
//               precondition (`light.ts` › windAt): a seed is wind-borne, so sealed rock gets none.
//   2. WINDOW — is a cave cell inside the vertical box the spawner can even see? `VoxelWorld`'s
//               `lightBoundsFor` builds the field from `minSurface - 10` to `maxSurface + 16`, and
//               `pickSpawnY` clamps its scan to that box. A cell below it is not refused on the
//               merits; it is never offered. `windAt` answers `false` out of bounds, so a deep
//               cave reads exactly like sealed rock to the gate and nothing anywhere says so.
// A cave must clear BOTH to hold a Hollow. Reporting one number for both would hide which ceiling
// is the binding one, and they call for completely different fixes.
//
// ── THE CONTROLS, because an empty result here would read as a finding ─────────────────────────
//   POSITIVE: the air directly over the surface MUST flood. If it does not, the flood is broken
//             and every "sealed" cell below is an artefact of the instrument, not of the world.
//   NEGATIVE: no solid cell may ever be marked wind-reached.
//   MARGIN:   carvers reach `maxReach` 96 blocks (6 columns), so a cave whose only mouth lies
//             outside the generated region reads as sealed. Stats are reported for the CENTRE
//             only, with a 6-column margin generated around it and flooded with it. That shrinks
//             the bias; it does not remove it, and the bias points at "more sealed than truth" —
//             the alarming direction, so treat a sealed figure as an upper bound.
import { Column, generateColumn, SECTION } from '../src/app/shimmer/voxel/column'
import { isSolid, MAT } from '../src/app/shimmer/voxel/depth'
import { columnHeight } from '../src/app/shimmer/voxel/height'

const SEED = 1337, H = 256, AIR = 0
const MARGIN = 6                            // columns; carve.maxReach 96 / SECTION 16
const N = Number(process.argv[2] ?? 16)
// ⚠⚠ THE DEFAULT IS NOT THE ORIGIN, AND THAT IS THE FIRST THING THIS SCRIPT LEARNED. World origin
// sits inside the keeper's fold — `bubbleMaterialAt` answers before the depth rule there, so the
// whole column is AIR at every altitude. A first run centred on (0,0) reported 100% of subsurface
// air wind-reached and a cave in every column: a perfect, confident measurement of the inside of a
// balloon. PATTERNS.md records the identical trap from 2026-08-22 (a column oracle pinned at the
// origin), which is how it was recognised inside two minutes instead of shipped as a finding.
const CX = Number(process.argv[3] ?? 6086), CZ = Number(process.argv[4] ?? 2976)
const SLICES = Number(process.env.CAVE_SLICE ?? 2)

const c0x = Math.floor(CX / SECTION) - Math.floor(N / 2), c0z = Math.floor(CZ / SECTION) - Math.floor(N / 2)
const g0x = c0x - MARGIN, g0z = c0z - MARGIN, gN = N + 2 * MARGIN

process.stderr.write(`generating ${gN}x${gN} columns (${gN * SECTION} blocks square, ${N}x${N} reported)...\n`)
const t0 = Date.now()
const cols = new Map<string, Column>()
for (let cz = g0z; cz < g0z + gN; cz++) {
  for (let cx = g0x; cx < g0x + gN; cx++) cols.set(`${cx},${cz}`, generateColumn(new Column(cx * SECTION, cz * SECTION), SEED))
  process.stderr.write(`\r  row ${cz - g0z + 1}/${gN}`)
}
process.stderr.write(`\n  ${((Date.now() - t0) / 1000).toFixed(1)}s\n`)

const X0 = g0x * SECTION, Z0 = g0z * SECTION, SX = gN * SECTION, SZ = gN * SECTION
const voxel = (x: number, y: number, z: number): number => {
  if (y < 0 || y >= H) return AIR
  const gx = Math.floor(x / SECTION), gz = Math.floor(z / SECTION)
  const c = cols.get(`${gx},${gz}`); if (!c) return AIR
  const s = c.sections[(y / SECTION) | 0]; if (!s) return AIR
  return s.get(((x % SECTION) + SECTION) % SECTION, y % SECTION, ((z % SECTION) + SECTION) % SECTION)
}
// The host passes `isSolid` as `windBlocks` (light.ts): if a body can occupy a cell, air can be in
// it. WATER is not solid but the breath does not cross it, so it is added here and only here.
const windPasses = (m: number): boolean => !isSolid(m) && (m & 0xFF) !== MAT.WATER

// Surface heights, tabulated once — `columnHeight` is multi-octave noise, not a lookup.
const surf = new Int16Array(SX * SZ)
for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) surf[z * SX + x] = columnHeight(X0 + x, Z0 + z, SEED)
const hAt = (x: number, z: number) => surf[(z - Z0) * SX + (x - X0)]

// ── ★ THE GROUND CONTROL: IS THERE ANY GROUND HERE AT ALL? ───────────────────────────────────
// The fold's interior, a lake bed, the shell — several places in this world legitimately have no
// rock under the surface line, and in every one of them the flood floods everything and reports
// a triumphant 100%. A region with no solid cells is not a measurement of caves; it is a
// measurement of somewhere caves do not happen.
let solidProbe = 0, groundProbe = 0
for (let z = Z0; z < Z0 + SZ; z += 7) for (let x = X0; x < X0 + SX; x += 7) {
  groundProbe++
  const h = hAt(x, z)
  if (h > 1 && isSolid(voxel(x, h, z))) solidProbe++
}
console.log(`CONTROL ground (surface cell is solid):    ${solidProbe}/${groundProbe} ${solidProbe / groundProbe > 0.5 ? 'OK' : '*** NO GROUND — is this inside the fold? ***'}`)
if (solidProbe / groundProbe <= 0.5) { console.log('\nthere is no rock here to put a cave in. Move the region.'); process.exit(1) }

// ── the flood ─────────────────────────────────────────────────────────────────────────────────
const idx = (x: number, y: number, z: number) => (y * SZ + (z - Z0)) * SX + (x - X0)
const open = new Uint8Array(SX * SZ * H)
const q = new Int32Array(SX * SZ * H)           // packed indices; flat queue, never recursion
let qn = 0
for (let z = Z0; z < Z0 + SZ; z++) for (let x = X0; x < X0 + SX; x++) {
  for (let y = H - 1; y > hAt(x, z); y--) {      // everything above the surface is sky-side
    if (!windPasses(voxel(x, y, z))) break
    const i = idx(x, y, z); if (!open[i]) { open[i] = 1; q[qn++] = i }
  }
}
const skySeeds = qn
for (let head = 0; head < qn; head++) {
  const i = q[head]
  const x = X0 + (i % SX), rest = (i / SX) | 0
  const z = Z0 + (rest % SZ), y = (rest / SZ) | 0
  for (const [dx, dy, dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]] as const) {
    const nx = x + dx, ny = y + dy, nz = z + dz
    if (nx < X0 || nx >= X0 + SX || nz < Z0 || nz >= Z0 + SZ || ny < 0 || ny >= H) continue
    const j = idx(nx, ny, nz)
    if (open[j] || !windPasses(voxel(nx, ny, nz))) continue
    open[j] = 1; q[qn++] = j
  }
}

// ── controls ──────────────────────────────────────────────────────────────────────────────────
let ctlPos = 0, ctlPosTotal = 0, ctlNeg = 0
for (let z = Z0; z < Z0 + SZ; z += 3) for (let x = X0; x < X0 + SX; x += 3) {
  const h = hAt(x, z)
  if (h + 1 < H && windPasses(voxel(x, h + 1, z))) { ctlPosTotal++; if (open[idx(x, h + 1, z)]) ctlPos++ }
  for (let y = h - 4; y > h - 12 && y > 0; y--) if (isSolid(voxel(x, y, z)) && open[idx(x, y, z)]) ctlNeg++
}
const posOk = ctlPosTotal > 0 && ctlPos / ctlPosTotal > 0.99
console.log(`CONTROL positive (air over ground floods): ${ctlPos}/${ctlPosTotal} ${posOk ? 'OK' : '*** LOOK FAILED ***'}`)
console.log(`CONTROL negative (solid never flooded):    ${ctlNeg} ${ctlNeg === 0 ? 'OK' : '*** LOOK FAILED ***'}`)
if (!posOk || ctlNeg !== 0) { console.log('\nthe flood is not measuring what it claims — every figure below is void.'); process.exit(1) }

// ── the reported centre ───────────────────────────────────────────────────────────────────────
const rx0 = c0x * SECTION, rz0 = c0z * SECTION, RN = N * SECTION
// The spawner's window, per column, exactly as `lightBoundsFor` builds it.
const windowOf = (cx: number, cz: number) => {
  let lo = H - 1, hi = 0
  const c = cols.get(`${cx},${cz}`)!
  for (let i = 0; i < SECTION * SECTION; i++) { const s = c.surface[i]; if (s < lo) lo = s; if (s > hi) hi = s }
  const y0 = Math.max(0, lo - 10)
  return { yLo: Math.max(y0 + 1, 1), yHi: Math.min(y0 + (Math.min(H, hi + 16) - y0) - 2, H - 2) }
}
let caveTotal = 0, caveWind = 0, caveInWindow = 0, caveBoth = 0, mouths = 0
const colHasBoth = new Uint8Array(N * N), colHasWind = new Uint8Array(N * N), colMouth = new Uint8Array(N * N)
for (let z = rz0; z < rz0 + RN; z++) for (let x = rx0; x < rx0 + RN; x++) {
  const h = hAt(x, z)
  const cx = Math.floor(x / SECTION), cz = Math.floor(z / SECTION)
  const w = windowOf(cx, cz)
  const ci = (cz - c0z) * N + (cx - c0x)
  for (let y = 1; y < h; y++) {
    if (voxel(x, y, z) !== AIR) continue           // cave air only — not water, not plants
    caveTotal++
    const wind = !!open[idx(x, y, z)]
    const inWin = y >= w.yLo && y <= w.yHi
    if (wind) { caveWind++; colHasWind[ci] = 1 }
    if (inWin) caveInWindow++
    if (wind && inWin) { caveBoth++; colHasBoth[ci] = 1 }
    // A MOUTH: a cave cell under the surface whose flood came from outside — i.e. it is wind-fed
    // and it sits within a step of the sky-side. Counted as the cell where the two meet.
    if (wind && y === h - 1 && windPasses(voxel(x, h, z))) { mouths++; colMouth[ci] = 1 }
  }
}
const pct = (a: number, b: number) => b === 0 ? '  n/a' : `${(100 * a / b).toFixed(2)}%`
console.log(`\nregion: ${RN}x${RN} blocks centred (${CX},${CZ}), seed ${SEED}, ${MARGIN}-column margin flooded`)
console.log(`sky seed cells: ${skySeeds.toLocaleString()}   flooded total: ${qn.toLocaleString()}`)
console.log(`\ncave air below the surface:      ${caveTotal.toLocaleString()} cells`)
console.log(`  the wind reaches:              ${caveWind.toLocaleString()}  (${pct(caveWind, caveTotal)})`)
console.log(`  inside the spawner's window:   ${caveInWindow.toLocaleString()}  (${pct(caveInWindow, caveTotal)})`)
console.log(`  BOTH (a Hollow could body):    ${caveBoth.toLocaleString()}  (${pct(caveBoth, caveTotal)})`)
// ── HOW DEEP DOES THE WIND ACTUALLY GET? ──────────────────────────────────────────────────────
// ⚠ A SHARE OF CAVE AIR DOES NOT SAY WHERE THAT AIR IS, and the two readings answer different
// questions. A mouth that opens a wide shallow sheet just under the turf and a mouth that opens a
// system running to bedrock produce the same percentage. For "is it dangerous down there" the
// depth distribution is the number, not the share.
{
  const bands = [0, 8, 16, 32, 64, 128, 1e9]
  const hit = new Array(bands.length - 1).fill(0), all = new Array(bands.length - 1).fill(0)
  for (let z = rz0; z < rz0 + RN; z++) for (let x = rx0; x < rx0 + RN; x++) {
    const h = hAt(x, z)
    for (let y = 1; y < h; y++) {
      if (voxel(x, y, z) !== AIR) continue
      const d = h - y
      let b = 0; while (d >= bands[b + 1]) b++
      all[b]++
      if (open[idx(x, y, z)]) hit[b]++
    }
  }
  console.log(`\ncave air by DEPTH below its own surface, and what the wind reaches there:`)
  for (let b = 0; b < bands.length - 1; b++) {
    const hi = bands[b + 1] > 1e8 ? '+' : `-${bands[b + 1] - 1}`
    console.log(`  ${String(bands[b]).padStart(4)}${hi.padEnd(5)} ${String(all[b]).padStart(8)} cells  wind reaches ${String(hit[b]).padStart(8)}  ${pct(hit[b], all[b])}`)
  }
}

const nCol = N * N
console.log(`\ncolumns (16x16 each), of ${nCol}:`)
console.log(`  with any wind-fed cave:        ${colHasWind.reduce((a, b) => a + b, 0)}  (${pct(colHasWind.reduce((a, b) => a + b, 0), nCol)})`)
console.log(`  with a spawnable cave cell:    ${colHasBoth.reduce((a, b) => a + b, 0)}  (${pct(colHasBoth.reduce((a, b) => a + b, 0), nCol)})`)
console.log(`  with a cave MOUTH:             ${colMouth.reduce((a, b) => a + b, 0)}  (${pct(colMouth.reduce((a, b) => a + b, 0), nCol)})`)
console.log(`  mouth cells:                   ${mouths}`)

// ── the picture: top-down, one char per column ────────────────────────────────────────────────
console.log(`\nTOP-DOWN, one char per 16x16 column. rows z=${rz0}..${rz0 + RN - 1}, cols x=${rx0}..`)
console.log(`  M = a mouth here   * = wind-fed cave, no mouth   o = cave, sealed   . = no cave`)
for (let cz = c0z; cz < c0z + N; cz++) {
  let row = ''
  for (let cx = c0x; cx < c0x + N; cx++) {
    const ci = (cz - c0z) * N + (cx - c0x)
    row += colMouth[ci] ? 'M' : colHasWind[ci] ? '*' : colHasBoth[ci] ? '*' : hasAnyCave(cx, cz) ? 'o' : '.'
  }
  console.log(`${String(cz * SECTION).padStart(6)} ${row}`)
}
function hasAnyCave(cx: number, cz: number): boolean {
  for (let z = cz * SECTION; z < cz * SECTION + SECTION; z++) for (let x = cx * SECTION; x < cx * SECTION + SECTION; x++) {
    const h = hAt(x, z)
    for (let y = 1; y < h; y++) if (voxel(x, y, z) === AIR) return true
  }
  return false
}

// ── the picture: vertical cross-sections ─────────────────────────────────────────────────────
// ★ PAIRED WITH THE NUMBERS ON PURPOSE. A cross-section read out of the generator in the same
// coordinates is the only thing that says whether "sealed" means a bubble in rock or an instrument
// artefact — the bridge-deck lesson (2026-08-22), applied before anyone is confused rather than after.
for (let s = 0; s < SLICES; s++) {
  const z = rz0 + Math.floor((s + 0.5) * RN / SLICES)
  let yTop = 0, yBot = H
  for (let x = rx0; x < rx0 + RN; x++) { const h = hAt(x, z); if (h > yTop) yTop = h }
  yBot = Math.max(0, yTop - 90)
  console.log(`\nCROSS-SECTION z=${z}, x=${rx0}..${rx0 + RN - 1}, y=${yTop + 2} down to ${yBot}`)
  console.log(`  # = solid   ~ = water   ' ' = open to sky   C = wind-fed cave   X = SEALED pocket`)
  for (let y = yTop + 2; y >= yBot; y--) {
    let row = ''
    for (let x = rx0; x < rx0 + RN; x++) {
      const m = voxel(x, y, z)
      if ((m & 0xFF) === MAT.WATER) { row += '~'; continue }
      if (isSolid(m)) { row += '#'; continue }
      if (y > hAt(x, z)) { row += ' '; continue }
      row += open[idx(x, y, z)] ? 'C' : 'X'
    }
    console.log(`${String(y).padStart(4)} ${row}`)
  }
}
