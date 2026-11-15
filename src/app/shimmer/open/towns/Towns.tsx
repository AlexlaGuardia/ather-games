'use client'
// Draws the continent's towns from `plan.ts` (Jin play lane, 2026-11-15). Streamed: a town is planned the first time
// you come within sight of it (a city plans in a few hundred ms, so planning all 31 at load would stall the start),
// then cached. Everything is instanced: one mesh each for plinths, walls, roofs and chimneys across every town in view.
//
// THE KIT (v1, massing): a stone PLINTH from the lowest ground under the footprint up to the highest, the WALLS on
// top (FLOOR_H per floor), a low terracotta GABLE (Roman pitch, ridge along the street), a chimney on most. Lanes are
// laid paving draped on the ground. Windows, doors, trim that glows at dusk and the landmarks come next.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Region } from '../region'
import { planTown, townRadius, FLOOR_H, type TownPlan, type Building } from './plan'
import { dayProgress, daylight } from '../../engine/day-cycle'
import { FRONTS } from '../../play3d/rune-hold-look'
import { StationScene } from '../../play3d/StationScene'
import { STATION_COLS, STATION_ROWS, STATION } from '../../play3d/station-field'
import type { StationSite } from './rune-hold-core'

// ── looks per town, from canon + the concept shots Alex judged 11-15 (tools/art/gen_towns.py). Roman bones
// (world/athernyx.md): pale stone, terracotta. Unlisted towns take the country default. ──
interface Style { walls: string[]; roofs: string[]; plinth: string }
const COUNTRY: Style = { walls: ['#e3d6bb', '#d9c7a4', '#eadfc8', '#cfbb98'], roofs: ['#a4553a', '#b8653f', '#8f4a34'], plinth: '#9b8f7c' }
const STYLE: Record<string, Style> = {
  // stone stacked up a hillside, smithy town: warmer sandstone, darker fired roofs (pick: rune-hold-2)
  'rune-hold': { walls: ['#cdb38a', '#c2a57a', '#d6bf98', '#b89a70'], roofs: ['#7e4630', '#8c4f36', '#6f3f2c'], plinth: '#857a6a' },
  // the restored capital, marble and gold (pick: citadel-3; 1672 look still a proposal, CANON_GAPS 2801620)
  citadel: { walls: ['#f1ebdd', '#e9e1cf', '#f6f1e6', '#e2d8c2'], roofs: ['#b5603c', '#c4703f', '#a85a3a'], plinth: '#c9bfa9' },
  // the white port city (pick: gale-haven-4)
  'gale-haven': { walls: ['#f3f0e8', '#ebe6da', '#f7f5ef', '#e4ddcc'], roofs: ['#b0583a', '#c26b45', '#9a5038'], plinth: '#b9b2a2' },
  // where the green gives out into tan broken country (pick: ashfeld-3)
  ashfeld: { walls: ['#d8bf94', '#cbb085', '#e0caa3', '#c2a378'], roofs: ['#9c4f34', '#ad5a3a', '#874431'], plinth: '#8d7f69' },
}
const styleOf = (id: string) => STYLE[id] ?? COUNTRY

const PLAN_REACH = 1500          // plan a town once you are this close to its edge
const SHOW_REACH = 1700          // draw it while within this of its edge

function roofGeometry() {
  // a unit gable: ridge along x at y=1, eaves at y=0 on z=±0.5, x from -0.5 to 0.5 (gable ends closed)
  const g = new THREE.BufferGeometry()
  const v = [
    -0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 1, 0, -0.5, 1, 0,      // front slope
    0.5, 0, -0.5, -0.5, 0, -0.5, -0.5, 1, 0, 0.5, 1, 0,    // back slope
    -0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 1, 0,               // west gable
    0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 1, 0,                  // east gable
  ]
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 11, 12, 13])
  g.computeVertexNormals()
  return g
}

// ── the FACADE, drawn by the wall shader rather than modelled (one instanced box per building stays one box):
// windows per floor, a door on the street face, a carved trim band at every floor line. Canon (world/athernyx.md):
// the trim is mana channels, plain by day, and "the sun sets and the trim breathes soft light"; windows are lamplit.
// Sizes are in metres off the instance's own scale, so a 15 m row house gets more windows than a 7 m cottage.
function facadeMaterial() {
  const m = new THREE.MeshLambertMaterial({ flatShading: true })
  const uniforms = { uNight: { value: 0 } }
  m.onBeforeCompile = sh => {
    sh.uniforms.uNight = uniforms.uNight
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vF; varying vec3 vNL; varying vec3 vS; varying float vId;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vS = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vF = position * vS; vNL = normal; vId = float(gl_InstanceID);`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uNight; varying vec3 vF; varying vec3 vNL; varying vec3 vS; varying float vId;
        float h3(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
        vec3 facadeGlow = vec3(0.0);`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (abs(vNL.y) < 0.5) {
          bool front = vNL.z > 0.5;
          float faceW = abs(vNL.z) > 0.5 ? vS.x : vS.z;
          float u = (abs(vNL.z) > 0.5 ? vF.x : vF.z) + faceW * 0.5;
          float v = vF.y + vS.y * 0.5;
          float fl = floor(v / ${FLOOR_H.toFixed(2)}), fv = v - fl * ${FLOOR_H.toFixed(2)};
          float cols = max(1.0, floor(faceW / 2.7)), cw = faceW / cols;
          float cell = floor(u / cw), lu = (fract(u / cw) - 0.5) * cw;
          bool doorCell = front && fl < 0.5 && abs(cell - floor(cols * 0.5)) < 0.5;
          if (doorCell && abs(lu) < 0.65 && fv < 2.3) {
            diffuseColor.rgb = vec3(0.30, 0.19, 0.12);
          } else if (!doorCell && abs(lu) < 0.45 && fv > 0.95 && fv < 2.35) {
            float lit = step(h3(vec3(floor(vId + 0.5), fl, cell + (front ? 0.0 : 31.0))), 0.62);   // floor: the varying wobbles a hair per fragment, and sin() of a hash turns that into static
            diffuseColor.rgb = mix(vec3(0.20, 0.17, 0.15), vec3(0.95, 0.72, 0.38), lit * uNight);
            facadeGlow = vec3(1.0, 0.68, 0.32) * lit * uNight * 0.85;
          } else if (fv < 0.22 && v > 0.5) {
            diffuseColor.rgb *= 1.12;
            facadeGlow = vec3(1.0, 0.82, 0.45) * uNight * 0.28;
          }
        }`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += facadeGlow;')
  }
  return { m, uniforms }
}

function laneGeometry(R: Region, plans: TownPlan[]) {
  const pos: number[] = [], idx: number[] = []
  for (const pl of plans) for (const l of [...pl.lanes, ...(pl.walks ?? [])]) {
    const p = l.pts, base = pos.length / 3
    for (let k = 0; k < p.length; k++) {
      const a = p[Math.max(0, k - 1)], b = p[Math.min(p.length - 1, k + 1)]
      let tx = b[0] - a[0], tz = b[1] - a[1]; const L = Math.hypot(tx, tz) || 1; tx /= L; tz /= L
      for (const sd of [-1, 1]) {
        const x = p[k][0] - tz * sd * l.width / 2, z = p[k][1] + tx * sd * l.width / 2
        pos.push(x, R.heightAt(x, z) + 0.12, z)
      }
      if (k) { const i = base + (k - 1) * 2; idx.push(i, i + 2, i + 1, i + 1, i + 2, i + 3) }
    }
  }
  // authored paving (Rune Hold's grid): one 1 m cell per path tile, at the grid's bearing, draped on the ground
  for (const pl of plans) if (pl.paving) {
    const c = Math.cos(pl.paving.yaw), s = Math.sin(pl.paving.yaw), h = 0.52
    for (const [x, z] of pl.paving.pts) {
      const base = pos.length / 3
      for (const [u, v] of [[-h, -h], [h, -h], [h, h], [-h, h]]) {
        const px = x + u * c - v * s, pz = z + u * s + v * c
        pos.push(px, R.heightAt(px, pz) + 0.12, pz)
      }
      idx.push(base, base + 2, base + 1, base, base + 3, base + 2)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx); g.computeVertexNormals()
  return g
}

// ── storefront SIGNS (Rune Hold's fronts, named by canon in play3d's FRONTS): a hanging board over the door with the
// name painted on, and a lantern beside it. Canon's feel line asks for "shops you remember by name". ──
function signTexture(name: string) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#3b2617'; g.fillRect(0, 0, 512, 128)
  g.strokeStyle = '#c99a4b'; g.lineWidth = 6; g.strokeRect(8, 8, 496, 112)
  g.fillStyle = '#f1d08a'; g.textAlign = 'center'; g.textBaseline = 'middle'
  let px = 54
  do { g.font = `700 ${px}px Georgia, 'Times New Roman', serif`; px -= 2 } while (g.measureText(name.toUpperCase()).width > 460 && px > 20)
  g.fillText(name.toUpperCase(), 256, 68)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  return t
}
// what each KIND of front adds to the plain kit, so the square reads as named places rather than one house seven times.
// The kinds are play3d's (FrontKind); the dressing is build (Jin's), from canon's own lines where it has them:
// the Station is the Roman-bones building of the set (world/athernyx.md: columns, arches) and the smithy town's forge
// glow and chimney (world/rune-hold.md: "steam rising from smithies", "forge-warmed walls").
const AWNING: Partial<Record<string, string>> = { tavern: '#8a2f22', cafe: '#2f6f6a', books: '#2f4f2a', inn: '#6a3f1f' }
function FrontSign({ b }: { b: Building }) {
  const f = FRONTS.find(q => q.id === b.front)
  const tex = useMemo(() => (f ? signTexture(f.name) : null), [f])
  useEffect(() => () => tex?.dispose(), [tex])
  if (!f || !tex) return null
  // the street face is local +z (plan.ts yaw → rotation.y = π/2 − yaw); everything here hangs off that face
  const ry = Math.PI / 2 - b.yaw, floor = b.y1 + 0.25, H = b.floors * FLOOR_H
  const awning = AWNING[f.kind]
  const cols = f.kind === 'station' ? Math.max(4, Math.round(b.w / 3)) : 0
  return (
    <group position={[b.x, floor, b.z]} rotation={[0, ry, 0]}>
      {/* the board hangs above an awning or a porch lintel, never behind it */}
      <group position={[0, awning || f.kind === 'inn' ? 3.55 : 2.75, b.d / 2 + (cols ? 3.2 : 0.1)]}>
        <mesh position={[0, 0, 0.06]}><planeGeometry args={[3.6, 0.9]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
        <mesh position={[2.2, -0.5, 0.25]}><boxGeometry args={[0.28, 0.42, 0.28]} /><meshBasicMaterial color="#ffcf7a" toneMapped={false} /></mesh>
      </group>
      {awning && (
        // a cloth awning over the door, sloping out to the street
        <mesh position={[0, 2.35, b.d / 2 + 0.9]} rotation={[0.35, 0, 0]}><boxGeometry args={[Math.min(b.w * 0.55, 7), 0.08, 1.9]} /><meshLambertMaterial color={awning} /></mesh>
      )}
      {f.kind === 'inn' && (
        // a lamplit porch: two posts and a lintel
        <group position={[0, 0, b.d / 2 + 1.2]}>
          {[-1.4, 1.4].map(x => <mesh key={x} position={[x, 1.3, 0]}><boxGeometry args={[0.3, 2.6, 0.3]} /><meshLambertMaterial color="#5a3d26" /></mesh>)}
          <mesh position={[0, 2.7, 0]}><boxGeometry args={[3.3, 0.25, 0.4]} /><meshLambertMaterial color="#5a3d26" /></mesh>
        </group>
      )}
      {f.kind === 'smithy' && (
        <>
          {/* the forge mouth glowing through the open door, and a tall stone stack */}
          <mesh position={[0, 1.1, b.d / 2 + 0.03]}><planeGeometry args={[1.8, 2.0]} /><meshBasicMaterial color="#ff8a3a" toneMapped={false} /></mesh>
          <mesh position={[b.w * 0.3, H + 3.2, -b.d * 0.2]}><boxGeometry args={[1.4, 6.5, 1.4]} /><meshLambertMaterial color="#6f655a" flatShading /></mesh>
        </>
      )}
      {cols > 0 && (
        // the Station's portico: a colonnade along the front under a plain entablature (Roman bones)
        <group position={[0, 0, b.d / 2 + 2.6]}>
          {Array.from({ length: cols }, (_, i) => -b.w / 2 + 1 + i * (b.w - 2) / (cols - 1)).map(x => (
            <mesh key={x} position={[x, FLOOR_H * 0.9, 0]}><cylinderGeometry args={[0.38, 0.45, FLOOR_H * 1.8, 10]} /><meshLambertMaterial color="#e6dcc6" /></mesh>
          ))}
          <mesh position={[0, FLOOR_H * 1.8 + 0.35, -0.6]}><boxGeometry args={[b.w + 0.6, 0.7, 2.4]} /><meshLambertMaterial color="#d9cdb3" /></mesh>
          <mesh position={[0, 0.15, -0.6]}><boxGeometry args={[b.w + 1, 0.3, 3]} /><meshLambertMaterial color="#b9ad95" /></mesh>
        </group>
      )}
    </group>
  )
}

// ── RUNE HOLD'S TRAVELERS STATION: play3d's spaceport scene (terminal, six berths, the seated ship, the departures
// board), set down on its continent site (rune-hold-core › placeStation) on a stone terrace built up to one level.
// Station metres = continent metres; the scene's (0,0) is the field's north-west corner. ──
function StationField({ s }: { s: StationSite }) {
  const h = s.level - s.base
  return (
    <group position={[s.x, s.level, s.z]} rotation={[0, -s.yaw, 0]}>
      <mesh position={[STATION_COLS / 2 - 0.5, -h / 2 - 0.02, STATION_ROWS / 2 - 0.5]}>
        <boxGeometry args={[STATION_COLS + 0.6, h, STATION_ROWS + 0.6]} />
        <meshLambertMaterial color="#8e8270" flatShading />
      </mesh>
      <StationScene />
      {/* the stair up the terrace to the terminal's town door (the walk from the town arrives at its foot) */}
      {h > 0.6 && (() => {
        const L = h / 0.55, z = STATION.doors.town.z + STATION.doors.town.h / 2 - 0.5
        return <mesh position={[-L / 2 - 0.5, -h / 2, z]} rotation={[0, 0, Math.atan2(h, L)]}><boxGeometry args={[Math.hypot(L, h), 0.4, 4]} /><meshLambertMaterial color="#a89a82" flatShading /></mesh>
      })()}
    </group>
  )
}

// a town's name board at the roadside where you drive in: two posts and the painted board, facing you
function NameBoard({ b }: { b: { x: number; z: number; y: number; yaw: number; name: string } }) {
  const tex = useMemo(() => signTexture(b.name), [b.name])
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <group position={[b.x, b.y, b.z]} rotation={[0, Math.PI / 2 - b.yaw, 0]}>
      {[-1.7, 1.7].map(x => <mesh key={x} position={[x, 1.3, 0]}><boxGeometry args={[0.18, 2.6, 0.18]} /><meshLambertMaterial color="#4a3322" /></mesh>)}
      <mesh position={[0, 2.1, 0.1]}><planeGeometry args={[3.8, 0.95]} /><meshBasicMaterial map={tex} toneMapped={false} side={THREE.DoubleSide} /></mesh>
    </group>
  )
}

export function Towns({ R, focus }: { R: Region; focus: React.MutableRefObject<THREE.Vector3> }) {
  const cache = useRef(new Map<number, TownPlan>())
  const [shown, setShown] = useState<TownPlan[]>([])
  const shownKey = useRef('')
  const t = useRef(0)
  const roof = useMemo(roofGeometry, [])
  const facade = useMemo(facadeMaterial, [])
  useEffect(() => () => facade.m.dispose(), [facade])
  const centres = useMemo(() => R.meta.places.map(p => {
    const sq = p.kind === 'spot' ? undefined : R.meta.network?.junctions.find(j => j.kind === 'square' && j.place === p.id)
    return { x: sq?.x ?? p.x, z: sq?.z ?? p.z, r: townRadius(p) }
  }), [R])

  // plan at most ONE town per tick (nearest first), so a stall is one town's worth, never the map's
  useFrame((_, dt) => {
    facade.uniforms.uNight.value = 1 - daylight(dayProgress())
    t.current -= dt
    if (t.current > 0) return
    t.current = 0.4
    const f = focus.current
    const near = centres.map((c, i) => ({ i, d: Math.hypot(c.x - f.x, c.z - f.z) - c.r })).filter(o => centres[o.i].r > 0)
    const todo = near.filter(o => o.d < PLAN_REACH && !cache.current.has(o.i)).sort((a, b) => a.d - b.d)[0]
    if (todo) cache.current.set(todo.i, planTown(R, R.meta.places[todo.i], todo.i))
    const vis = near.filter(o => o.d < SHOW_REACH && cache.current.has(o.i)).map(o => o.i).sort((a, b) => a - b)
    const key = vis.join(',')
    if (key !== shownKey.current) { shownKey.current = key; setShown(vis.map(i => cache.current.get(i)!)) }
  })

  const parts = useMemo(() => {
    const all: { b: Building; s: Style; k: number }[] = []
    shown.forEach(pl => { const s = styleOf(pl.place); pl.buildings.forEach((b, k) => all.push({ b, s, k })) })
    return all
  }, [shown])
  const lanes = useMemo(() => laneGeometry(R, shown), [R, shown])
  useEffect(() => () => lanes.dispose(), [lanes])

  const plinths = useRef<THREE.InstancedMesh>(null), walls = useRef<THREE.InstancedMesh>(null)
  const roofs = useRef<THREE.InstancedMesh>(null), chimneys = useRef<THREE.InstancedMesh>(null)
  const n = Math.max(1, parts.length)
  useEffect(() => {
    if (!plinths.current || !walls.current || !roofs.current || !chimneys.current) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color()
    const hide = new THREE.Matrix4().makeScale(0, 0, 0)
    parts.forEach(({ b, s: st }, i) => {
      // local x runs along the street, local z faces it: rotation.y = π/2 − yaw (see plan.ts yaw)
      e.set(0, Math.PI / 2 - b.yaw, 0); q.setFromEuler(e)
      const H = b.floors * FLOOR_H, top = b.y1 + 0.25
      // plinth: from a little under the lowest corner up to the floor line
      const ph = top - (b.y0 - 0.6)
      p.set(b.x, b.y0 - 0.6 + ph / 2, b.z); s.set(b.w + 0.3, ph, b.d + 0.3)
      plinths.current!.setMatrixAt(i, m.compose(p, q, s)); plinths.current!.setColorAt(i, c.set(st.plinth))
      p.set(b.x, top + H / 2, b.z); s.set(b.w, H, b.d)
      walls.current!.setMatrixAt(i, m.compose(p, q, s)); walls.current!.setColorAt(i, c.set(st.walls[Math.floor(b.v * st.walls.length) % st.walls.length]))
      // a low Roman pitch; the eaves overhang a little
      const rh = (b.kind === 'hall' ? 0.22 : 0.32) * b.d
      p.set(b.x, top + H, b.z); s.set(b.w + 0.6, rh, b.d + 0.8)
      roofs.current!.setMatrixAt(i, m.compose(p, q, s)); roofs.current!.setColorAt(i, c.set(st.roofs[Math.floor(b.v * 7.3) % st.roofs.length]))
      if (b.v > 0.3) {
        const off = (b.v - 0.65) * b.w * 0.8
        const lx = Math.cos(Math.PI / 2 - b.yaw) * off, lz = -Math.sin(Math.PI / 2 - b.yaw) * off
        p.set(b.x + lx, top + H + rh * 0.7, b.z + lz); s.set(0.9, rh * 0.9 + 1.4, 0.9)
        chimneys.current!.setMatrixAt(i, m.compose(p, q, s)); chimneys.current!.setColorAt(i, c.set(st.plinth))
      } else chimneys.current!.setMatrixAt(i, hide)
    })
    for (const r of [plinths, walls, roofs, chimneys]) {
      r.current!.count = parts.length
      r.current!.instanceMatrix.needsUpdate = true
      if (r.current!.instanceColor) r.current!.instanceColor.needsUpdate = true
    }
  }, [parts])

  return (
    <>
      <mesh geometry={lanes}><meshLambertMaterial color="#c9b892" side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-2} /></mesh>
      <instancedMesh key={`p${n}`} frustumCulled={false} ref={plinths} args={[undefined, undefined, n]}><boxGeometry /><meshLambertMaterial flatShading /></instancedMesh>
      <instancedMesh key={`w${n}`} frustumCulled={false} ref={walls} args={[undefined, undefined, n]} material={facade.m}><boxGeometry /></instancedMesh>
      <instancedMesh key={`r${n}`} frustumCulled={false} ref={roofs} args={[undefined, undefined, n]} geometry={roof}><meshLambertMaterial flatShading side={THREE.DoubleSide} /></instancedMesh>
      <instancedMesh key={`c${n}`} frustumCulled={false} ref={chimneys} args={[undefined, undefined, n]}><boxGeometry /><meshLambertMaterial flatShading /></instancedMesh>
      {parts.filter(q => q.b.front).map(q => <FrontSign key={`${q.b.front}`} b={q.b} />)}
      {shown.flatMap(pl => (pl.boards ?? []).map((b, i) => <NameBoard key={`${pl.place}-${i}`} b={b} />))}
      {shown.filter(pl => pl.station).map(pl => <StationField key={pl.place} s={pl.station!} />)}
      {R.meta.places.filter(p => p.name).map(p => (
        <mesh key={p.id} position={[p.x, R.heightAt(p.x, p.z) + 45, p.z]}>
          <cylinderGeometry args={[0.6, 1.4, 90, 8, 1, true]} />
          <meshBasicMaterial color="#ffd77a" transparent opacity={0.28} depthWrite={false} fog={false} />
        </mesh>
      ))}
    </>
  )
}
