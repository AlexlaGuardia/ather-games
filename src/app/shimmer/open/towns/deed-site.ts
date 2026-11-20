// ── M49 slice 1: WHERE the shipyard's deed plot lies on the continent. Not part of deed-plots.ts (pure data) because it reads
// the Region and Rune Hold's plan. The shipyard (business/doors.ts: the free plain building farthest from Rune Hold's heart) is
// the deed's town anchor; the PLOT is the flattest clear ground a short way from it, its front turned to the town, built up to one
// level like the Station's terrace (rune-hold-core.ts › placeStation). No new named place: an unnamed deed beside the yard.
import type { Region } from '../region'
import { nearestRoad, nearPad } from '../region'
import { cachedPlan } from '../foot-solids'
import { doorsCached } from '../business/doors'
import { makeDeed, DEED_GRID, type Deed } from './deed-plots'

const cache = new WeakMap<Region, Deed | null>()
export function shipyardDeed(R: Region): Deed | null {
  if (cache.has(R)) return cache.get(R)!
  const d = findShipyardDeed(R); cache.set(R, d); return d
}

function findShipyardDeed(R: Region): Deed | null {
  const i = R.meta.places.findIndex(p => p.id === 'rune-hold'); if (i < 0) return null
  const yard = doorsCached(R, 'rune-hold').find(d => d.key === 'front:shipyard'); if (!yard) return null
  const plan = cachedPlan(R, i), heart = plan.temple ?? { x: R.meta.places[i].x, z: R.meta.places[i].z }
  const g = DEED_GRID.shipyard, half = Math.hypot(g.w, g.d) / 2
  const away = Math.atan2(yard.b.z - heart.z, yard.b.x - heart.x)
  let best: { x: number; z: number; yaw: number; level: number; base: number; score: number } | null = null
  for (let da = -2.4; da <= 2.4001; da += 0.3) for (let dist = 22; dist <= 70; dist += 6) {
    const a = away + da, x = yard.b.x + Math.cos(a) * dist, z = yard.b.z + Math.sin(a) * dist
    // the plot's front faces the heart of the town; yaw as placeBlueprint reads it (front = (-sin, -cos))
    const tx = heart.x - x, tz = heart.z - z, yaw = Math.atan2(-tx, -tz), s = Math.sin(yaw), c = Math.cos(yaw)
    let bad = 0, lo = Infinity, hi = -Infinity
    for (let v = -3; v <= g.d + 3; v += 2) for (let u = -3; u <= g.w + 3; u += 2) {
      const aa = u - g.w / 2, bb = v - g.d / 2      // right of centre, behind centre
      const px = x + c * aa + s * bb, pz = z - s * aa + c * bb
      const y = R.heightAt(px, pz)
      if (!Number.isFinite(y) || y < 1.5) { bad += 10; continue }
      const nr = nearestRoad(R, px, pz)
      if ((nr.road && nr.d < nr.road.width / 2 + 3) || nearPad(R, px, pz, 3)) bad += 10
      const tun = R.tunnelAt(px, pz); if (tun && tun.cover < 12) bad += 10
      lo = Math.min(lo, y); hi = Math.max(hi, y)
    }
    // the approach CORRIDOR: the front's natural ground, over the grid's whole width, out to past the bank's foot, must be walkable
    // (dry, and no step steeper than the 0.5 bank), so a keeper can come up to the door from the town on foot
    const run = (hi + 0.05 - (lo - 1)) / 0.5
    for (let a = -g.w / 2; a <= g.w / 2 + 0.001; a += 3) {
      let prev = NaN
      for (let f = g.d / 2 + 0.5; f <= g.d / 2 + run + 10; f += 1) {
        const px = x + c * a - s * f, pz = z - s * a - c * f, y = R.heightAt(px, pz)
        if (!Number.isFinite(y) || y < 1.5 || (Number.isFinite(prev) && Math.abs(y - prev) > 0.45)) { bad += 10; break }
        prev = y
      }
    }
    for (const b of plan.buildings) if (Math.hypot(b.x - x, b.z - z) < Math.hypot(b.w, b.d) / 2 + half + 4) bad += 10
    if (Math.hypot(heart.x - x, heart.z - z) < half + 12) bad += 10
    const score = bad + (hi - lo) * 3 + dist * 0.05
    if (!best || score < best.score) best = { x, z, yaw, level: hi + 0.05, base: lo - 1, score }
  }
  if (!best || best.score >= 100) return null
  const { x, z, yaw, level, base } = best
  return makeDeed('shipyard-rune-hold', 'rune-hold', 'shipyard', { x, z, yaw, level, base })
}
