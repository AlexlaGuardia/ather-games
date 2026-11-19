'use client'
/**
 * THE MOGLIN BENCH — which build, which tone, which garb (Alex 11-18: "lets test some moglin models").
 *
 * Two builds on one rig (open/shared/moglin-model.tsx), side by side with a keeper for height: A PLUSH (the locked ref's
 * proportions, design-briefs/moglins.md + assets/folk-refs/moglin-canon.png) and B CHIBI (a bigger head that reads at
 * Wilds distance). Same action, garb and tone on both. The same line-up stands beside the planning table on the owner's
 * plot. ⚠ PLACEHOLDER CRAFT: the pick is Alex's; nothing here is wired to the game.
 */
import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { MoglinModel, MOGLIN_ACTIONS, MOGLIN_GARBS, FUR_TONES, type MoglinAction, type MoglinGarb } from '../../open/shared/moglin-model'
import { KeeperDoll } from '../../open/shared/keeper-doll'
import { EYE_STAND } from '../../open/shared/locomotion'

const chip: React.CSSProperties = { background: '#211f2b', border: '1px solid #38344a', color: '#ddd6ea', padding: '5px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer' }

/** A KEEPER'S EYE (dev-eye.test): the camera at EYE_STAND, looking level at the line-up from `dist` m back, where a keeper
 *  standing in front of them would see them. The orbit lifts you off the ground; this is the view the scale question needs. */
function EyeCam({ dist }: { dist: number }) {
  const cam = useThree(s => s.camera)
  useEffect(() => { cam.position.set(0, EYE_STAND, dist); cam.lookAt(0, EYE_STAND, 0) }, [cam, dist])
  return null
}

export default function MoglinBench() {
  const [action, setAction] = useState<MoglinAction>('idle')
  const [garb, setGarb] = useState<MoglinGarb>('none')
  const [tone, setTone] = useState(FUR_TONES[0])
  const [keeper, setKeeper] = useState(true), [eye, setEye] = useState(false)
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#14131a' }}>
      <header style={{ padding: '10px 14px', borderBottom: '1px solid #2c2a38' }}>
        <h1 className="gx-title" style={{ margin: 0, fontSize: 15, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#e8e3d8' }}>The Moglin Bench</h1>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9a94a8', maxWidth: 780, lineHeight: 1.5 }}>
          A plush (the locked ref&apos;s proportions) and B chibi (a bigger head for distance), one rig, posed by code. About 3 feet
          tall beside a keeper. Fur tones are the brief&apos;s, never grey; garb is cloth, leather and wood, never metal.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {MOGLIN_ACTIONS.map(a => <button key={a} onClick={() => setAction(a)} style={{ ...chip, opacity: action === a ? 1 : 0.45, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{a}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          {MOGLIN_GARBS.map(g => <button key={g.id} title={g.note} onClick={() => setGarb(g.id)} style={{ ...chip, opacity: garb === g.id ? 1 : 0.45 }}>{g.label}</button>)}
          {FUR_TONES.map(t => <button key={t.id} onClick={() => setTone(t)} style={{ ...chip, opacity: tone.id === t.id ? 1 : 0.45, borderColor: t.fur }}>{t.label}</button>)}
          <button onClick={() => setKeeper(!keeper)} style={{ ...chip, opacity: keeper ? 1 : 0.45 }}>{keeper ? 'Keeper for height' : 'No keeper'}</button>
          <button data-eye onClick={() => setEye(e => !e)} style={{ ...chip, opacity: eye ? 1 : 0.45 }}>{eye ? 'keeper eye' : 'orbit'}</button>
        </div>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Canvas shadows camera={{ position: [0, 0.9, 2.6], fov: 40 }}>
          <color attach="background" args={['#cfe3ef']} />
          <hemisphereLight args={['#cfe3ef', '#7d9455', 0.9]} />
          <directionalLight position={[3, 6, 4]} intensity={1.15} castShadow shadow-mapSize={[1024, 1024]} />
          <directionalLight position={[-2, 2, 5]} intensity={0.35} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[40, 40]} /><meshStandardMaterial color="#7d9455" roughness={1} /></mesh>
          <group position={[-0.55, 0, 0]} rotation={[0, 0.35, 0]}><MoglinModel build="plush" action={action} garb={garb} tone={tone} /></group>
          <group position={[0.55, 0, 0]} rotation={[0, -0.35, 0]}><MoglinModel build="chibi" action={action} garb={garb} tone={tone} seed={1} /></group>
          {keeper && <group position={[1.55, 0, -0.5]} rotation={[0, -0.5, 0]}><KeeperDoll action="idle" limbs fps={0} speed={1} /></group>}
          {eye ? <EyeCam dist={3} /> : <OrbitControls target={[0, 0.5, 0]} maxPolarAngle={Math.PI / 2 - 0.02} />}
        </Canvas>
      </div>
      <footer style={{ display: 'flex', borderTop: '1px solid #2c2a38' }}>
        {[['A · Plush', "the ref's proportions: head near half the height"], ['B · Chibi', 'a bigger head, shorter body: reads at Wilds distance']].map(([a, b]) => (
          <div key={a} style={{ flex: 1, padding: '8px 14px', borderRight: '1px solid #2c2a38' }}>
            <div className="gx-label" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8b98a' }}>{a}</div>
            <div style={{ fontSize: 11, color: '#8b8598', marginTop: 2 }}>{b}</div>
          </div>
        ))}
      </footer>
    </div>
  )
}
