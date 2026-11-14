// WHAT THE KEEPER HAS WALKED — the fog on the fold map (Alex 11-14: "a map showing all the player has explored").
//
// ★ ONE GRID FOR THE WHOLE CONTINENT, IN WORLD COORDINATES (agreed with hub 11-14). The Wilds are the continent's
// land in the Ather's state, 1:1, so a walked cell here is a walked cell on the continent map's "Ather" tab
// (continent/map.tsx reads this same store). Shape matches voxel3d/discovery.ts `Seen` (16 m cells, one bit per
// cell, row-major, `rev` bumped on change) so ui/map-kit.ts drawCloud paints it directly.
//
// World coords: continent.json, origin at the centre, x east, z south, 11670 × 7830 m.
// Storage: localStorage 'ather.fog.v2' = base64 of the packed bits. Per browser (the trial ledger, not the account).

export const FOG_CELL = 16
export const REVEAL_R = 64
export const WORLD = { sizeX: 11670, sizeZ: 7830 }
const X0 = -WORLD.sizeX / 2, Z0 = -WORLD.sizeZ / 2

export interface Fog { cw: number; ch: number; bits: Uint8Array; rev: number }

export function newFog(): Fog {
  const cw = Math.ceil(WORLD.sizeX / FOG_CELL), ch = Math.ceil(WORLD.sizeZ / FOG_CELL)
  return { cw, ch, bits: new Uint8Array(Math.ceil((cw * ch) / 8)), rev: 0 }
}

export const cellOf = (x: number, z: number) => ({ cx: Math.floor((x - X0) / FOG_CELL), cy: Math.floor((z - Z0) / FOG_CELL) })
/** World position of a cell's top-left corner (for cropping the map to a tile). */
export const cellOrigin = { x: X0, z: Z0 }

export function isSeenCell(f: Fog, cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= f.cw || cy >= f.ch) return false
  const i = cy * f.cw + cx
  return (f.bits[i >> 3] & (1 << (i & 7))) !== 0
}
export const isRevealed = (f: Fog, x: number, z: number) => { const { cx, cy } = cellOf(x, z); return isSeenCell(f, cx, cy) }

/** Reveal a disc around world (x, z). True when anything new opened. */
export function reveal(f: Fog, x: number, z: number, r = REVEAL_R): boolean {
  const c = r / FOG_CELL, fx = (x - X0) / FOG_CELL, fz = (z - Z0) / FOG_CELL
  let changed = false
  for (let cy = Math.floor(fz - c); cy <= Math.ceil(fz + c); cy++) for (let cx = Math.floor(fx - c); cx <= Math.ceil(fx + c); cx++) {
    if (cx < 0 || cy < 0 || cx >= f.cw || cy >= f.ch) continue
    if (Math.hypot(cx + 0.5 - fx, cy + 0.5 - fz) > c) continue
    const i = cy * f.cw + cx
    if (!(f.bits[i >> 3] & (1 << (i & 7)))) { f.bits[i >> 3] |= 1 << (i & 7); changed = true }
  }
  if (changed) f.rev++
  return changed
}

/** Share of a world rectangle that has been walked (the fold map's "walked N%"). */
export function walkedShare(f: Fog, x0: number, z0: number, x1: number, z1: number): number {
  const a = cellOf(x0, z0), b = cellOf(x1 - 1e-6, z1 - 1e-6)
  let seen = 0, all = 0
  for (let cy = a.cy; cy <= b.cy; cy++) for (let cx = a.cx; cx <= b.cx; cx++) { all++; if (isSeenCell(f, cx, cy)) seen++ }
  return all ? seen / all : 0
}

export const FOG_KEY = 'ather.fog.v2'
export function loadFog(): Fog {
  const f = newFog()
  try {
    const raw = localStorage.getItem(FOG_KEY)
    if (raw) { const bin = atob(raw); if (bin.length === f.bits.length) for (let k = 0; k < bin.length; k++) f.bits[k] = bin.charCodeAt(k) }
  } catch { /* fresh fog */ }
  return f
}
export function saveFog(f: Fog): void {
  try {
    let s = ''
    for (let k = 0; k < f.bits.length; k += 8192) s += String.fromCharCode(...f.bits.subarray(k, k + 8192))
    localStorage.setItem(FOG_KEY, btoa(s))
  } catch { /* session only */ }
}
