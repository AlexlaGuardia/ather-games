// Where edge clouds stand: pure layout helpers for shared/cloud-edge.tsx (BETA M24). No three.js here, so tests import it.

export interface Puff { x: number; y: number; z: number; s: number; sy?: number }

// ── layouts (pure) ───────────────────────────────────────────────────────────────────────────────────────────
/** A deterministic 0..1 hash (the same pillows on every device and every load). */
export const hash = (a: number, b: number) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s) }

/** Pillows along a run of edge points: each point gets a big pillow plus two smaller ones beside and below, pushed `out`
 *  along the outward normal so they bank against the edge instead of sitting on the land. */
export function pillowsAlong(pts: readonly { x: number; z: number; nx: number; nz: number; y: number }[], size: number, out: number): Puff[] {
  const res: Puff[] = []
  pts.forEach((p, i) => {
    const h1 = hash(p.x, p.z), h2 = hash(p.z + 3.1, p.x - 7.7), s = size * (0.75 + 0.5 * h1)
    res.push({ x: p.x + p.nx * (out + s * 0.4), y: p.y - s * 0.5, z: p.z + p.nz * (out + s * 0.4), s })
    res.push({ x: p.x + p.nx * (out + s * 1.1) - p.nz * s * (h2 - 0.5), y: p.y - s * 0.7, z: p.z + p.nz * (out + s * 1.1) + p.nx * s * (h2 - 0.5), s: s * 0.8 })
    if (i % 2 === 0) res.push({ x: p.x + p.nx * (out + s * 0.2), y: p.y - s * 1.2, z: p.z + p.nz * (out + s * 0.2), s: s * 0.9, sy: 0.8 })
  })
  return res
}
