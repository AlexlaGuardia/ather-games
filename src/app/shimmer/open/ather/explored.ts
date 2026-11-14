// WHAT THE KEEPER HAS WALKED — the fog on the gate's fold map (Alex 11-14: "a map showing all the player has
// explored"). A coarse bitmap per Wilds tile; walking reveals a disc around you. ★ PURE apart from the ledger.

export const FOG_CELL = 20          // metres per fog cell
export const REVEAL_R = 60          // metres revealed around the keeper

export interface Fog { tile: string; n: number; size: number; bits: Uint8Array }

export function newFog(tile: string, size: number): Fog {
  const n = Math.ceil(size / FOG_CELL)
  return { tile, n, size, bits: new Uint8Array(n * n) }
}

/** Reveal around (x, z) in tile coords (centre origin). Returns true when anything new was uncovered. */
export function reveal(f: Fog, x: number, z: number, r = REVEAL_R): boolean {
  const h = f.size / 2, c = r / FOG_CELL
  const ci = (x + h) / FOG_CELL, cj = (z + h) / FOG_CELL
  let changed = false
  for (let j = Math.floor(cj - c); j <= Math.ceil(cj + c); j++) for (let i = Math.floor(ci - c); i <= Math.ceil(ci + c); i++) {
    if (i < 0 || j < 0 || i >= f.n || j >= f.n) continue
    if (Math.hypot(i + 0.5 - ci, j + 0.5 - cj) > c) continue
    if (!f.bits[j * f.n + i]) { f.bits[j * f.n + i] = 1; changed = true }
  }
  return changed
}

export const isRevealed = (f: Fog, x: number, z: number) => {
  const h = f.size / 2, i = Math.floor((x + h) / FOG_CELL), j = Math.floor((z + h) / FOG_CELL)
  return i >= 0 && j >= 0 && i < f.n && j < f.n && f.bits[j * f.n + i] === 1
}
export const revealedShare = (f: Fog) => f.bits.reduce((a, b) => a + b, 0) / f.bits.length

const key = (tile: string) => `ather.fog.v1.${tile}`
export function loadFog(tile: string, size: number): Fog {
  const f = newFog(tile, size)
  try {
    const raw = localStorage.getItem(key(tile))
    if (raw) { const bin = atob(raw); if (bin.length === f.bits.length) for (let k = 0; k < bin.length; k++) f.bits[k] = bin.charCodeAt(k) ? 1 : 0 }
  } catch { /* fresh fog */ }
  return f
}
export function saveFog(f: Fog): void {
  try { let s = ''; for (const b of f.bits) s += String.fromCharCode(b); localStorage.setItem(key(f.tile), btoa(s)) } catch { /* session only */ }
}
