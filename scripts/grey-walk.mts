// ── HOW FAR IS THE FIRST GROUND A HOLLOW MAY STAND ON, AND WHICH TERM SETS THAT DISTANCE? ──────
//
// Run: npx tsx scripts/grey-walk.mts [maxRadius]
//
// ★ WHY THIS EXISTS. Board row #1079 says the walk to the first dangerous cave is ~950 blocks and
// that "the density lever is spent — what remains is greyfield placement". That sentence names a
// distance without naming what PRODUCES it, and greyness is a product of two independent terms:
//
//     greyness = richnessBand(x,z) x greyAllowance(x,z)
//
// and `greyAllowance` is itself `rim x (1 - t*tended)`. Three terms, and the fix for each is a
// completely different change to the world. Reporting one distance hides which one is binding.
//
// ⚠ THE SUPPRESSION IS DELIBERATE, NOT A DEFECT. zones.ts states it outright: "distance from home
// IS the difficulty axis". Every anchor except the Outfields is `tended: 1`, and at full membership
// the allowance is EXACTLY ZERO, so no greyfield can exist anywhere inside a tended zone at any
// richness. Spawn sits at the heart of one. A change that shortens this walk is a change to the
// difficulty axis and belongs to Alex/Magii, not to worldgen. This tool exists to put numbers under
// that ruling, not to pre-empt it.
//
// ── ⚠⚠ READ THE BANDS, NEVER THE DISC TOTAL — THE TOTAL IS DOMINATED BY ITS OUTER RING ────────
// A disc's area grows as r^2, so >60% of the chunks in a 1024-block scan lie beyond 800 blocks. The
// first run of this tool reported "921 grey chunks within 1024 blocks" and that number, read alone,
// says blight is ABUNDANT near spawn and the scarce thing must be cave mouths — the opposite of the
// truth, and a finding confident enough to have been filed against a peer's correct reading. The
// band table underneath it says 38 grey chunks inside 800 blocks and 456 in the 960–1120 ring.
// Same data, same run, opposite conclusions. An aggregate over a disc is a statement about its rim.
//
// ── THE CONTROLS, because "no grey found" would read as a finding ──────────────────────────────
//   NEGATIVE: greyness at spawn and at the garden heart must be exactly 0. If either is non-zero
//             the allowance term is not doing what zones.ts says and every figure below is suspect.
//   POSITIVE: the sweep must find gate-clearing ground SOMEWHERE. A blind search and a world with
//             no greyfields in it produce identical output, and only this line separates them.
import { greyness, richness, DEFAULT_BIOME } from '../src/app/shimmer/voxel/biome'
import { greyAllowance, zoneAt, ZONE_ANCHORS, RIM_START, RIM_CENTER_X } from '../src/app/shimmer/voxel/zones'
import { HOLLOW_GREY_MIN } from '../src/app/shimmer/voxel3d/hollows'

const SEED = 1337
const MAXR = Number(process.argv[2] ?? 4000)
const GLADE = ZONE_ANCHORS.find(z => z.id === 'moonwell-glade')!
const SX = GLADE.x, SZ = GLADE.z

/** The richness band with the allowance term REMOVED — same derivation as biome.ts, one factor
 *  short, so the two cannot drift apart on the constants. */
function bandOnly(x: number, z: number): number {
  const r = richness(x, z, SEED)
  const t = (DEFAULT_BIOME.greyEdge - r) / (DEFAULT_BIOME.greyEdge - DEFAULT_BIOME.greyCore)
  const c = t < 0 ? 0 : t > 1 ? 1 : t
  return c * c * (3 - 2 * c)
}

console.log(`spawn = moonwell-glade (${SX}, ${SZ})   gate = HOLLOW_GREY_MIN ${HOLLOW_GREY_MIN}\n`)

let bad = 0
const atSpawn = greyness(SX, SZ, SEED), atGarden = greyness(0, 0, SEED)
console.log(`CONTROL neg  greyness at spawn        = ${atSpawn.toFixed(3)}   ${atSpawn === 0 ? 'ok' : 'UNEXPECTED'}`)
console.log(`CONTROL neg  greyness at garden heart = ${atGarden.toFixed(3)}   ${atGarden === 0 ? 'ok' : 'UNEXPECTED'}`)
if (atSpawn !== 0 || atGarden !== 0) bad++

let probe = ''
for (let x = -6000; x <= 6000 && !probe; x += 137)
  for (let z = -6000; z <= 6000 && !probe; z += 137)
    if (greyness(x, z, SEED) >= HOLLOW_GREY_MIN) probe = `(${x},${z}) g=${greyness(x, z, SEED).toFixed(3)}`
console.log(`CONTROL pos  gate-clearing ground at  ${probe || 'NOWHERE FOUND — THE SEARCH IS BLIND, IGNORE EVERYTHING BELOW'}`)
if (!probe) bad++
console.log('')

let firstGrey = -1, firstGreyAt = '', firstBand = -1, firstBandAt = ''
for (let r = 8; r <= MAXR && (firstGrey < 0 || firstBand < 0); r += 8) {
  const steps = Math.max(48, Math.round((2 * Math.PI * r) / 6))
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const x = Math.round(SX + Math.cos(a) * r), z = Math.round(SZ + Math.sin(a) * r)
    if (firstGrey < 0 && greyness(x, z, SEED) >= HOLLOW_GREY_MIN) { firstGrey = r; firstGreyAt = `(${x},${z})` }
    if (firstBand < 0 && bandOnly(x, z) >= HOLLOW_GREY_MIN) { firstBand = r; firstBandAt = `(${x},${z})` }
  }
}
console.log(`nearest gate-clearing ground from spawn        : ${firstGrey < 0 ? '> ' + MAXR : firstGrey} blocks  ${firstGreyAt}`)
console.log(`the same, with the ALLOWANCE TERM SET TO 1     : ${firstBand < 0 ? '> ' + MAXR : firstBand} blocks  ${firstBandAt}`)
console.log(`  (the second is what the walk would be if tendedness and the rim did not exist —`)
console.log(`   the gap between them IS the cost of the difficulty axis, in blocks.)\n`)

console.log('walking due +x from spawn:')
console.log('    r  greyness    band  allowance     rim  zone')
for (let r = 0; r <= 3200; r += r < 1200 ? 200 : 400) {
  const x = Math.round(SX + r), z = SZ
  const zn = zoneAt(x, z, SEED), allow = greyAllowance(x, z, SEED)
  const d = Math.hypot(x - RIM_CENTER_X, z), g = greyness(x, z, SEED)
  console.log(`${String(r).padStart(5)}  ${g.toFixed(3).padStart(8)}  ${bandOnly(x, z).toFixed(3)}  ${allow.toFixed(3).padStart(9)}  ${(d < RIM_START ? 'inland' : 'rim').padStart(6)}  ${zn.zone ? zn.zone.id : 'wild'} t=${zn.t.toFixed(2)} tended=${zn.zone ? zn.zone.tended : 0}`)
}
// ⚠ the control verdict is carried to the END of the run, not exited on here — an early
// exit above PART 2 makes an unrun measurement report success. It did exactly that once.

// ── PART 2: IS THE WALK SET BY WHERE THE GREY IS, OR BY WHETHER THE GREY HAS A MOUTH? ──────────
//
// ⚠ THIS IS THE WHOLE QUESTION AND PART 1 CANNOT ANSWER IT. Part 1 says gate-clearing GROUND is
// close. The board row says the walk is ~950 blocks. Both can be true, and which one is binding
// decides whether the fix is worldgen (move the blight) or dens (put mouths on the blight) — two
// completely different changes. So this runs `/cave`'s own search offline, ring by ring, and
// reports WHY each ring failed: no grey chunk in it at all, or grey chunks with no qualifying
// mouth. Same `aditAt` the generator runs, same pre-filter the command uses.
import { SECTION, DEFAULT_COLUMN } from '../src/app/shimmer/voxel/column'
import { columnHeight } from '../src/app/shimmer/voxel/height'
import { aditStartsAt, aditAt, DEFAULT_ADITS } from '../src/app/shimmer/voxel/dens'
import { carveTopAt, DEFAULT_CARVE } from '../src/app/shimmer/voxel/carve'

const surfaceAt = (x: number, z: number) => columnHeight(x, z, SEED)
const carveTop = (x: number, z: number) =>
  carveTopAt(SEED, x, z, DEFAULT_COLUMN.chunk, surfaceAt, DEFAULT_COLUMN.depth.seaLevel, DEFAULT_CARVE)
const seaL = DEFAULT_COLUMN.depth.seaLevel

const RINGS = Number(process.env.RINGS ?? 72)
const b0x = Math.floor(SX / SECTION), b0z = Math.floor(SZ / SECTION)
let greyChunks = 0, greyWithAnyAdit = 0, greyWithGreyMouth = 0, anyAditChunks = 0, scanned = 0
let firstMouth: { x: number, z: number, d: number, g: number, ring: number } | null = null
const BAND_W = 160
const BANDS = Array.from({ length: 8 }, () => ({ n: 0, grey: 0, mouth: 0, both: 0 }))
const t0 = Date.now()
for (let r = 0; r <= RINGS; r++) {
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue
    scanned++
    const cx = b0x + dx, cz = b0z + dz
    const centreGrey = greyness(cx * SECTION + SECTION / 2, cz * SECTION + SECTION / 2, SEED)
    const isGrey = centreGrey >= HOLLOW_GREY_MIN
    if (isGrey) greyChunks++
    let sawAdit = false, sawGreyMouth = false
    for (const st of aditStartsAt(SEED, cx, cz, SECTION, DEFAULT_ADITS)) {
      const plan = aditAt(st, surfaceAt, seaL, carveTop, DEFAULT_ADITS)
      if (!plan) continue
      sawAdit = true
      const mx = Math.round(plan.mouthX), mz = Math.round(plan.mouthZ)
      const g = greyness(mx, mz, SEED)
      if (g >= HOLLOW_GREY_MIN) {
        sawGreyMouth = true
        const d = Math.round(Math.hypot(mx - SX, mz - SZ))
        if (!firstMouth || d < firstMouth.d) firstMouth = { x: mx, z: mz, d, g, ring: r }
      }
    }
    const bandI = Math.min(BANDS.length - 1, Math.floor(Math.hypot(cx * SECTION + 8 - SX, cz * SECTION + 8 - SZ) / BAND_W))
    BANDS[bandI].n++
    if (isGrey) BANDS[bandI].grey++
    if (sawAdit) BANDS[bandI].mouth++
    if (isGrey && sawGreyMouth) BANDS[bandI].both++
    if (sawAdit) anyAditChunks++
    if (isGrey && sawAdit) greyWithAnyAdit++
    if (isGrey && sawGreyMouth) greyWithGreyMouth++
  }
}
console.log(`\n── PART 2: ${scanned} chunks scanned out to ring ${RINGS} (~${RINGS * SECTION} blocks), ${((Date.now() - t0) / 1000).toFixed(1)}s`)
console.log(`chunks whose centre clears the grey gate     : ${greyChunks}  (${(100 * greyChunks / scanned).toFixed(2)}%)`)
console.log(`chunks with ANY cave mouth                   : ${anyAditChunks}  (${(100 * anyAditChunks / scanned).toFixed(2)}%)`)
console.log(`grey chunks that ALSO have a mouth           : ${greyWithAnyAdit}`)
console.log(`grey chunks with a mouth that is ITSELF grey : ${greyWithGreyMouth}`)
console.log(firstMouth
  ? `\nnearest qualifying mouth: (${firstMouth.x},${firstMouth.z})  ${firstMouth.d} blocks  greyness ${firstMouth.g.toFixed(3)}  [ring ${firstMouth.ring}]`
  : `\nNO qualifying mouth inside ${RINGS * SECTION} blocks`)
console.log('\ndistance band   chunks    grey   any mouth   grey+grey mouth')
BANDS.forEach((b, i) => {
  if (!b.n) return
  console.log(`${String(i * BAND_W).padStart(5)}-${String((i + 1) * BAND_W).padEnd(6)} ${String(b.n).padStart(6)}  ${String(b.grey).padStart(6)}  ${String(b.mouth).padStart(10)}  ${String(b.both).padStart(16)}`)
})
console.log(`\nANSWERED 2026-09-08: grey is 0.48% of chunks inside 800 blocks and 13.9% at 960-1120.`)
console.log(`The frontier IS the walk. Mouths sit at 0.66-0.93% everywhere and are NOT the constraint.`)

process.exit(bad ? 1 : 0)
