'use client'
// GREGORY AT MOONWELL GLADE (BETA M30 part 2; canon 44bc0c1 + his look dd2f922). He left the keeper's plot: he sits just
// outside his home at the Wilds' front door, in his LOCKED look (shared/folk-model.tsx NAMED_LOOKS.gregory: round, short,
// spectacles, crinkly eyes, waistcoat over shirtsleeves, a pencil behind one ear), on a bench by the pool. E at him is the
// conversation (greg-talk.ts) and, from it, the plot-ground screen. NOT drawn: Blue (spirits are not drawn in the overworld
// in this build). Mount in the Wilds only; `loaded(x, z)` is the ground height or null while his tile is not streamed in.
//
// BETA M32 (11-19) GREG WALKS: on his tour (greg-tour.ts) he gets up and walks to each stop (shared/folk-path.ts), waits there
// for the keeper (turning to them and waving if they lag), then calls `onArrive(i)` once they are near: page.tsx shows that
// stop's bubble. Off the tour he walks back to his bench and sits. `hold` (a talk is open) keeps him where he stands, facing
// the keeper. `live` publishes where he is NOW (the talk bubble, the camera and E read it), not his bench.
import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import { FolkModel, folkLook, type FolkAction } from '../shared/folk-model'
import { stepWalk, startWalk, faceYaw, turnToward, TURN_RATE, type Walk, type Pt } from '../shared/folk-path'
import { gregSpot } from './moonwell-glade'
import { GladeHome } from './glade-home-view'
import { gladeHomeY } from './glade-home'
import { tourLeg, tourStops } from './greg-tour'

export const BENCH_H = 0.48
/** how near the keeper must come before Greg starts a stop's talk; past LAG he stops walking and waits for them */
export const TOUR_NEAR = 5, TOUR_LAG = 11
export interface GregLive { x: number; z: number; seated: boolean }
/** the tour as the scene needs it: which stop he is heading for / standing at, and whether its talk is open */
export interface GregTourState { i: number; talk: boolean }

type Mode = 'sit' | FolkAction
export function GladeGreg({ loaded, land, tour = null, hold = false, keeper, onArrive, live }: {
  loaded: (x: number, z: number) => number | null
  /** the land itself (no pads): what his home stands on */ land: (x: number, z: number) => number
  tour?: GregTourState | null; hold?: boolean
  keeper?: MutableRefObject<{ x: number; z: number }>
  onArrive?: (i: number) => void
  live?: MutableRefObject<GregLive>
}) {
  const s = gregSpot(), y = loaded(s.x, s.z)
  const g = useRef<THREE.Group>(null)
  const walk = useRef<Walk>(startWalk(s, s.yaw))
  const path = useRef<{ key: string; pts: Pt[] } | null>(null)
  const arrived = useRef(-1), lastY = useRef(y ?? 0)
  const [mode, setMode] = useState<Mode>('sit')
  const modeRef = useRef<Mode>('sit')
  // M153 s1c-1: the layer landed (or a roll back) and his bench moved: seated, he goes with it; walking, he walks home to it
  useEffect(() => { if (modeRef.current === 'sit') { walk.current = startWalk(s, s.yaw); path.current = null } }, [s.x, s.z, s.yaw])   // eslint-disable-line react-hooks/exhaustive-deps
  const setM = (m: Mode) => { if (modeRef.current !== m) { modeRef.current = m; setMode(m) } }
  useEffect(() => { if (!tour) arrived.current = -1 }, [tour])

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw), w = walk.current, k = keeper?.current
    const kd = k ? Math.hypot(k.x - w.x, k.z - w.z) : 0
    const faceKeeper = () => { if (k) w.yaw = turnToward(w.yaw, faceYaw(w, k), TURN_RATE * dt) }
    const go = (key: string, target: number) => {   // walk the leg toward stop `target` (past the last = the bench)
      if (path.current?.key !== key) { path.current = { key, pts: tourLeg(w, target) }; w.leg = 0 }
      const n = stepWalk(w, path.current.pts, dt); Object.assign(w, n)
      return n.done
    }
    const seated = modeRef.current === 'sit'
    if (hold || tour?.talk) {   // a talk is open: stay put (seated stays seated), face the keeper
      if (!seated) { faceKeeper(); setM(tour?.talk ? 'talk' : 'idle') }
    } else if (tour) {
      if (arrived.current === tour.i) { faceKeeper(); setM(kd > TOUR_NEAR ? 'wave' : 'idle') }
      else if (kd > TOUR_LAG && !seated) { faceKeeper(); setM('wave') }   // the keeper fell behind: wait for them
      else if (go(`stop:${tour.i}`, tour.i)) {
        if (kd <= TOUR_NEAR) { arrived.current = tour.i; setM('idle'); onArrive?.(tour.i) }
        else { faceKeeper(); setM('wave') }
      } else setM('walk')
    } else if (!seated) {   // off the tour: back to the bench, then sit facing the pool
      if (go('home', Number.MAX_SAFE_INTEGER)) { w.yaw = s.yaw; path.current = null; setM('sit') } else setM('walk')
    }
    const gy = loaded(w.x, w.z); if (gy !== null) lastY.current = gy
    if (g.current) { g.current.position.set(w.x, lastY.current, w.z); g.current.rotation.y = w.yaw }
    if (live) live.current = { x: w.x, z: w.z, seated: modeRef.current === 'sit' }
  })

  useEffect(() => {   // checks' hook (like __folk): READ where he stands (only set while he is drawn)
    if (y === null) return
    const W = window as unknown as { __greg?: unknown }
    const pub = () => { const w = walk.current; W.__greg = { x: w.x, z: w.z, y: lastY.current, pose: modeRef.current === 'sit' ? 'sit' : 'stand', action: modeRef.current, look: 'gregory', tour: tour ? { ...tour, arrived: arrived.current } : null,
      // the tour's stops AS THIS PAGE HAS THEM (a lot standing Alex's blueprint moves its Moglin to the door, setLotSpot; a check that
      // computes the stops in node has no blueprints and reads stops metres off: the sweep's 1.3-5.2 m 'Greg off his stops', 11-22)
      stops: tourStops().map(t => ({ id: t.id, at: t.at, look: t.look, zone: t.zone })) } }
    pub(); const id = setInterval(pub, 100)   // M117 s2: 100 ms (the walls check samples his path at that rate)
    return () => { clearInterval(id); delete W.__greg }
  }, [y === null, tour])   // eslint-disable-line react-hooks/exhaustive-deps
  if (y === null) return null
  const hg = gladeHomeY(land), hy = Number.isFinite(hg) ? hg : y
  return (
    <>
    <GladeHome y={hy} />
    <group position={[s.x, y, s.z]} rotation-y={s.yaw}>
      {/* a plain bench: seat 0.48 m, two ends */}
      <mesh position={[0, BENCH_H - 0.03, 0.05]}><boxGeometry args={[1.5, 0.06, 0.6]} /><meshLambertMaterial color="#8a6a44" /></mesh>
      {[-0.65, 0.65].map(x => <mesh key={x} position={[x, (BENCH_H - 0.06) / 2, 0.05]}><boxGeometry args={[0.08, BENCH_H - 0.06, 0.5]} /><meshLambertMaterial color="#6f5436" /></mesh>)}
    </group>
    <group ref={g} position={[s.x, y, s.z]} rotation-y={s.yaw}>
      <FolkModel look={folkLook('gregory')} pose={mode === 'sit' ? 'sit' : 'stand'} action={mode === 'sit' ? 'idle' : mode} />
    </group>
    </>
  )
}
