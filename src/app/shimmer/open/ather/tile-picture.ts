// ONE TILE'S MAP PICTURE — the plate (plate.ts), its node borders, the fold-mist over what you have not walked, and its
// waymark pins. The minimap and the fold map both compose tiles with THIS, so the two maps can never disagree.
// Browser-only (canvas). `tileOff` = the anchor tile's centre in continent coords (the fog's grid is continent-wide);
// (ox, oz) = this tile's centre in Wilds world coords.

import { atherPlate } from './plate'
import { ATHER_CLOUD, drawCloud } from '../../ui/map-kit'
import { FOG_CELL, cellOrigin, type Fog } from './explored'
import { GREG_WAYMARK, type Waymark } from './waymarks'
import type { Wilds } from './wilds'

export type Region = { id: string; poly: { x: number; z: number }[]; infected: boolean }

// ── SETTLEMENTS on the maps (BETA M19): the scene hands the network's settlements over once it has them (network-scene.tsx);
// both maps compose through here, so the minimap and the fold map show them alike. World coords; a tile draws its own.
let mapSettlements: readonly { x: number; z: number }[] = [], settleRev = 0
export function setMapSettlements(s: readonly { x: number; z: number }[]) { if (s.length !== mapSettlements.length) { mapSettlements = s; settleRev++ } }
export const mapSettlementsRev = () => settleRev
export function composeTilePicture(c: HTMLCanvasElement, W: Wilds, o: {
  px: number; regions: Region[]; fog: Fog | null; tileOff: { x: number; z: number }; ox: number; oz: number; waymarks: Waymark[]
}) {
  const N = o.px
  c.width = N; c.height = N
  const ctx = c.getContext('2d')!, sx = W.meta.sizeX, sz = W.meta.sizeZ, k = N / sx
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(atherPlate(W), 0, 0, N, N)
  const P = (x: number, z: number): [number, number] => [(x + sx / 2) * k, (z + sz / 2) * (N / sz)]
  if (o.regions.length > 1) for (const r of o.regions) {
    ctx.beginPath(); r.poly.forEach((p, i) => { const [x, y] = P(p.x, p.z); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y) }); ctx.closePath()
    ctx.fillStyle = r.infected ? 'rgba(70,72,78,0.32)' : 'rgba(159,210,122,0.12)'; ctx.fill()
    ctx.setLineDash(r.infected ? [10 * k, 7 * k] : []); ctx.lineWidth = Math.max(1.2, 3 * k)
    ctx.strokeStyle = r.infected ? 'rgba(235,238,242,0.9)' : 'rgba(159,210,122,0.85)'; ctx.stroke()
  }
  ctx.setLineDash([])
  if (o.fog) {
    const x0 = o.tileOff.x + o.ox - sx / 2, z0 = o.tileOff.z + o.oz - sz / 2, cellPx = N / (sx / FOG_CELL)
    drawCloud(ctx, o.fog, cellPx, -((x0 - cellOrigin.x) / FOG_CELL) * cellPx, -((z0 - cellOrigin.z) / FOG_CELL) * cellPx, ATHER_CLOUD)
  }
  const pin = (x: number, z: number, col: string, r: number) => {
    const [px, py] = P(x, z); ctx.fillStyle = col; ctx.strokeStyle = '#1a1410'; ctx.lineWidth = Math.max(1.2, 2.5 * k)
    ctx.beginPath(); ctx.arc(px, py, Math.max(3, r * k), 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  }
  if (W.meta.name === GREG_WAYMARK.tile) pin(GREG_WAYMARK.x, GREG_WAYMARK.z, '#e7c766', 9)
  for (const w of o.waymarks) if (w.tile === W.meta.name) pin(w.x, w.z, '#6fd3c4', 8)
  // a settlement: the warm burrow-tan the compass gives it (page.tsx marks), larger than a pin, under the walked fog's reveal
  for (const s of mapSettlements) { const lx = s.x - o.ox, lz = s.z - o.oz; if (Math.abs(lx) <= sx / 2 && Math.abs(lz) <= sz / 2) pin(lx, lz, '#d9c39a', 16) }
}
