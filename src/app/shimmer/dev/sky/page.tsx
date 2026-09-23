'use client'

// THE SKY — the Ather's sky at every hour, for Alex to judge against canon's ruling.
//
// ★ IT MOUNTS THE SHIPPED RIG. `VoxelDayNight` is the exact dome + light the world runs, and the
// clock is pinned through the shipped `setTimePin`, so what you judge here is what ships. `dev/ring`
// states the rule: a preview that re-derives can be perfectly correct while the game is wrong.
//
// What to look for (canon `world/ather.md` › *The sky, looked at*, 2026-09-23): the Core never
// moves · by day a blaze you cannot look at · at dusk the whole body banks gold → ember → a dark
// coal with live veins and a warm rim, never a crescent · as it dims the rim of the sky kindles ·
// the flecks come up, denser toward the horizon · dawn is the same journey back.
//
// Run: tools/devwin.sh play  ->  http://localhost:3203/shimmer/dev/sky   (any lane but hub)

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { VoxelDayNight } from '../../voxel3d/day-night'
import { setTimePin } from '../../engine/day-cycle'
import { coreBank, CORE_DIR } from '../../voxel3d/core-sky'
import { EYE_STAND } from '../../voxel3d/locomotion'

const HOURS = [
  { label: 'Dawn', h: 6 }, { label: 'Day', h: 12 }, { label: 'Dusk', h: 18 }, { label: 'Night', h: 0 },
] as const
/** Watch the turn: one full day in this many real seconds. */
const LAPSE_S = 48

/** Drag to look. Starts facing the Core so the first thing on screen is the thing being judged. */
function LookAround() {
  const { camera, gl } = useThree()
  const look = useRef({ yaw: 0, pitch: 1.0 })
  useEffect(() => {
    // Face the Core's compass bearing (it leans +z); pitch is lifted enough to hold the disc and horizon.
    // A camera at yaw 0 looks down -z; this yaw turns it to the Core's bearing.
    look.current.yaw = Math.atan2(-CORE_DIR.x, -CORE_DIR.z)
    let drag: { x: number; y: number } | null = null
    const el = gl.domElement
    const down = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId) }
    const move = (e: PointerEvent) => {
      if (!drag) return
      look.current.yaw -= (e.clientX - drag.x) * 0.005
      look.current.pitch = Math.max(-0.4, Math.min(1.45, look.current.pitch + (e.clientY - drag.y) * 0.005))
      drag = { x: e.clientX, y: e.clientY }
    }
    const up = () => { drag = null }
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up)
    }
  }, [gl])
  useFrame(() => {
    camera.rotation.set(look.current.pitch, look.current.yaw, 0, 'YXZ')
  })
  return null
}

/** A patch of ground and a few blocks, lit by the rig, so the hour is judged on the world and not only the dome. */
function Ground() {
  const blocks = useMemo(() => {
    const out: [number, number, number][] = []
    for (let i = 0; i < 26; i++) {
      const a = i * 2.39996, r = 6 + (i * 7.3) % 30
      out.push([Math.cos(a) * r, 0.5 + (i % 3 === 0 ? 1 : 0), Math.sin(a) * r])
    }
    return out
  }, [])
  const grass = useMemo(() => new THREE.MeshLambertMaterial({ color: '#79b85a' }), [])
  const stone = useMemo(() => new THREE.MeshLambertMaterial({ color: '#b9ab94' }), [])
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const plane = useMemo(() => new THREE.PlaneGeometry(400, 400), [])
  useEffect(() => () => { grass.dispose(); stone.dispose(); box.dispose(); plane.dispose() }, [grass, stone, box, plane])
  return (
    <>
      <mesh geometry={plane} material={grass} rotation={[-Math.PI / 2, 0, 0]} />
      {blocks.map((p, i) => <mesh key={i} geometry={box} material={i % 4 ? grass : stone} position={p} />)}
    </>
  )
}

export default function SkyBench() {
  const [hour, setHour] = useState(18)
  const [lapse, setLapse] = useState(false)

  // ★ The clock is pinned through the SHIPPED mechanism and released on unmount — `setTimePin` is
  // module state, so a bench that pins dusk and navigates away would leave the world at dusk.
  useEffect(() => { setTimePin(hour) }, [hour])
  useEffect(() => () => setTimePin(null), [])

  useEffect(() => {
    if (!lapse) return
    let last = performance.now(), raf = 0
    const tick = (now: number) => {
      const dt = (now - last) / 1000; last = now
      setHour(h => (h + dt * (24 / LAPSE_S)) % 24)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [lapse])

  const bank = coreBank(hour / 24)
  const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60)

  return (
    <div className="fixed inset-0 bg-black text-white/80 font-mono text-[11px]">
      <div className="absolute z-10 m-3 w-[min(22rem,calc(100vw-24px))] rounded border border-white/15 bg-black/70 p-3">
        <div className="gx-label mb-2 text-[9px] text-white/40">The Ather&apos;s sky — the Core, at every hour</div>
        <div className="mb-2 flex gap-1.5">
          {HOURS.map(x => (
            <button key={x.label} onClick={() => { setLapse(false); setHour(x.h) }}
                    className={`flex-1 rounded border px-2 py-1 ${Math.abs(hour - x.h) < 0.05 && !lapse ? 'border-amber-300/70 text-amber-100' : 'border-white/15 text-white/60'}`}>
              {x.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 py-1">
          <span className="w-10 shrink-0 tabular-nums">{String(hh).padStart(2, '0')}:{String(mm).padStart(2, '0')}</span>
          <input type="range" min={0} max={24} step={0.05} value={hour}
                 onChange={e => { setLapse(false); setHour(Number(e.target.value)) }} className="flex-1 accent-amber-300" />
        </label>
        <button onClick={() => setLapse(l => !l)}
                className={`mt-1 w-full rounded border px-2 py-1 ${lapse ? 'border-amber-300/70 text-amber-100' : 'border-white/15 text-white/60'}`}>
          {lapse ? '❚❚ stop' : `▶ watch the turn (a day in ${LAPSE_S}s)`}
        </button>
        <div className="mt-2 flex justify-between border-t border-white/10 pt-2">
          <span className="text-white/40">bank</span>
          <span className="tabular-nums">{bank.toFixed(2)} · {bank > 0.66 ? 'blaze' : bank > 0.33 ? 'gold → ember' : bank > 0.02 ? 'ember → coal' : 'the coal'}</span>
        </div>
        <div className="mt-2 text-[10px] leading-snug text-white/35">
          Drag to look. The shipped rig: what you see here is what the world draws. Numbers live in
          <span className="text-white/60"> sky-palette.ts</span> (colours) and <span className="text-white/60">core-sky.ts</span> (where, size, breath).
        </div>
      </div>
      {/* A keeper's eye on flat ground: the sky is judged from where a keeper stands under it. */}
      <Canvas camera={{ position: [0, EYE_STAND, 0], fov: 70, near: 0.1, far: 600 }}>
        <VoxelDayNight />
        <LookAround />
        <Ground />
      </Canvas>
    </div>
  )
}
