'use client'
// RUNE HOLD — greybox preview, at eye height, for one mannequin at a time.
//
// ★ THIS EXISTS TO ANSWER ONE OPEN QUESTION AND THEN GET OUT OF THE WAY. `metrics.ts` records the
// authoring body as *"Alex's to overturn in one line"*, and `rune-hold.ts` is authored so that
// flipping it re-derives the whole town. But a body is a thing you judge by STANDING IN a street,
// not by comparing 1.62 against 1.15 in a doc — so this renders the same town from the same spot at
// each mannequin's own standing eye, and the difference is the answer.
//
//   /shimmer/dev/runehold?body=voxel      (default — the current pick)
//   /shimmer/dev/runehold?body=play3d
//   &yaw=<deg>&x=<n>&z=<n>                move the camera; defaults stand on the square
//
// ⚠ NOT WALKABLE, AND DELIBERATELY SO. `metrics.ts` states it plainly: *"there is no continuous
// collider yet"* — play3d's floor resolver reads TILE TIERS, and this geometry is continuous. A
// preview that let you walk would be quietly asserting a collider that does not exist, and the
// first thing it would teach is a movement feel the real game cannot reproduce. Looking is honest;
// walking would not be. The collider is its own piece of work.
//
// ⚠ AND IT RENDERS THE REAL MODULE. Nothing about the town is restated here — masses, streets and
// the station all come from `runeHold(body)`. A preview that re-declared the layout would be the
// hand-kept mirror this repo has paid for repeatedly: it would agree with the town right up until
// one of them changed, and it would agree hardest at the moment someone came looking.
import { Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Canvas } from '@react-three/fiber'
import { runeHold, townFaults } from '../../play3d/rune-hold'
import { BODIES, metricsFor, type Body } from '../../play3d/metrics'

function Scene({ body }: { body: Body }) {
  const town = useMemo(() => runeHold(body), [body])
  const M = metricsFor(body)
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[30, 60, 20]} intensity={1.1} castShadow />
      {/* The square's floor — the datum every height in the town is measured from. */}
      <mesh position={[town.square.x, -0.05, town.square.z]} receiveShadow>
        <boxGeometry args={[town.square.size, 0.1, town.square.size]} />
        <meshStandardMaterial color="#6b6257" />
      </mesh>
      {town.masses.map(m => (
        <mesh key={m.id} position={[m.x, m.y + m.h / 2, m.z]} castShadow receiveShadow>
          <boxGeometry args={[m.w, m.h, m.d]} />
          {/* The one open door is lit differently, because "four shut doors and one open" is the
              whole read of the opening and it should be legible in a greybox too. */}
          <meshStandardMaterial color={m.id === 'spirit-corner' ? '#c9a227' : '#8a8079'} />
        </mesh>
      ))}
      {town.streets.map(s => {
        const dx = s.to[0] - s.from[0], dz = s.to[1] - s.from[1]
        const len = Math.hypot(dx, dz)
        return (
          <mesh key={s.id}
                position={[(s.from[0] + s.to[0]) / 2, s.fromTerrace * town.terraceRise + 0.02, (s.from[1] + s.to[1]) / 2]}
                rotation={[0, Math.atan2(dx, dz), 0]} receiveShadow>
            <boxGeometry args={[s.width, 0.04, len]} />
            <meshStandardMaterial color="#7d746a" />
          </mesh>
        )
      })}
      <mesh position={[town.station.x, town.station.h / 2, town.station.z]} castShadow>
        <boxGeometry args={[town.station.w, town.station.h, town.station.d]} />
        <meshStandardMaterial color="#5f6b7a" />
      </mesh>
      {/* A reference post at the body's own standing cover, so the eye has something to read the
          street against. It is derived, never a stick of a chosen height. */}
      <mesh position={[M.widths.lanePair, M.cover.stand / 2, M.widths.lanePair]}>
        <boxGeometry args={[0.3, M.cover.stand, 0.3]} />
        <meshStandardMaterial color="#b4472e" />
      </mesh>
    </>
  )
}

function Preview() {
  const q = useSearchParams()
  const which = q.get('body') === 'play3d' ? 'play3d' : 'voxel'
  const body = BODIES[which]
  const town = useMemo(() => runeHold(body), [body])
  const faults = useMemo(() => townFaults(town), [town])
  const M = metricsFor(body)
  const yaw = Number(q.get('yaw') ?? 0)
  const cx = Number(q.get('x') ?? 0)
  const cz = Number(q.get('z') ?? town.square.size / 2 - 1)

  return (
    <div className="fixed inset-0 bg-[#a8b8c8]">
      <Canvas shadows camera={{ position: [cx, body.eyeStand, cz], fov: 70, near: 0.05, far: 500 }}
              onCreated={({ camera }) => { camera.rotation.order = 'YXZ'; camera.rotation.y = (yaw * Math.PI) / 180 }}>
        <Scene body={body} />
      </Canvas>
      {/* ★ THE READOUT IS PART OF THE INSTRUMENT. A screenshot shows that two towns differ and can
          never say by how much; these are the numbers the picture is of. `data-runehold` is the
          handle a headless shot scrapes — same contract as the voxel HUD's `data-perf`. */}
      <div data-runehold className="absolute top-3 left-3 text-[11px] font-mono text-white/90 bg-black/55 rounded px-3 py-2 leading-relaxed pointer-events-none">
        <div className="font-semibold tracking-wide">RUNE HOLD · GREYBOX</div>
        <div>body <span className="text-white/60">{which}</span> · eye {body.eyeStand.toFixed(2)} · slide {body.eyeSlide.toFixed(2)} · r {body.radius.toFixed(2)}</div>
        <div>square {town.square.size.toFixed(1)} · terrace {town.terraceRise.toFixed(2)} · street {M.widths.lanePair.toFixed(2)}</div>
        <div>cover slide {M.cover.slide.toFixed(2)} · stand {M.cover.stand.toFixed(2)} · full {M.cover.full.toFixed(2)}</div>
        <div className={faults.length ? 'text-red-300' : 'text-emerald-300'}>
          {faults.length ? `${faults.length} FAULT: ${faults.map(f => f.why).join(', ')}` : 'town reads clean'}
        </div>
      </div>
    </div>
  )
}

// ⚠ SUSPENSE IS NOT OPTIONAL HERE. `useSearchParams` opts a client component out of static
// rendering, and the App Router FAILS THE PRODUCTION BUILD ("missing suspense boundary") rather
// than warning — so this would have passed tsc, passed every test, and broken the deploy for
// whoever happened to take the lock next. Caught by knowing the framework, not by the typechecker.
export default function RuneHoldPreview() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-[#a8b8c8]" />}>
      <Preview />
    </Suspense>
  )
}
