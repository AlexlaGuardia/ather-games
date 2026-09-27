'use client'

/**
 * The Travelers Station's look — the spaceport over its generated map (`station-field.ts`).
 *
 * ★ A BLOCKOUT WITH A MOOD, not final art (the art-medium law: generated first, Alex judges). What it has to
 * carry is canon's ruling of 2026-09-26: *"several berths, a field, a terminal"*, and *"the cap is visible:
 * each saved world the player has seated holds a berth, and a ship stands in it."* So: the town's coursed stone
 * for the terminal, a pale laid apron, numbered pads ringed in light, a departures board naming what is seated,
 * and a ship at every seated berth.
 *
 * ⚠ THE SHIP IS A BLOCKOUT IN THE SKYSHIP'S LINEAGE (`world/transportation.md`: *"a manalic vessel... lift-runes
 * worked into the hull, fed from mana cells"*; by 1672 the lineage runs upward into space). Its real look is a
 * design-brief question for Magii + Alex, not a thing this file decides; it is a hull, a deck house, fins and
 * glowing rune strips so the berth reads as occupied.
 *
 * `ZoneGeometry` is told `ownSolids` for this zone, so its brown blocks are not drawn and these are. Collision
 * is untouched: the walker still reads the grid.
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { STATION, T, type Ship } from './station-field'
import { hash } from './rune-hold-look'
import { Instances, type Inst } from './instances'
import { Folk } from './Townsfolk'
import { keepers } from './townsfolk'
import { runeHold as RH, spaceport as ST, passage as P } from './scene-palette'

const pick = <V,>(arr: readonly V[], x: number, z: number, k: number) => arr[Math.floor(hash(x, z, k) * arr.length) % arr.length]
const WALL_H = 7

/** The terminal's stone, its roof and lintels, and the ground everywhere. */
function useStation() {
  return useMemo(() => {
    const g = STATION.grid, t = STATION.terminal
    const inHall = (x: number, z: number) => x > t.x0 && x < t.x1 && z > t.z0 && z < t.z1
    const inHull = (x: number, z: number) => STATION.ships.some(s => x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1)
    const ground: Inst[] = [], stone: Inst[] = [], timber: Inst[] = []
    for (let z = 0; z < g.length; z++) for (let x = 0; x < g[z].length; x++) {
      const v = g[z][x]
      if (v !== T.WALL) {
        ground.push(inHall(x, z)
          ? { x, y: 0.03, z, sx: 1, sy: 1, sz: 1, c: pick(ST.hallFloor, x, z, 1) }
          : { x, y: 0.03, z, sx: 1, sy: 1, sz: 1, c: pick(ST.apron, x, z, 2) })
        continue
      }
      if (inHull(x, z)) continue
      // only a wall that faces open ground is ever seen; the solid fill round the terminal is the hillside's back
      let open = false
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = g[z + dz]?.[x + dx]; if (n !== undefined && n !== T.WALL) open = true }
      if (!open) continue
      const rim = x === 0 || z === 0 || x === g[0].length - 1 || z === g.length - 1
      const h = rim ? 1.4 : WALL_H          // the field's rim is a low parapet; the terminal stands tall
      const course = 0.55
      for (let k = 0; k < Math.round(h / course); k++) {
        const inset = (hash(x, z, 70 + k) - 0.5) * 0.06
        stone.push({ x: x + inset, y: course * (k + 0.5), z: z + inset, sx: 1.02, sy: course * 0.97, sz: 1.02, yaw: (hash(x, z, 80 + k) - 0.5) * 0.05, c: pick(RH.stone, x, z, 90 + k) })
      }
      timber.push({ x, y: h + 0.12, z, sx: 1.08, sy: 0.26, sz: 1.08, c: RH.timber })
    }
    // the east side of the terminal stands open onto the field: pillars carry the roof's edge
    const pillars: Inst[] = []
    for (let z = t.open.z0; z <= t.open.z1; z += 3) pillars.push({ x: t.x1, y: WALL_H / 2, z, sx: 0.9, sy: WALL_H, sz: 0.9, c: pick(RH.stone, t.x1, z, 3) })
    pillars.push({ x: t.x1, y: WALL_H + 0.3, z: (t.open.z0 + t.open.z1) / 2, sx: 1.1, sy: 0.6, sz: t.open.z1 - t.open.z0 + 1, c: ST.beam })
    // lintels over the terminal's three doors, so a door in a 7-high wall is an opening and not a gap
    const lintels: Inst[] = Object.values(STATION.doors).map(d => {
      const alongX = d.z === t.z0 || d.z + d.h - 1 === t.z1
      return alongX
        ? { x: d.x + (d.w - 1) / 2, y: 3.4 + (WALL_H - 3.4) / 2, z: d.z === t.z0 ? t.z0 : t.z1, sx: d.w + 0.1, sy: WALL_H - 3.4, sz: 1.04, c: pick(RH.stone, d.x, d.z, 4) }
        : { x: t.x0, y: 3.4 + (WALL_H - 3.4) / 2, z: d.z + (d.h - 1) / 2, sx: 1.04, sy: WALL_H - 3.4, sz: d.h + 0.1, c: pick(RH.stone, d.x, d.z, 4) }
    })
    const lamps: Inst[] = [], posts: Inst[] = []
    for (const l of STATION.lanterns) {
      posts.push({ x: l.x, y: 1.4, z: l.z, sx: 0.1, sy: 2.8, sz: 0.1, c: P.iron })
      lamps.push({ x: l.x, y: 2.9, z: l.z, sx: 0.34, sy: 0.44, sz: 0.34, c: P.glass })
    }
    return { ground, stone, timber, pillars, lintels, lamps, posts }
  }, [])
}

/** A pad: a dark disc, a gold ring painted round it, lights studding the ring, the berth's number. */
function Pad({ n, x, z, r }: { n: number; x: number; z: number; r: number }) {
  const studs = useMemo(() => Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2
    return { x: x + Math.cos(a) * (r - 0.2), y: 0.08, z: z + Math.sin(a) * (r - 0.2), sx: 0.22, sy: 0.08, sz: 0.22, c: ST.padLight }
  }), [x, z, r])
  const num = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 128
    const ctx = c.getContext('2d')!
    ctx.fillStyle = ST.padNumber; ctx.font = 'bold 96px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(String(n), 64, 70)
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [n])
  return (
    <group>
      <mesh position={[x, 0.045, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[r, 48]} />
        <meshStandardMaterial color={ST.pad} roughness={0.9} />
      </mesh>
      <mesh position={[x, 0.05, z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[r - 0.55, r - 0.3, 64]} />
        <meshStandardMaterial color={ST.padRing} roughness={0.7} />
      </mesh>
      <Instances items={studs} emissive={0.9} glow={ST.padLight} cast={false} />
      {/* the number sits on the pad's terminal side, readable walking up from the hall */}
      <mesh position={[x - r + 1.6, 0.055, z]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]}>
        <planeGeometry args={[2, 2]} />
        <meshStandardMaterial map={num} transparent roughness={0.8} />
      </mesh>
    </group>
  )
}

/**
 * A blockout ship in the skyship's lineage: keel, hull, deck house, fins, lift-rune strips. Built round (cx, cz),
 * its long axis along z. `struts` = standing at a berth; without them it is in flight (the town's view of the
 * port shows one rising). Exported so Rune Hold's skyline draws the same ship the berths hold.
 */
export function ShipHull({ cx, cz, w, len, lift = 1.2, struts = true }: { cx: number; cz: number; w: number; len: number; lift?: number; struts?: boolean }) {
  const parts = useMemo(() => {
    const out: Inst[] = []
    if (struts) for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) out.push({ x: cx + dx * (w / 2 - 1), y: lift / 2, z: cz + dz * (len / 2 - 2), sx: 0.35, sy: lift, sz: 0.35, c: ST.hullDark })
    // the keel and the hull, stepped so it reads as a vessel and not a crate
    out.push({ x: cx, y: lift + 0.5, z: cz, sx: w - 3, sy: 1, sz: len - 1, c: ST.hullDark })
    out.push({ x: cx, y: lift + 1.6, z: cz, sx: w, sy: 1.4, sz: len - 2, c: ST.hull })
    out.push({ x: cx, y: lift + 2.6, z: cz, sx: w - 0.6, sy: 0.6, sz: len - 1, c: ST.plate })
    // bow and stern tapers
    for (const e of [-1, 1]) {
      out.push({ x: cx, y: lift + 1.8, z: cz + e * (len / 2 - 0.2), sx: w - 2.4, sy: 1.6, sz: 1.6, c: ST.hull })
      out.push({ x: cx, y: lift + 2, z: cz + e * (len / 2 + 0.6), sx: w - 4.2, sy: 1.1, sz: 1.2, c: ST.plate })
    }
    // the deck house, forward of amidships, and its trim
    out.push({ x: cx, y: lift + 3.8, z: cz - len * 0.12, sx: w - 2.6, sy: 1.8, sz: len * 0.38, c: ST.plate })
    out.push({ x: cx, y: lift + 4.8, z: cz - len * 0.12, sx: w - 2.2, sy: 0.22, sz: len * 0.42, c: ST.trim })
    // fins astern, one each side and one up
    for (const e of [-1, 1]) out.push({ x: cx + e * (w / 2 + 0.9), y: lift + 2, z: cz + len / 2 - 2, sx: 1.8, sy: 0.25, sz: 3, c: ST.hullDark })
    out.push({ x: cx, y: lift + 4.4, z: cz + len / 2 - 1.8, sx: 0.3, sy: 2.6, sz: 2.6, c: ST.hullDark })
    return out
  }, [cx, cz, w, len, lift, struts])
  const runes = useMemo(() => {
    const out: Inst[] = []
    for (const e of [-1, 1]) out.push({ x: cx + e * (w / 2 + 0.02), y: lift + 1.6, z: cz, sx: 0.06, sy: 0.25, sz: len - 4, c: ST.rune })
    // in flight the keel's runes burn too: the lift is working
    if (!struts) out.push({ x: cx, y: lift - 0.02, z: cz, sx: w - 3.4, sy: 0.06, sz: len - 3, c: ST.rune })
    out.push({ x: cx, y: lift + 3.9, z: cz - len * 0.12 - len * 0.19 - 0.02, sx: w - 3.2, sy: 0.6, sz: 0.06, c: ST.canopy })
    return out
  }, [cx, cz, w, len, lift, struts])
  return (
    <group>
      <Instances items={parts} />
      <Instances items={runes} emissive={0.9} glow={ST.rune} cast={false} />
      <pointLight position={[cx, lift + 1.2, cz]} color={ST.rune} intensity={6} distance={10} decay={1.6} />
    </group>
  )
}

/** A seated berth's ship: the hull, and the gangway down to its door. */
function ShipBlock({ s }: { s: Ship }) {
  const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2
  const lift = 1.2
  // the gangway runs at a slope: one mesh, rotated
  const foot = s.door.x + s.door.w - 1.5, top = s.x0 - 0.5, rise = lift + 0.9
  const gw = top - foot, gz = s.door.z + (s.door.h - 1) / 2
  return (
    <group>
      <ShipHull cx={cx} cz={cz} w={s.x1 - s.x0 + 1} len={s.z1 - s.z0 + 1} lift={lift} />
      <mesh position={[(foot + top) / 2, rise / 2, gz]} rotation={[0, 0, Math.atan2(rise, gw)]} castShadow receiveShadow>
        <boxGeometry args={[Math.hypot(gw, rise), 0.14, s.door.h]} />
        <meshStandardMaterial color={ST.trim} roughness={0.6} />
      </mesh>
    </group>
  )
}

/** The departures board: the manifest, in berth order. What is seated is lit; an open berth says so. */
function Board() {
  const { x, z } = STATION.board
  const tex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 384
    const ctx = c.getContext('2d')!
    ctx.fillStyle = ST.board.bg; ctx.fillRect(0, 0, 512, 384)
    ctx.fillStyle = ST.board.ink; ctx.font = 'bold 34px ui-monospace, monospace'; ctx.fillText('DEPARTURES', 28, 52)
    ctx.font = '26px ui-monospace, monospace'
    STATION.berths.forEach((b, i) => {
      const y = 104 + i * 44
      ctx.fillStyle = b.seated ? ST.board.lit : ST.board.dim
      ctx.fillText(`BERTH ${b.n}`, 28, y)
      ctx.fillText(b.seated ? b.seated.replace(/^the-/, 'the ').toUpperCase() : 'open', 210, y)
    })
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  return (
    <group position={[x + 0.02, 3.2, z]} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, 0, -0.06]}><boxGeometry args={[4.6, 3.6, 0.1]} /><meshStandardMaterial color={ST.board.frame} /></mesh>
      <mesh><planeGeometry args={[4.2, 3.15]} /><meshStandardMaterial map={tex} emissive={ST.board.lit} emissiveIntensity={0.08} emissiveMap={tex} /></mesh>
    </group>
  )
}

export function StationScene() {
  const s = useStation()
  const t = STATION.terminal
  return (
    <>
      <Instances items={s.ground} flat cast={false} />
      <Instances items={s.stone} />
      <Instances items={s.timber} />
      <Instances items={s.pillars} />
      <Instances items={s.lintels} />
      <Instances items={s.posts} />
      <Instances items={s.lamps} emissive={1.1} glow={P.glass} cast={false} />
      {/* the terminal's roof: one slab, the hall under it lit by its lanterns */}
      <mesh position={[(t.x0 + t.x1) / 2, WALL_H + 0.45, (t.z0 + t.z1) / 2]} castShadow receiveShadow>
        <boxGeometry args={[t.x1 - t.x0 + 1.6, 0.5, t.z1 - t.z0 + 1.6]} />
        <meshStandardMaterial color={ST.roof} roughness={0.9} />
      </mesh>
      {[0.3, 0.7].map((f, i) => (
        <pointLight key={i} position={[t.x0 + (t.x1 - t.x0) * f, WALL_H - 1.5, (t.z0 + t.z1) / 2]} color={P.lamp} intensity={16} distance={16} decay={1.5} />
      ))}
      <Board />
      {/* the Station clerk, by the departures board (a role, never named: canon ★ THE TOWNSFOLK) */}
      <Folk standing={keepers().filter(f => f.zone === 'travelers-station')} walking={[]} />
      {STATION.berths.map(b => <Pad key={b.n} n={b.n} x={b.x} z={b.z} r={b.r} />)}
      {STATION.ships.map(sh => <ShipBlock key={sh.berth} s={sh} />)}
    </>
  )
}
