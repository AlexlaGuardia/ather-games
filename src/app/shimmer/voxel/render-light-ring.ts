// The ring of columns whose render light is kept warm, and the rules that make it settle.
//
// ★ PURE CORE. No react/three/DOM (purity.test.ts enforces). `render-light.ts` computes ONE pass
// over ONE column; this file answers the three questions the host cannot: which column to spend the
// next slice on, what light is arriving at it, and who has to re-run because of what it published.
//
// ── ★★★ WHY A RING AND NOT THE WHOLE VIEW (2026-09-08) ─────────────────────────────────────────
// `viewRadius` reaches 12, which is 625 columns, and a column is 22ms. Warming that is 13.7 seconds
// of CPU — about two minutes at the host's slice — and 40MB of texture. Neither is affordable, and
// paying either would be paying for nothing: **above ground the answer is 15 everywhere**, so the
// only place this field says anything a keeper can see is a cave, and a cave four columns away is
// behind sixty-four blocks of rock. A column with no field renders exactly as the game does today,
// which is the right fallback and not a degradation.
//
// ── ★★ THE OUTERMOST RING IS BUILT AND NOT SAMPLED, AND THAT IS THE WHOLE REASON IT EXISTS ─────
// A column's light depends on its neighbours' spill. The outermost built column has neighbours that
// were never built, so it reads their spill as zero and comes out DARKER than the truth — a seam,
// and a seam is exactly the artefact this design is most likely to ship. So `BUILD_RADIUS` is one
// wider than `SAMPLE_RADIUS`: the outer ring is an apron whose only job is to hand correct spill
// inward. ⚠ Do not "optimise" the apron away by sampling to the build edge; it costs 1 - (7/9)^2 =
// 40% of the columns and it is buying the absence of a visible ring around the player.
import {
  HEIGHT, SPAN, newBorders, OPPOSITE,
  FACE_XM, FACE_XP, FACE_ZM, FACE_ZP,
  type LightBorders,
} from './render-light'

/** How far out fields are BUILT, in columns. The outer ring is apron — see the header. */
export const BUILD_RADIUS = 4
/** How far out a fragment may READ the field. One in from the build edge, always. */
export const SAMPLE_RADIUS = BUILD_RADIUS - 1
/** Columns across the toroidal texture. Derived, never typed twice. */
export const RING_N = BUILD_RADIUS * 2 + 1

/**
 * Where a column's field lives in the ring texture.
 *
 * ★ THE TEXTURE IS A TORUS, so walking does not move any data. A column keeps its slot for as long
 * as it is in the ring, and when the ring rolls past it the slot is reused by the column exactly
 * `RING_N` away — which is by construction the one that just left. The alternative is a slot
 * allocator plus a per-mesh uniform saying which slot, and a per-mesh uniform is a per-mesh
 * material, which `mesh-bridge.ts` refuses in writing ("a material per chunk is a shader program
 * per chunk, and hundreds of programs is how a voxel renderer dies").
 *
 * ⚠ NOT `c % RING_N` — that is negative for negative columns and the world has plenty of those.
 */
export const slotOf = (c: number): number => ((c % RING_N) + RING_N) % RING_N

export const ringKey = (cx: number, cz: number): string => `${cx},${cz}`

export interface RingColumn {
  cx: number
  cz: number
  /** What this column sends to its neighbours. Zeroed until its first pass finishes. */
  spill: LightBorders
  /** A field has been published at least once, so the texture slot holds real data. */
  ready: boolean
}

export interface LightRing {
  cols: Map<string, RingColumn>
  dirty: Set<string>
  ccx: number
  ccz: number
  /** Set once the centre has been established. Before that the ring holds nothing. */
  centred: boolean
}

export const newLightRing = (): LightRing => ({
  cols: new Map(), dirty: new Set(), ccx: 0, ccz: 0, centred: false,
})

const inRing = (r: LightRing, cx: number, cz: number): boolean =>
  Math.abs(cx - r.ccx) <= BUILD_RADIUS && Math.abs(cz - r.ccz) <= BUILD_RADIUS

/**
 * Move the ring to a new centre column.
 *
 * Returns the keys that left, so the host can mark their texture slots as holding nothing — ⚠ which
 * it MUST do, because the slot is immediately reused by a different column and a stale slot renders
 * one place's darkness onto another's geometry. Fields for columns that stayed are untouched.
 */
export function recenterRing(r: LightRing, ccx: number, ccz: number): string[] {
  if (r.centred && r.ccx === ccx && r.ccz === ccz) return []
  r.ccx = ccx; r.ccz = ccz; r.centred = true
  const gone: string[] = []
  for (const [k, c] of r.cols) {
    if (inRing(r, c.cx, c.cz)) continue
    r.cols.delete(k); r.dirty.delete(k); gone.push(k)
  }
  for (let dz = -BUILD_RADIUS; dz <= BUILD_RADIUS; dz++) {
    for (let dx = -BUILD_RADIUS; dx <= BUILD_RADIUS; dx++) {
      const k = ringKey(ccx + dx, ccz + dz)
      if (r.cols.has(k)) continue
      r.cols.set(k, { cx: ccx + dx, cz: ccz + dz, spill: newBorders(), ready: false })
      r.dirty.add(k)
    }
  }
  return gone
}

/**
 * The dirty column nearest the centre, or null.
 *
 * ★ NEAREST FIRST, because the field the keeper is standing in is the only one they can see, and a
 * ring warmed in map order lights the far corner of the ring first and the cave under their feet
 * last. Chebyshev distance, matching the ring's own square shape — a Euclidean sort would order the
 * corners of a square ring in a way that looks arbitrary on screen.
 */
export function nextDirtyColumn(r: LightRing): RingColumn | null {
  let best: RingColumn | null = null
  let bestD = Infinity
  for (const k of r.dirty) {
    const c = r.cols.get(k)
    if (!c) continue
    // Un-built columns beat built-but-restaled ones at the same distance: a column with no field at
    // all renders fully lit, which is the visible defect; a settling border is a shade.
    const d = Math.max(Math.abs(c.cx - r.ccx), Math.abs(c.cz - r.ccz)) * 2 + (c.ready ? 1 : 0)
    if (d < bestD) { bestD = d; best = c }
  }
  return best
}

/**
 * The light arriving at a column, assembled from its four neighbours' spill.
 *
 * ★ ASSEMBLED ON DEMAND, NOT ACCUMULATED. An accumulated `incoming` is a second copy of a fact its
 * neighbours already hold, and this tree has paid repeatedly for hand-kept mirrors that agree with
 * their source right up until they do not. Reading the neighbours costs one 32KB copy per pass
 * against a 22ms flood.
 *
 * ⚠ A NEIGHBOUR OUTSIDE THE RING CONTRIBUTES ZERO, which makes the outermost built column darker
 * than the truth. That is why it is an apron and never sampled — see the header.
 */
export function incomingFor(r: LightRing, cx: number, cz: number): LightBorders {
  const inc = newBorders()
  const take = (nx: number, nz: number, leftBy: number): void => {
    const n = r.cols.get(ringKey(nx, nz))
    if (!n || !n.ready) return
    // The neighbour's spill is indexed by the face it left THEM by; it arrives on the opposite face.
    const arrivesOn = OPPOSITE[leftBy]
    for (let y = 0; y < HEIGHT; y++) {
      for (let s = 0; s < SPAN; s++) {
        const from = (leftBy * HEIGHT + y) * SPAN + s
        const to = (arrivesOn * HEIGHT + y) * SPAN + s
        inc.sky[to] = n.spill.sky[from]
        inc.blk[to] = n.spill.blk[from]
      }
    }
  }
  // The neighbour to our -x spills out of ITS +x face, and that arrives on our -x face.
  take(cx - 1, cz, FACE_XP)
  take(cx + 1, cz, FACE_XM)
  take(cx, cz - 1, FACE_ZP)
  take(cx, cz + 1, FACE_ZM)
  return inc
}

const bordersDiffer = (a: LightBorders, b: LightBorders): boolean => {
  for (let i = 0; i < a.sky.length; i++) if (a.sky[i] !== b.sky[i] || a.blk[i] !== b.blk[i]) return true
  return false
}

/**
 * Record a finished pass. Returns true if any neighbour was re-dirtied.
 *
 * ── ★★★ WHY "CHANGED", NOT "RAISED", AND WHY IT STILL TERMINATES ───────────────────────────────
 * The obvious rule is to re-dirty a neighbour only when the spill went UP, because light only ever
 * increases and that makes the argument trivial. It is also wrong the moment a block is PLACED: the
 * spill drops, nothing is re-dirtied, and the neighbour keeps the light of a wall that is no longer
 * open — phantom light, permanent, and invisible to every test that only ever adds air.
 *
 * ★ Termination survives the wider rule because EVERY BORDER CROSSING COSTS A LEVEL. Light that
 * leaves A into B and comes back is two levels weaker than it left, so a cycle between columns is
 * strictly decaying and dies within ~8 round trips rather than sustaining itself. That is the
 * property that lets this be a plain dirty queue instead of Minecraft's separate un-light pass.
 */
export function publishSpill(r: LightRing, cx: number, cz: number, spill: LightBorders): boolean {
  const k = ringKey(cx, cz)
  const c = r.cols.get(k)
  r.dirty.delete(k)
  if (!c) return false          // it left the ring while its slice was in flight
  // ⚠ NOT `!c.ready || ...`. A first publish whose spill is all zeros — a sealed column, which is
  // most of a ring — changes nothing for its neighbours, and waking them anyway made every column
  // recompute about five times. The question is only ever whether what LEAVES has changed.
  const changed = bordersDiffer(c.spill, spill)
  c.spill = spill
  c.ready = true
  if (!changed) return false
  let woke = false
  for (const [nx, nz] of [[cx - 1, cz], [cx + 1, cz], [cx, cz - 1], [cx, cz + 1]] as const) {
    const nk = ringKey(nx, nz)
    if (!r.cols.has(nk) || r.dirty.has(nk)) continue
    r.dirty.add(nk); woke = true
  }
  return woke
}

/**
 * A voxel changed at a world position: re-run everything its light can reach.
 *
 * ⚠ THE 3x3, NOT THE ONE COLUMN. Light reaches 15 blocks and a column is 16 wide, so a lantern
 * broken at a column's corner darkens cells in three other columns — including the diagonal, which
 * is the one an "adjacent" rule forgets. The spills are NOT cleared: they are the seeds the
 * recompute reads, and a decaying cycle removes phantom light on its own (see `publishSpill`).
 */
export function invalidateColumn(r: LightRing, cx: number, cz: number): void {
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const k = ringKey(cx + dx, cz + dz)
      if (r.cols.has(k)) r.dirty.add(k)
    }
  }
}

/** Does this column's field exist AND is it close enough to be read by a fragment? */
export function sampleable(r: LightRing, cx: number, cz: number): boolean {
  const c = r.cols.get(ringKey(cx, cz))
  return !!c && c.ready
    && Math.abs(cx - r.ccx) <= SAMPLE_RADIUS && Math.abs(cz - r.ccz) <= SAMPLE_RADIUS
}
