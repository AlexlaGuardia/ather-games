'use client'

/**
 * THE HOLLOW BENCH — can a Hollow be findable at night WITHOUT owning a light?
 *
 * ★★★ THE QUESTION, AND IT IS A REAL CONFLICT, NOT A TUNING PASS (2026-09-04, sprites lane).
 * `design-briefs/hollows.md` lists **emissive** under *what would break it*: a Hollow *"borrows or
 * it is grey"*. The shipped material (`hollow-look.ts:createHollowMat`) sets `emissive` to the
 * body's own colour at `selfLight: 0.15`. Both positions are defensible — `spawnDark` refuses all
 * block light and needs night skylight, so at `selfLight: 0` a Hollow is **invisible**, which Alex
 * reported twice, and a fix sized from arithmetic rather than from a picture got "looking terrible".
 *
 * The brief offers a third answer nobody has tried: **borrowed specular.** Diffuse dead flat,
 * specular tinted entirely by the surroundings. In a greyfield there is nothing to borrow, so it
 * reads nearly matte and is hard to see. At the edge of a tended plot it goes glossy with your
 * honey-gold. *"The wetter a Hollow looks, the closer it is to something worth protecting."* If
 * that works it dissolves the conflict rather than trading one side away — the Hollow becomes
 * findable exactly where being unable to find it matters, and stays invisible where it does not.
 *
 * ── SO THE SCENE IS THE EXPERIMENT ────────────────────────────────────────────────────────────
 * Greyfield on the left, tended plot on the right, and a slider that walks the Hollow between them.
 * Drag it and watch the sheen arrive. That single motion is the whole proposal; if the Hollow looks
 * identical at both ends, the idea is wrong and the shipped self-light stays.
 *
 * ⚠ THE COMPARISON SIDE IS THE REAL SHIPPED MATERIAL, imported from `hollow-look.ts`, never a copy
 * of its numbers — so "as shipped" cannot drift away from what actually ships.
 *
 * ⚠ AND IT IS LIT AS A HOLLOW IS ACTUALLY LIT. `spawnDark` means a Hollow only ever exists in the
 * darkest places the game has, so this bench defaults to NIGHT. Judging one under a daylight rig
 * would be the 2026-08-30 failure exactly: a reading taken one layer away from where the world
 * takes it.
 *
 * Run: `tools/devwin.sh sprites` → http://localhost:3202/shimmer/dev/hollow
 */

import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, CubeCamera } from '@react-three/drei'
import { HollowDoll, type HollowMode } from '../../voxel3d/HollowDoll'
import { HOLLOW_LOOK, type HollowForm } from '../../voxel3d/hollow-look'
import { EYE_STAND } from '../../voxel3d/locomotion'

const FORMS: HollowForm[] = ['warden', 'stalker', 'caster']

const chip: React.CSSProperties = {
  background: '#1b1a22', border: '1px solid #33313f', color: '#d8d3e2',
  padding: '5px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
}

function Btn({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={{ ...chip, opacity: on ? 1 : 0.42 }}>{children}</button>
}

export default function HollowBenchPage() {
  const [form, setForm] = useState<HollowForm>('stalker')
  const [mode, setMode] = useState<HollowMode>('borrowed')
  const [x, setX] = useState(-4)          // -6 greyfield … +6 tended plot
  const [speed, setSpeed] = useState(0.8)
  const [night, setNight] = useState(true)
  const [eye, setEye] = useState(true)

  // ⚠ DERIVED FROM THE SHIPPED CONSTANT, never re-typed — `dev-eye.test.ts` and its two retired
  // literals. A Hollow is met on foot at night; that is the only vantage that can judge one.
  const camera = eye
    ? { position: [0, EYE_STAND, 9] as [number, number, number], fov: 60 }
    : { position: [0, 3.4, 7] as [number, number, number], fov: 45 }

  const sky = night ? '#080a0e' : '#9fb6c6'

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0d0d12' }}>
      <header style={{ padding: '10px 14px', borderBottom: '1px solid #26242e' }}>
        <h1 className="gx-title" style={{ margin: 0, fontSize: 15, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#e6e1d6' }}>
          The Hollow Bench
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#8f8a9d', maxWidth: 820, lineHeight: 1.5 }}>
          Greyfield on the left, tended plot on the right. Drag <b style={{ color: '#c8b98a' }}>GROUND</b> to
          walk it between them. The brief says it should go glossy as it nears the plot and near-matte
          in the grey, with no light of its own. If it looks the same at both ends, the idea is wrong.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
          {FORMS.map(f => <Btn key={f} on={form === f} onClick={() => setForm(f)}>{f}</Btn>)}
          <span style={{ width: 10 }} />
          <Btn on={mode === 'borrowed'} onClick={() => setMode('borrowed')}>Brief: borrowed light</Btn>
          <Btn on={mode === 'shipped'} onClick={() => setMode('shipped')}>
            As shipped (selfLight {HOLLOW_LOOK.selfLight})
          </Btn>
          <Btn on={night} onClick={() => setNight(!night)}>{night ? 'Night' : 'Day'}</Btn>
          <Btn on={eye} onClick={() => setEye(!eye)}>{eye ? "Keeper's eye" : 'Above'}</Btn>
          <label style={{ ...chip, cursor: 'default', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="gx-label" style={{ fontSize: 10, letterSpacing: '0.1em' }}>GROUND</span>
            <input type="range" min={-6} max={6} step={0.1} value={x}
              onChange={e => setX(Number(e.target.value))} style={{ width: 150 }} />
            <span className="gx-value" style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11, color: x > 1 ? '#e8c979' : '#8f8a9d' }}>
              {x < -1 ? 'greyfield' : x > 1 ? 'tended plot' : 'the edge'}
            </span>
          </label>
          <label style={{ ...chip, cursor: 'default', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="gx-label" style={{ fontSize: 10, letterSpacing: '0.1em' }}>PACE</span>
            <input type="range" min={0} max={1.3} step={0.05} value={speed}
              onChange={e => setSpeed(Number(e.target.value))} style={{ width: 80 }} />
          </label>
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0 }}>
        <Canvas shadows camera={camera} key={`${eye}-${night}`}>
          <color attach="background" args={[sky]} />
          {/* Night is the honest rig: spawnDark means a Hollow only exists in the darkest places. */}
          <hemisphereLight args={[sky, '#101014', night ? 0.22 : 0.8]} />
          <directionalLight position={[-4, 7, 3]} intensity={night ? 0.18 : 0.9} castShadow />

          {/* THE GREYFIELD — drained ground. Nothing here for a Hollow to borrow. */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-7, 0, 0]} receiveShadow>
            <planeGeometry args={[16, 26]} />
            <meshStandardMaterial color="#3a3a3c" roughness={1} />
          </mesh>
          {/* THE TENDED PLOT — honey-gold, and the only real source of anything worth borrowing. */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[7, 0.001, 0]} receiveShadow>
            <planeGeometry args={[16, 26]} />
            <meshStandardMaterial color="#c9973f" emissive="#e8b45a" emissiveIntensity={night ? 0.85 : 0.25} roughness={0.85} />
          </mesh>
          <pointLight position={[7, 2.2, 0]} intensity={night ? 26 : 8} distance={16} color="#ffcf78" />

          {/* ★ The cube camera rides the Hollow, so what it borrows is what is actually around it. */}
          <CubeCamera resolution={64} frames={Infinity} position={[x, 1.1, 0]}>
            {(texture) => (
              <group position={[x, 0, 0]}>
                <HollowDoll form={form} speed={speed} mode={mode} envMap={texture} />
              </group>
            )}
          </CubeCamera>

          <OrbitControls target={[x, 0.9, 0]} maxPolarAngle={Math.PI / 2 - 0.02} />
        </Canvas>
      </div>
    </div>
  )
}
