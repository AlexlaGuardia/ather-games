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
  /** A field has been computed at least once. ⚠ NOT the same as fit to look at — see `eligible`. */
  ready: boolean
  /**
   * The packed field, kept rather than handed straight to the texture.
   *
   * ★★ BECAUSE A COLUMN IS USUALLY NOT FIT TO UPLOAD WHEN IT IS FIRST COMPUTED, and it becomes fit
   * because a NEIGHBOUR finished, at which point the field is already right and rebuilding it would
   * be a wasted 60ms pass. 64KB x 81 columns is 5.3MB against the 22MB of voxels the page already
   * holds for the same ring.
   */
  packed: Uint8Array | null
  /** True when `packed` has not yet reached the texture. */
  texDirty: boolean
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
      r.cols.set(k, {
        cx: ccx + dx, cz: ccz + dz, spill: newBorders(), ready: false, packed: null, texDirty: false,
      })
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
export function nextDirtyColumn(r: LightRing, accept?: (c: RingColumn) => boolean): RingColumn | null {
  let best: RingColumn | null = null
  let bestD = Infinity
  for (const k of r.dirty) {
    const c = r.cols.get(k)
    if (!c) continue
    // ⚠ A REJECTED COLUMN STAYS DIRTY. The host's reason for refusing one is that its voxels have
    // not streamed in yet, which is temporary — clearing the flag here would mean the column is
    // never built once it arrives, and it would render fully lit forever with nothing to show for
    // it. Skipping is the whole contract of this parameter.
    if (accept && !accept(c)) continue
    // ── ★★★ NEVER-BUILT BEATS RE-SETTLING, GLOBALLY — NOT JUST AS A TIEBREAK (measured) ───────
    // The first version sorted by distance and used `ready` only to break a tie. Every publish
    // re-dirties neighbours, so the columns nearest the keeper are re-served forever and the ring
    // warms as a slowly expanding, endlessly resettling blob: **77 passes produced 14 built columns**
    // in the running page, and the outer ring never got a turn at all.
    //
    // The two states are not comparable and should never have been sorted on one axis. An UNBUILT
    // column renders fully lit, which underground is a bright hole where a cave should be. A
    // re-settling one is already close and gets a shade darker. So every unbuilt column outranks
    // every settled one, and distance orders within each band. It still terminates: once nothing is
    // unbuilt the first band is empty and the settling passes run.
    const d = Math.max(Math.abs(c.cx - r.ccx), Math.abs(c.cz - r.ccz)) + (c.ready ? 1000 : 0)
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

/**
 * Did what leaves by ONE face change?
 *
 * ★★ PER FACE, NOT PER COLUMN, AND THE DIFFERENCE IS A FACTOR OF FOUR. A whole-borders compare
 * cannot say WHICH neighbour is affected, so it wakes all four — three of them to recompute an
 * identical field and publish an identical spill. Light that leaves by the +x face reaches exactly
 * one column, so exactly one column needs to hear about it.
 */
const faceDiffers = (a: LightBorders, b: LightBorders, face: number): boolean => {
  const lo = face * HEIGHT * SPAN, hi = lo + HEIGHT * SPAN
  for (let i = lo; i < hi; i++) if (a.sky[i] !== b.sky[i] || a.blk[i] !== b.blk[i]) return true
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
export function publishSpill(
  r: LightRing, cx: number, cz: number, spill: LightBorders, packed: Uint8Array | null = null,
): boolean {
  const k = ringKey(cx, cz)
  const c = r.cols.get(k)
  r.dirty.delete(k)
  if (!c) return false
  if (packed) { c.packed = packed; c.texDirty = true }          // it left the ring while its slice was in flight
  // ⚠ NOT `!c.ready || ...`. A first publish whose spill is all zeros — a sealed column, which is
  // most of a ring — changes nothing for its neighbours, and waking them anyway made every column
  // recompute about five times. The question is only ever whether what LEAVES has changed.
  let woke = false
  // Face order matches `FACE_*`; the neighbour a face's light reaches is the column on that side.
  const NEIGHBOUR: readonly (readonly [number, number])[] = [[-1, 0], [1, 0], [0, -1], [0, 1]]
  for (let face = 0; face < 4; face++) {
    if (!faceDiffers(c.spill, spill, face)) continue
    const [dx, dz] = NEIGHBOUR[face]
    const nk = ringKey(cx + dx, cz + dz)
    if (!r.cols.has(nk) || r.dirty.has(nk)) continue
    r.dirty.add(nk); woke = true
  }
  c.spill = spill
  c.ready = true
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

/**
 * ── ★★★ READY IS NOT FIT TO LOOK AT, AND CONFLATING THEM SHIPPED A BLACK WALL ──────────────────
 *
 * The header above argues that the outermost ring must not be sampled, because its neighbours were
 * never built and it therefore reads their spill as zero and comes out darker than the truth. That
 * argument is correct and it is about the SETTLED ring. It is silent about the warm-up, where the
 * same sentence is true of EVERY column: the first one built has four unbuilt neighbours, so its
 * light is under-computed within fifteen blocks of each border — which is nearly all of it.
 *
 * ⚠ Measured, not reasoned: a headless shot with 2 of 81 columns built photographed a solid black
 * cliff face at noon; the same place with 20 built rendered correctly. Both were "working".
 *
 * So a column reaches the texture only when it AND its four neighbours have a field. Until then its
 * slot holds daylight, which is exactly today's render. ★ And this subsumes the apron rule rather
 * than sitting beside it: a column on the outer ring has neighbours that are not in the ring at
 * all, so it can never become eligible and can never be uploaded — the apron falls out of the same
 * sentence instead of needing its own radius check.
 */
export function eligible(r: LightRing, cx: number, cz: number): boolean {
  const c = r.cols.get(ringKey(cx, cz))
  if (!c || !c.ready || !c.packed) return false
  for (const [nx, nz] of [[cx - 1, cz], [cx + 1, cz], [cx, cz - 1], [cx, cz + 1]] as const) {
    const n = r.cols.get(ringKey(nx, nz))
    if (!n || !n.ready) return false
  }
  return true
}

/**
 * The columns around `(cx, cz)` that are now fit to upload and have something new to send.
 *
 * ⚠ THE 3x3, NOT JUST THE PUBLISHER. Finishing one column is what makes its NEIGHBOURS eligible,
 * and their fields are already computed — asking them to rebuild in order to be uploaded would cost
 * a 60ms pass each to produce bytes we are already holding.
 */
export function drainUploads(r: LightRing, cx: number, cz: number): RingColumn[] {
  const out: RingColumn[] = []
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const c = r.cols.get(ringKey(cx + dx, cz + dz))
      if (!c || !c.texDirty || !eligible(r, cx + dx, cz + dz)) continue
      c.texDirty = false
      out.push(c)
    }
  }
  return out
}
