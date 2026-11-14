// The Passage market, walked by numbers. Run: npx tsx src/app/shimmer/open/cavern.test.ts   (REGION=corridor too)

import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, boreAt, tunnelWall, TUNNEL_WALK, type RegionMeta } from './region'
import { buildCavern, caveRoomAt, CAVE_ROOF_MAX } from './cavern'
import { footWorld, tickFoot, stepOut } from './on-foot'
import { createCourser, tickCourser, bodySpeeds } from './courser'
import type { LocoState } from '../voxel3d/locomotion'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const NAME = process.env.REGION ?? 'continent'
const meta = JSON.parse(readFileSync(`public/open/${NAME}.json`, 'utf8')) as RegionMeta
const raw = meta.binGz ? gunzipSync(readFileSync(`public/open/${NAME}.bin.gz`)) : readFileSync(`public/open/${NAME}.bin`)
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))

const cave = buildCavern(R)
ok(!!cave, 'no cavern: no door kept 14 m of rock over the roof')
if (cave) {
  const fw = footWorld(R, cave)
  const t = cave.tunnel, sMid = (cave.doorS[0] + cave.doorS[1]) / 2, b = boreAt(t, sMid)
  const ux = b.uz * cave.side, uz = -b.ux * cave.side                    // into the hill
  // the whole cave sits inside the mountain, roof and all
  let thin = Infinity
  for (let k = 0; k < cave.mask.length; k++) if (cave.mask[k]) {
    const x = cave.x0 + ((k % cave.nx) + 0.5) * 0.75, z = cave.z0 + (Math.floor(k / cave.nx) + 0.5) * 0.75
    thin = Math.min(thin, R.heightAt(x, z) - cave.y - cave.roof[k])
  }
  ok(thin > 8, `the cave's roof comes within ${thin.toFixed(1)} m of daylight`)
  ok(cave.rooms.length >= 7 && cave.props.some(p => p.kind === 'cabinet') && cave.props.some(p => p.kind === 'wagon'), 'rooms or props missing')

  const walk = (s: LocoState, yaw: number, secs: number, onTick?: (s: LocoState) => void) => {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw)
    for (let tt = 0; tt < secs; tt += 1 / 60) {
      tickFoot(fw, R, s, { mvX: fx, mvZ: fz, fwdX: fx, fwdZ: fz, rightX: rx, rightZ: rz, jumpKey: false, crouchKey: false, dt: 1 / 60 })
      onTick?.(s)
    }
  }
  const legal = (s: LocoState) => {
    if (cave.inside(s.px, s.pz)) return true
    const h = R.tunnelAt(s.px, s.pz)
    return !!h && Math.abs(h.off) <= t.width / 2 + TUNNEL_WALK
  }

  // ★ from the bore's middle lane, walk straight at the door and keep going: in through the side passage
  {
    const s = stepOut({ x: b.x, y: b.y + 0.05, z: b.z }, { vx: 0, vz: 0 })
    let illegal = 0, deepest = 0
    // aim at the passage's far end, then the hall (the passage bends), steering each tick toward the next waypoint
    const way: [number, number][] = [[10, 1], [17, 1], [36, 0]].map(([u, v]) => [b.x + ux * u + b.ux * v, b.z + uz * u + b.uz * v])
    let wi = 0
    for (let tt = 0; tt < 20 && wi < way.length; tt += 1 / 60) {
      const [tx, tz] = way[wi]
      if (Math.hypot(tx - s.px, tz - s.pz) < 1.5) { wi++; continue }
      const yaw = Math.atan2(-(tx - s.px), -(tz - s.pz))
      walk(s, yaw, 1 / 60, q => { if (!legal(q)) illegal++; deepest = Math.max(deepest, (q.px - b.x) * ux + (q.pz - b.z) * uz) })
    }
    ok(wi === way.length, `walker never reached the hall (got to waypoint ${wi}, ${deepest.toFixed(1)} m in)`)
    ok(illegal === 0, `${illegal} ticks outside the bore and the cave`)
    ok(Math.abs(s.py - cave.y) < 0.3, `standing ${(s.py - cave.y).toFixed(2)} m off the market floor`)
    ok(caveRoomAt(cave, s.px, s.pz)?.id === 'hall' || caveRoomAt(cave, s.px, s.pz)?.id === 'gems', `in the hall, the sign reads ${caveRoomAt(cave, s.px, s.pz)?.id}`)

    // ★★ from the hall, walk 8 s in 24 directions: never through a wall, never off the floor
    const hx = s.px, hz = s.pz
    let escaped = 0, fell = 0
    for (let k = 0; k < 24; k++) {
      const q = stepOut({ x: hx, y: cave.y + 0.05, z: hz }, { vx: 0, vz: 0 })
      walk(q, (k / 24) * Math.PI * 2, 8, w => { if (!legal(w)) escaped++; if (Math.abs(w.py - cave.y) > 1.2) fell++ })
    }
    ok(escaped === 0, `${escaped} ticks through the cave's walls`)
    ok(fell === 0, `${fell} ticks off the market floor`)
  }

  // ★ a courser cannot follow: drive at the door at 15 m/s angled in, the bore's wall holds it
  {
    const s0 = sMid - 25, a = boreAt(t, s0)
    const yaw = Math.atan2(-(b.x + ux * 12 - a.x), -(b.z + uz * 12 - a.z))
    const c = createCourser(a.x, a.z, yaw, (x, z) => R.groundAt(x, z, a.y))
    let inCave = 0
    for (let tt = 0; tt < 5; tt += 1 / 120) {
      tickCourser(c, { throttle: bodySpeeds(c).fwd < 15 ? 1 : 0, steer: 0, handbrake: false, dt: 1 / 120 }, (x, z) => R.groundAt(x, z, c.y))
      tunnelWall(R, c)
      if (cave.inside(c.x, c.z)) inCave++
    }
    ok(inCave === 0, `the courser got ${inCave} ticks into the market`)
  }
  ok(CAVE_ROOF_MAX <= 14, 'roof cap')
}

console.log(`cavern[${NAME}]: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
