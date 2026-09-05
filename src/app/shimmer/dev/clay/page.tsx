'use client'

/**
 * THE CLAY BENCH — does a rigid-part moglin, posed and shot on twos, read as clay?
 *
 * ★★★ WHY THIS EXISTS (2026-09-04, sprites lane). Alex asked how clay-doll character models are
 * made and rigged. The claim this bench exists to test is that for this look **there is no rigging
 * step**: no armature, no vertex weights, no skinned mesh, no Blender. A claymation figure is
 * rigid parts on a joint hierarchy, posed between frames, and `Shimmer3D.tsx` already draws the
 * moglin as a stack of primitives — it just never poses them.
 *
 * ⚠ NOTHING HERE IS WIRED INTO THE GAME. The shipped moglin is unchanged and still has no limbs
 * and no joints. This page is the LOOK, put somewhere it can be judged before anyone edits the
 * scene, because arms and legs on a moglin is an art call and art calls are Alex's.
 *
 * ── THE THREE DOLLS ARE THE EXPERIMENT, AND THE RIGHT-HAND ONE IS THE POINT ───────────────────
 * Left to right: SMOOTH (60fps, every frame interpolated) · 24fps · 12fps. Same pose function,
 * same geometry, same materials, one stepped clock each. The bet is that the judder does more work
 * than any texture would: stop motion reads as "a hand moved this", and the eye gets there long
 * before it decides anything about the surface. If that is wrong, it will be obvious here and
 * costs nothing to abandon.
 *
 * ⚠ AND JUDGE IT FROM A KEEPER'S EYE BEFORE BELIEVING THE TURNTABLE. PATTERNS 2026-08-30: a
 * reading taken one layer away from where the world takes it is the failure that does not look
 * like one. A doll spinning two blocks from the camera will read as clay whether or not it does at
 * the distance a moglin is actually met at, so the eye view is derived from the shipped
 * `EYE_STAND` and stands the dolls out at patrol range. The turntable is for the craft; the eye
 * view is the one that decides.
 *
 * Run: `tools/devwin.sh sprites` → http://localhost:3202/shimmer/dev/clay
 */

import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { MoglinDoll } from '../../play3d/MoglinDoll'
import { STEP_FPS } from '../../play3d/moglin-pose'
import { EYE_STAND } from '../../voxel3d/locomotion'

/** The cadences under test. `0` means "do not step" — render smooth at the display rate. */
const CADENCES: { fps: number; label: string; note: string }[] = [
  { fps: 0, label: 'smooth', note: '60fps, interpolated — how a game normally moves' },
  { fps: 24, label: '24 fps', note: 'film rate, one pose per frame' },
  { fps: STEP_FPS, label: `${STEP_FPS} fps`, note: 'shooting on twos — the stop-motion cadence' },
]

const BACKDROPS: { id: string; label: string; sky: string; ground: string }[] = [
  { id: 'day', label: 'Daylight', sky: '#cfe3ef', ground: '#7d9455' },
  { id: 'dusk', label: 'Dusk', sky: '#3b3350', ground: '#4a4436' },
  { id: 'void', label: 'Neutral grey', sky: '#8a8a8a', ground: '#6e6e6e' },
]

const chip: React.CSSProperties = {
  background: '#211f2b', border: '1px solid #38344a', color: '#ddd6ea',
  padding: '5px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
}

function Toggle({ on, set, label, off }: {
  on: boolean; set: (v: boolean) => void; label: string; off: string
}) {
  return (
    <button onClick={() => set(!on)} style={{ ...chip, opacity: on ? 1 : 0.45 }}>
      {on ? label : off}
    </button>
  )
}

export default function ClayBenchPage() {
  const [posed, setPosed] = useState(true)
  const [limbs, setLimbs] = useState(true)
  const [clay, setClay] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [eye, setEye] = useState(false)
  const [bd, setBd] = useState(BACKDROPS[0])

  // ⚠ DERIVED, NEVER RE-TYPED. `dev-eye.test.ts`: a re-typed literal is not a derivation, and both
  // retired copies of this number really shipped. In eye mode the camera stands where a keeper's
  // head is and the dolls sit out at the range a patrol is actually met at.
  const camera = eye
    ? { position: [0, EYE_STAND, 7.5] as [number, number, number], fov: 62 }
    : { position: [0, 1.15, 3.2] as [number, number, number], fov: 42 }

  const spacing = eye ? 1.9 : 1.25

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#14131a' }}>
      <header style={{ padding: '10px 14px', borderBottom: '1px solid #2c2a38' }}>
        <h1 className="gx-title" style={{ margin: 0, fontSize: 15, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#e8e3d8' }}>
          The Clay Bench
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9a94a8', maxWidth: 780, lineHeight: 1.5 }}>
          One moglin, three cadences. Rigid parts on a joint hierarchy — no armature, no weights, no
          skinned mesh. The judder is the experiment; the surface is only a material.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <Toggle on={posed} set={setPosed} label="Posed" off="Frozen" />
          <Toggle on={limbs} set={setLimbs} label="Limbs" off="No limbs (today)" />
          <Toggle on={clay} set={setClay} label="Matte clay" off="Current fur" />
          <Toggle on={eye} set={setEye} label="Keeper's eye" off="Turntable" />
          <label style={{ ...chip, cursor: 'default', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="gx-label" style={{ fontSize: 10, letterSpacing: '0.1em' }}>PACE</span>
            <input type="range" min={0} max={1.4} step={0.05} value={speed}
              onChange={e => setSpeed(Number(e.target.value))} style={{ width: 90 }} />
            <span className="gx-value" style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>
              {speed.toFixed(2)}
            </span>
          </label>
          {BACKDROPS.map(b => (
            <button key={b.id} onClick={() => setBd(b)}
              style={{ ...chip, opacity: bd.id === b.id ? 1 : 0.4 }}>{b.label}</button>
          ))}
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0 }}>
        <Canvas shadows camera={camera} key={eye ? 'eye' : 'turn'}>
          <color attach="background" args={[bd.sky]} />
          <hemisphereLight args={[bd.sky, bd.ground, 0.85]} />
          <directionalLight position={[3, 6, 4]} intensity={1.15} castShadow
            shadow-mapSize={[1024, 1024]} />
          {/* a soft fill from the front keeps the matte side from going to mud */}
          <directionalLight position={[-2, 2, 5]} intensity={0.35} />

          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[60, 60]} />
            <meshStandardMaterial color={bd.ground} roughness={1} />
          </mesh>

          {CADENCES.map((c, i) => (
            <group key={c.label} position={[(i - 1) * spacing, 0, 0]}>
              <MoglinDoll fps={c.fps} speed={speed} posed={posed} limbs={limbs} clay={clay} />
            </group>
          ))}

          <OrbitControls target={[0, eye ? 0.7 : 0.6, 0]} maxPolarAngle={Math.PI / 2 - 0.02} />
        </Canvas>
      </div>

      <footer style={{ display: 'flex', borderTop: '1px solid #2c2a38' }}>
        {CADENCES.map(c => (
          <div key={c.label} style={{ flex: 1, padding: '8px 14px', borderRight: '1px solid #2c2a38' }}>
            <div className="gx-label" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8b98a' }}>
              {c.label}
            </div>
            <div style={{ fontSize: 11, color: '#8b8598', marginTop: 2 }}>{c.note}</div>
          </div>
        ))}
      </footer>
    </div>
  )
}
