// ── How long does the render-light ring take to warm, and which half of that can be measured? ──
//
// Run: npx tsx scripts/ring-warm.mts [zone-id ...]
//
// ── ★★★ THE NUMBER EVERYONE WANTS IS A PRODUCT OF THREE TERMS AND ONLY TWO ARE MEASURABLE HERE ──
//   warm seconds = (total CPU ms of light work) / (ms spent per frame x frames per second)
// The numerator is deterministic and this script measures it exactly. The per-frame spend is
// `RENDER_LIGHT_MS` plus the overshoot of a slice that cannot stop mid-unit, and that is measured
// in the page (`window.__renderlight().meter`). **Frames per second on Alex's UHD 630 is the term
// nobody on this box can measure**, so it is a PARAMETER here and never a claim.
//
// ⚠ THIS EXISTS BECAUSE THE OLD FIGURE WAS A READING OF A BUILD THAT NO LONGER EXISTS. "63-73ms per
// column, ~33s cold" was taken in the browser BEFORE the full-column seed change (9c537d4) and
// before the Minecraft leaf rule, and it was repeated afterwards as though it still held. A stale
// number that is quoted confidently is this repo's oldest failure and it does not stop being one
// when the person quoting it is the person who measured it.
//
// ── ★★ AND "WARM" IS THREE DIFFERENT QUESTIONS, WHICH IS MOST OF WHY THE OLD ANSWER MISLED ──────
//   1. FIRST SIGHT   — the keeper's own column reaches the texture. Needs it AND its four
//                      neighbours built (see `eligible`), so it is never one pass.
//                      **This is the felt number: how long until the cave you walked into goes dark.**
//   2. FULL VIEW     — every column inside SAMPLE_RADIUS is on the texture. What you see turning.
//   3. SETTLED       — the dirty queue is empty, apron included. Nobody ever waits for this.
// Reporting 3 as "the warm time" overstates the wait by roughly an order of magnitude.
import { makeColumn, SECTION } from '../src/app/shimmer/voxel/column'
import { computeRenderLight, packForTexture } from '../src/app/shimmer/voxel/render-light'
import {
  newLightRing, recenterRing, nextDirtyColumn, incomingFor, publishSpill,
  eligible, drainUploads, ringKey, BUILD_RADIUS, SAMPLE_RADIUS,
} from '../src/app/shimmer/voxel/render-light-ring'
import { RENDER_LIGHT_MS } from '../src/app/shimmer/voxel3d/spawn-budget'
import { ZONE_ANCHORS } from '../src/app/shimmer/voxel/zones'

const SEED = 1337
/** Measured in the page: a slice asked for 3ms actually spends this, because a unit cannot stop. */
const MEASURED_SLICE_MS = Number(process.env.SLICE_MS ?? RENDER_LIGHT_MS)

const cols = new Map<string, ReturnType<typeof makeColumn>>()
const colAt = (cx: number, cz: number) => {
  const k = `${cx},${cz}`
  let c = cols.get(k)
  if (!c) { c = makeColumn(cx * SECTION, cz * SECTION, SEED); cols.set(k, c) }
  return c
}
// ⚠ THE HOST'S ACCESSOR, NOT A CONVENIENT ONE. `voxel()` builds a template-string key and hits a
// Map per call and the seed phase asks ~65,000 times a pass; binding the reader to the one column
// halved the measured cost. A bench that passes a cheap closure measures a host that does not exist.
const matForColumn = (col: ReturnType<typeof makeColumn>) =>
  (x: number, y: number, z: number): number => {
    if (y < 0 || y >= 256) return 0
    const lx = x - col.wx, lz = z - col.wz
    // ⚠ THE HOST'S BOUNDS CHECKS AND FALLBACK BRANCH ARE HERE ON PURPOSE, even though the flood
    // never leaves the footprint and they can never fire. They are ~65,000 extra comparisons per
    // pass and this script exists to be comparable with the page; a bench that quietly runs a
    // cheaper accessor than the host measures a host that does not exist.
    if (lx < 0 || lx >= SECTION || lz < 0 || lz >= SECTION) return colAt(Math.floor(x / SECTION), Math.floor(z / SECTION)).get(((x % SECTION) + SECTION) % SECTION, y, ((z % SECTION) + SECTION) % SECTION)
    return col.get(lx, y, lz)
  }

function warm(id: string, cx: number, cz: number) {
  cols.clear()
  // Generate first and separately: timing terrain noise and calling it lighting is the exact
  // mistake the 09-08 bench made, inside the instrument judging the change.
  for (let dz = -BUILD_RADIUS; dz <= BUILD_RADIUS; dz++)
    for (let dx = -BUILD_RADIUS; dx <= BUILD_RADIUS; dx++) colAt(cx + dx, cz + dz)

  const ring = newLightRing()
  recenterRing(ring, cx, cz)
  const shown = new Set<string>()
  let passes = 0, ms = 0
  let firstSight = -1, firstSightMs = -1
  let fullView = -1, fullViewMs = -1

  const wantShown = (2 * SAMPLE_RADIUS + 1) ** 2
  for (;;) {
    const c = nextDirtyColumn(ring)
    if (!c || passes > 4000) break
    passes++
    const col = colAt(c.cx, c.cz)
    const t0 = performance.now()
    const f = computeRenderLight(c.cx * SECTION, c.cz * SECTION, matForColumn(col), incomingFor(ring, c.cx, c.cz))
    // The host packs before publishing, and the pack is real per-pass work — 64KB of nibbling.
    const packed = packForTexture(f)
    publishSpill(ring, c.cx, c.cz, f.spill, packed)
    for (const up of drainUploads(ring, c.cx, c.cz)) shown.add(ringKey(up.cx, up.cz))
    ms += performance.now() - t0

    if (firstSight < 0 && eligible(ring, cx, cz) && shown.has(ringKey(cx, cz))) { firstSight = passes; firstSightMs = ms }
    if (fullView < 0) {
      let n = 0
      for (let dz = -SAMPLE_RADIUS; dz <= SAMPLE_RADIUS; dz++)
        for (let dx = -SAMPLE_RADIUS; dx <= SAMPLE_RADIUS; dx++) if (shown.has(ringKey(cx + dx, cz + dz))) n++
      if (n === wantShown) { fullView = passes; fullViewMs = ms }
    }
  }

  // ⚠⚠ NO `/ 1000`, AND THE FIRST VERSION HAD ONE. The denominator is already MILLISECONDS OF
  // BUDGET PER SECOND (`ms per frame x frames per second`), so dividing ms of work by it yields
  // seconds directly. The stray thousand printed **0.0s** for every row — a wait of two and a half
  // seconds reported as instant, i.e. failing toward *there is no problem here*, which is the
  // direction that gets banked as good news and never re-checked. It was caught only because a
  // 2177ms job finishing in 0.0s at 30fps is not physically possible.
  const secs = (workMs: number, fps: number) => workMs / (MEASURED_SLICE_MS * fps)
  const row = (label: string, p: number, w: number) =>
    p < 0 ? `  ${label.padEnd(11)}  never` :
    `  ${label.padEnd(11)}  ${String(p).padStart(4)} passes  ${w.toFixed(0).padStart(6)}ms work` +
    `   ->  ${secs(w, 60).toFixed(1)}s @60fps   ${secs(w, 30).toFixed(1)}s @30fps`
  console.log(`\n── ${id}  (column ${cx},${cz})`)
  console.log(`  ${passes} passes, ${ms.toFixed(0)}ms total, ${(ms / passes).toFixed(1)}ms per pass`)
  console.log(row('FIRST SIGHT', firstSight, firstSightMs))
  console.log(row('FULL VIEW', fullView, fullViewMs))
  console.log(row('SETTLED', passes, ms))
  return { id, passes, ms, perPass: ms / passes, firstSight, firstSightMs, fullView, fullViewMs }
}

const want = process.argv.slice(2)
const picked = ZONE_ANCHORS.filter(z => (want.length ? want.includes(z.id) : ['moonwell-glade', 'twilight-thicket'].includes(z.id)))
if (!picked.length) { console.error(`no such zone. ids: ${ZONE_ANCHORS.map(z => z.id).join(', ')}`); process.exit(2) }

console.log(`RENDER_LIGHT_MS=${RENDER_LIGHT_MS}  slice spend used=${MEASURED_SLICE_MS}ms` +
  `  (override with SLICE_MS=, measured in the page via __renderlight().meter)`)
console.log(`ring ${2 * BUILD_RADIUS + 1}x${2 * BUILD_RADIUS + 1} built, ${2 * SAMPLE_RADIUS + 1}x${2 * SAMPLE_RADIUS + 1} sampled`)
const out = picked.map(z => warm(z.id, Math.floor(z.x / SECTION), Math.floor(z.z / SECTION)))

console.log(`\n★ FIRST SIGHT is the felt number — the cave you walked into going dark.`)
console.log(`⚠ FPS IS A PARAMETER, NOT A MEASUREMENT. This box has no GPU; headless SwiftShader runs`)
console.log(`  2386ms frames, so any columns-per-second taken here is a reading of the renderer and`)
console.log(`  not of this feature. The ms-of-work column is the honest half.`)
const worst = out.reduce((a, b) => (b.perPass > a.perPass ? b : a))
console.log(`\nper-pass spread: ${out.map(o => `${o.id} ${o.perPass.toFixed(1)}ms`).join('  ·  ')}`)
console.log(`worst: ${worst.id}`)
