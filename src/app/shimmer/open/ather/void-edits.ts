// BETA M104: THE VOID BRUSH's layer (Alex 11-23: "an eraser to remove the lines that are marked for it.. a few areas that the
// voids dont make too much sense"). The voids are GENERATED (wilds-voids.ts makeVoids) and the carve overrides height, so a sculpt
// cannot fill one. The owner's overrides sit on top, in the map's builder layer (`voids` beside tiles/water/falls, the same
// draft -> publish -> version -> rollback flow), as a sparse grid of VCELL squares:
//   -1 ERASE  the crust holds there: Settle ground, a cooled neck in all but name (canon-safe, nothing new is named)
//   +1 PAINT  the crust is gone there: void, like a generated strip (never on protected ground: the Glade, a settlement or the
//             fair, the arrival, a path's corridor; a path is never cut)
// makeVoids applies it POINTWISE (voidOverrides below), so every reader of the VoidField (the carve, the walker + fall, the void
// look's floor/fog, the minimap, the builder's tile view, overview, the overlay's crossings) sees the same edited voids.
// The PUBLISH GUARD (sealedRegions) is the M41 on-foot walk (wilds-voids.test.ts section 3): a raster walk from Moonwell where a
// void is a wall; a region the keeper reaches with NO voids but not with the edited ones has been sealed.
// PURE. No three, no React, no DOM, no fetch.

export type VoidEdits = Record<string, number>   // "i_j" (cell of VCELL m) -> -1 erase | 1 paint
export const VCELL = 8
/** a cell's full-strength core (centre to here), then the edge rolls over across OV_FADE, like a generated void's lip */
export const OV_CORE = 6
export const OV_FADE = 10
export const VOIDS_MAX = 200_000
const KEY = /^-?\d{1,5}_-?\d{1,5}$/

export const cellKey = (i: number, j: number) => `${i}_${j}`
export const cellOf = (v: number) => Math.floor(v / VCELL)

/** junk-proof: the `voids` map of a layer file; anything that is not "i_j": -1|1 is dropped */
export function cleanVoids(j: unknown): VoidEdits {
  const raw = (j as { voids?: unknown } | null)?.voids, out: VoidEdits = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  let n = 0
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= VOIDS_MAX) break
    if (KEY.test(k) && (v === 1 || v === -1)) { out[k] = v; n++ }
  }
  return out
}

/** the cells a stroke at (x, z) of radius r sets: mode -1 erase / 1 paint (the editor merges these into its store, one undo) */
export function paintVoids(cur: VoidEdits | undefined, x: number, z: number, r: number, mode: -1 | 1): VoidEdits {
  const d: VoidEdits = {}, R = Math.max(r, VCELL / 2)
  for (let j = cellOf(z - R); j <= cellOf(z + R); j++) for (let i = cellOf(x - R); i <= cellOf(x + R); i++) {
    if (Math.hypot((i + 0.5) * VCELL - x, (j + 0.5) * VCELL - z) > R) continue
    const k = cellKey(i, j); if (cur?.[k] !== mode) d[k] = mode
  }
  return d
}

const smooth = (t: number) => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c) }
const nk = (i: number, j: number) => i * 1000003 + j
const BLK = 64

/** erase(x, z) / paint(x, z): 0..1, how strongly the owner's cells hold here. null = no overrides (makeVoids is unchanged). */
export function voidOverrides(ov: VoidEdits | null | undefined): { erase(x: number, z: number): number; paint(x: number, z: number): number } | null {
  if (!ov) return null
  const cells = new Map<number, number>(), near = new Set<number>()
  const reach = OV_CORE + OV_FADE, rb = Math.ceil(reach / BLK) + 1
  for (const [k, v] of Object.entries(ov)) {
    if (v !== 1 && v !== -1) continue
    const [i, j] = k.split('_').map(Number); if (!Number.isInteger(i) || !Number.isInteger(j)) continue
    cells.set(nk(i, j), v)
    const bi = Math.floor((i + 0.5) * VCELL / BLK), bj = Math.floor((j + 0.5) * VCELL / BLK)
    for (let b = -rb; b <= rb; b++) for (let a = -rb; a <= rb; a++) near.add(nk(bi + a, bj + b))
  }
  if (!cells.size) return null
  const R = Math.ceil(reach / VCELL)
  const field = (want: number) => (x: number, z: number): number => {
    if (!near.has(nk(Math.floor(x / BLK), Math.floor(z / BLK)))) return 0
    const ci = cellOf(x), cj = cellOf(z); let best = 0
    for (let j = cj - R; j <= cj + R; j++) for (let i = ci - R; i <= ci + R; i++) {
      if (cells.get(nk(i, j)) !== want) continue
      const d = Math.hypot((i + 0.5) * VCELL - x, (j + 0.5) * VCELL - z)
      const c = d <= OV_CORE ? 1 : d >= reach ? 0 : 1 - smooth((d - OV_CORE) / OV_FADE)
      if (c > best) { best = c; if (best >= 1) return 1 }
    }
    return best
  }
  return { erase: field(-1), paint: field(1) }
}

// ── the publish guard: the M41 on-foot walk ──
export interface WalkField { regionAt(x: number, z: number): number; weight(x: number, z: number): number; regions: { id: number; zone: string; squares: number }[] }
export const WALK = { step: 8, ox: -5200, oz: -5200, size: 10400 } as const
/** the regions a keeper reaches ON FOOT from (sx, sz): a raster walk (8-connected, WALK.step) over the zone grid, wall cells skipped */
export function onFootRegions(V: Pick<WalkField, 'regionAt'>, sx: number, sz: number, wall: (x: number, z: number) => boolean): Set<number> {
  const { step, ox, oz } = WALK, n = Math.ceil(WALK.size / step)
  const si = Math.round((sx - ox) / step), sj = Math.round((sz - oz) / step)
  const seen = new Uint8Array(n * n), st = [si + sj * n], R = new Set<number>(); seen[st[0]] = 1
  while (st.length) {
    const k = st.pop()!, i = k % n, j = (k - i) / n; R.add(V.regionAt(ox + i * step, oz + j * step))
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= n || b >= n || seen[a + b * n]) continue
      const x = ox + a * step, z = oz + b * step; if (V.regionAt(x, z) < 0 || wall(x, z)) continue
      seen[a + b * n] = 1; st.push(a + b * n)
    }
  }
  R.delete(-1)
  return R
}
/** the regions the edited voids SEAL: reached from (sx, sz) with no voids at all, but not with these (weight >= fallW = a wall).
 *  `base` = a cached no-void walk (it depends on the zone grid alone). [] = every zone is still reachable on foot. */
export function sealedRegions(V: WalkField, sx: number, sz: number, fallW: number, base?: Set<number>): { id: number; zone: string; squares: number }[] {
  const b = base ?? onFootRegions(V, sx, sz, () => false)
  const withV = onFootRegions(V, sx, sz, (x, z) => V.weight(x, z) >= fallW)
  return [...b].filter(r => !withV.has(r)).map(r => V.regions[r]).filter(Boolean)
}
/** the refusal's sentence: names each sealed zone once (largest first), so the owner knows where to look */
export function sealedMessage(sealed: { zone: string; squares: number }[]): string {
  if (!sealed.length) return ''
  const byZone = new Map<string, number>()
  for (const s of sealed) byZone.set(s.zone, (byZone.get(s.zone) ?? 0) + s.squares)
  const names = [...byZone].sort((a, b) => b[1] - a[1]).map(([z, n]) => `${z} (${n} square${n > 1 ? 's' : ''})`)
  return `Publish refused: the edited voids cut ${names.join(', ')} off from Moonwell on foot. Erase a way across, then publish.`
}
