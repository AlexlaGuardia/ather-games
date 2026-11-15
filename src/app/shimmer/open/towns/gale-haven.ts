// GALE HAVEN'S PORT on the continent (Jin play lane, 2026-11-15). ★ PURE: where things stand; Towns.tsx draws them.
//
// Canon (world/gale-haven.md; 1672 ruled by Magii + Alex 11-15, world/geography.md › THE TOWNS IN 1672): the THREE
// TIERS hold. Low Docks at the waterline (merchant vessels, the Wet Market: "chaos, fish, produce, shouting"), the
// Cargo Quay (cargo cranes, warehouses), and highest the Sky Port, which in 1672 moors LIFT-RUNE SKYSHIPS (no sails,
// no balloon; transportation.md) at a FOREST OF MOORING TOWERS. It is the planet's air port; space traffic stays at
// Rune Hold's Station. Gale Haven's port is a tower-forest of trade, where Rune Hold's is a field (rune-hold.md).
//
// The continent's Gale Haven sits in a bowl at 21 m with the sea ~150 m east and high ground (60 m+) round it, so the
// tiers fall out of the land: the docks go where the ground meets the sea, the towers on the highest ground.
// ⚠ The skyship is play3d's blockout in the lineage (StationScene's ShipHull); its real look is a design brief.

import { nearestRoad, nearPad, type Region } from '../region'
import { hash } from './plan'

export const SEA_Y = -0.15
export interface Pier { x: number; z: number; yaw: number; len: number; y: number }
export interface Tower { x: number; z: number; y: number; h: number; ship: boolean; shipYaw: number }
export interface Crane { x: number; z: number; y: number; yaw: number }
export interface Stall { x: number; z: number; y: number; yaw: number; c: number }
export interface Port { piers: Pier[]; towers: Tower[]; cranes: Crane[]; stalls: Stall[]; keepOut: { x: number; z: number; r: number }[] }

const offRoad = (R: Region, x: number, z: number, m: number) => { const nr = nearestRoad(R, x, z); return !(nr.road && nr.d < nr.road.width / 2 + m) && !nearPad(R, x, z, m) }

export function galeHavenPort(R: Region, cx: number, cz: number, r: number): Port {
  const port: Port = { piers: [], towers: [], cranes: [], stalls: [], keepOut: [] }

  // ── LOW DOCKS: walk rays out from the square; where land first meets the sea within reach, a pier runs out
  const shore: { x: number; z: number; y: number; a: number; d: number }[] = []
  for (let deg = 0; deg < 360; deg += 3) {
    const a = deg * Math.PI / 180, ux = Math.cos(a), uz = Math.sin(a)
    let prev: { x: number; z: number; y: number } | null = null
    for (let d = 30; d < r * 1.15; d += 3) {
      const x = cx + ux * d, z = cz + uz * d, y = R.heightAt(x, z)
      if (y < 1.5) { if (prev && prev.y < 8) shore.push({ ...prev, a, d }); break }
      prev = { x, z, y }
    }
  }
  shore.sort((p, q) => p.d - q.d)
  for (const s of shore) {
    if (port.piers.length >= 6) break
    if (port.piers.some(p => Math.hypot(p.x - s.x, p.z - s.z) < 28)) continue
    if (!offRoad(R, s.x, s.z, 3)) continue
    // a pier runs straight out to sea and must END in water deep enough to moor
    const ex = s.x + Math.cos(s.a) * 26, ez = s.z + Math.sin(s.a) * 26
    if (R.heightAt(ex, ez) > -0.5) continue
    port.piers.push({ x: s.x, z: s.z, yaw: s.a, len: 26, y: 1.6 })
    // a cargo crane on the quay at the pier's root, swung out over the water
    const kx = s.x - Math.cos(s.a) * 5 + Math.sin(s.a) * 5, kz = s.z - Math.sin(s.a) * 5 - Math.cos(s.a) * 5
    if (R.heightAt(kx, kz) > 1.5 && offRoad(R, kx, kz, 2)) { port.cranes.push({ x: kx, z: kz, y: R.heightAt(kx, kz), yaw: s.a }); port.keepOut.push({ x: kx, z: kz, r: 4 }) }
  }
  // ── the WET MARKET: stalls on the flattest open ground just above the docks
  if (port.piers.length) {
    const p0 = port.piers[0]
    for (let k = 0; k < 40 && port.stalls.length < 10; k++) {
      const a = p0.yaw + Math.PI + (hash(k, 3) - 0.5) * 2.2, d = 10 + hash(k, 4) * 26
      const x = p0.x + Math.cos(a) * d, z = p0.z + Math.sin(a) * d, y = R.heightAt(x, z)
      if (y < 1.5 || Math.abs(R.heightAt(x + 2, z) - R.heightAt(x - 2, z)) > 1.2) continue
      if (!offRoad(R, x, z, 2) || port.stalls.some(s => Math.hypot(s.x - x, s.z - z) < 5.5)) continue
      port.stalls.push({ x, z, y, yaw: a, c: Math.floor(hash(k, 5) * 4) })
      port.keepOut.push({ x, z, r: 3.5 })
    }
  }

  // ── SKY PORT: a forest of mooring towers on the highest ground in reach (greedy: highest first, spaced apart)
  const cand: { x: number; z: number; y: number }[] = []
  for (let dz = -r * 1.2; dz <= r * 1.2; dz += 12) for (let dx = -r * 1.2; dx <= r * 1.2; dx += 12) {
    const x = cx + dx, z = cz + dz, d = Math.hypot(dx, dz)
    if (d > r * 1.2 || d < 60) continue
    const y = R.heightAt(x, z)
    if (y < 1.5 || Math.abs(R.heightAt(x + 4, z) - R.heightAt(x - 4, z)) + Math.abs(R.heightAt(x, z + 4) - R.heightAt(x, z - 4)) > 6) continue
    if (!offRoad(R, x, z, 6) || R.tunnelAt(x, z)) continue
    cand.push({ x, z, y })
  }
  cand.sort((p, q) => q.y - p.y)
  const top = cand.length ? cand[Math.min(cand.length - 1, Math.floor(cand.length * 0.35))].y : 0
  for (const c of cand) {
    if (port.towers.length >= 12 || c.y < top) break
    if (port.towers.some(t => Math.hypot(t.x - c.x, t.z - c.z) < 26)) continue
    const k = port.towers.length
    port.towers.push({ x: c.x, z: c.z, y: c.y, h: 30 + hash(k, 7) * 16, ship: hash(k, 8) > 0.45, shipYaw: hash(k, 9) * Math.PI * 2 })
    port.keepOut.push({ x: c.x, z: c.z, r: 7 })
  }
  return port
}
