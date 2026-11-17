'use client'

/**
 * THE KEEPER BODY BENCH — Rayman or a segmented doll, side by side (Alex 11-17).
 *
 * ★★★ WHY THIS EXISTS. The open world goes multiplayer (the Wilds as servers), so other keepers will see you and the
 * keeper needs a body before the Alkin, moglins, Hollows and mana'mals that follow it. Alex asked whether a Rayman body
 * (floating hands and feet) is easier than "the full doll with joints". The answer this bench bets on is that, built the
 * Clay Bench's way (rigid parts on a joint hierarchy, posed by a function of time; no armature, no weights, no skinned
 * mesh), they cost the SAME: the Rayman is the doll with its upper/lower limb parts hidden. So the choice is a LOOK, and
 * a look is judged on a screen, not argued.
 *
 * LEFT = segmented doll. RIGHT = Rayman. Same pose function (open/shared/keeper-pose.ts), same clock, same parts
 * (open/shared/keeper-doll.tsx). Keeper's eye stands you where another keeper meets you in the Wilds.
 *
 * ⚠ PLACEHOLDER CRAFT. Hooded, faceless, no skin: the keeper's skin and species are hero art (Alex's). Canon it keeps:
 * the right hand is the glove with one dim seat (lights on a cast), the left wrist wears the bracelet, no metal.
 */

import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { KeeperDoll } from '../../open/shared/keeper-doll'
import { KEEPER_ACTIONS, type KeeperAction } from '../../open/shared/keeper-pose'
import { EYE_STAND } from '../../open/shared/locomotion'

const LOOKS = [
  { label: 'Segmented doll', limbs: true, note: 'every part drawn: shoulder, elbow, hip, knee are pivots' },
  { label: 'Rayman', limbs: false, note: 'the same rig, limb parts hidden: gloves and boots float' },
]
const BACKDROPS = [
  { id: 'day', label: 'Daylight', sky: '#cfe3ef', ground: '#7d9455' },
  { id: 'dusk', label: 'Dusk', sky: '#3b3350', ground: '#4a4436' },
  { id: 'void', label: 'Neutral grey', sky: '#8a8a8a', ground: '#6e6e6e' },
]
const chip: React.CSSProperties = { background: '#211f2b', border: '1px solid #38344a', color: '#ddd6ea', padding: '5px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer' }

export default function KeeperBodyBench() {
  const [action, setAction] = useState<KeeperAction>('walk')
  const [speed, setSpeed] = useState(1)
  const [fps, setFps] = useState(0)
  const [eye, setEye] = useState(false)
  const [bd, setBd] = useState(BACKDROPS[0])
  // keeper's eye: derived from the shipped EYE_STAND, the two keepers stood out at a meeting distance
  const camera = eye
    ? { position: [0, EYE_STAND, 6.5] as [number, number, number], fov: 62 }
    : { position: [0, 1.25, 3.6] as [number, number, number], fov: 42 }
  const spacing = eye ? 1.6 : 1.1

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#14131a' }}>
      <header style={{ padding: '10px 14px', borderBottom: '1px solid #2c2a38' }}>
        <h1 className="gx-title" style={{ margin: 0, fontSize: 15, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#e8e3d8' }}>The Keeper Body Bench</h1>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9a94a8', maxWidth: 780, lineHeight: 1.5 }}>
          One rig, two looks. Rigid parts on joints, posed by code: no skinned mesh either way. Left is the segmented doll,
          right is the same doll with the limb parts hidden (Rayman). Placeholder craft: hooded, no skin.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {KEEPER_ACTIONS.map(a => (
            <button key={a} data-action={a} onClick={() => setAction(a)} style={{ ...chip, opacity: action === a ? 1 : 0.45, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{a}</button>
          ))}
          <button onClick={() => setEye(!eye)} style={{ ...chip, opacity: eye ? 1 : 0.45 }}>{eye ? "Keeper's eye" : 'Turntable'}</button>
          <button onClick={() => setFps(fps ? 0 : 12)} style={{ ...chip, opacity: fps ? 1 : 0.45 }}>{fps ? '12 fps (stop motion)' : 'Smooth'}</button>
          <label style={{ ...chip, cursor: 'default', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="gx-label" style={{ fontSize: 10, letterSpacing: '0.1em' }}>PACE</span>
            <input type="range" min={0} max={1.6} step={0.05} value={speed} onChange={e => setSpeed(Number(e.target.value))} style={{ width: 90 }} />
            <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{speed.toFixed(2)}</span>
          </label>
          {BACKDROPS.map(b => <button key={b.id} onClick={() => setBd(b)} style={{ ...chip, opacity: bd.id === b.id ? 1 : 0.4 }}>{b.label}</button>)}
        </div>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Canvas shadows camera={camera} key={eye ? 'eye' : 'turn'}>
          <color attach="background" args={[bd.sky]} />
          <hemisphereLight args={[bd.sky, bd.ground, 0.85]} />
          <directionalLight position={[3, 6, 4]} intensity={1.15} castShadow shadow-mapSize={[1024, 1024]} />
          <directionalLight position={[-2, 2, 5]} intensity={0.35} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[60, 60]} />
            <meshStandardMaterial color={bd.ground} roughness={1} />
          </mesh>
          {LOOKS.map((l, i) => (
            <group key={l.label} position={[(i - 0.5) * spacing, 0, 0]}>
              <KeeperDoll action={action} limbs={l.limbs} fps={fps} speed={speed} />
            </group>
          ))}
          <OrbitControls target={[0, eye ? 0.9 : 0.95, 0]} maxPolarAngle={Math.PI / 2 - 0.02} />
        </Canvas>
      </div>
      <footer style={{ display: 'flex', borderTop: '1px solid #2c2a38' }}>
        {LOOKS.map(l => (
          <div key={l.label} style={{ flex: 1, padding: '8px 14px', borderRight: '1px solid #2c2a38' }}>
            <div className="gx-label" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8b98a' }}>{l.label}</div>
            <div style={{ fontSize: 11, color: '#8b8598', marginTop: 2 }}>{l.note}</div>
          </div>
        ))}
      </footer>
    </div>
  )
}
