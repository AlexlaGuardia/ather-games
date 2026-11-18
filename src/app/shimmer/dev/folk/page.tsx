'use client'
/**
 * THE FOLK BENCH: the human NPC rig (open/shared/folk-model.tsx), Alex 11-18 "we should start working on the npcs models".
 * Gregory (his old blockout's colours carried onto the rig) and four unnamed folk whose looks are drawn from their ids,
 * beside a keeper for height and a Moglin for scale. ⚠ PLACEHOLDER CRAFT: no canon look exists for any human NPC yet.
 */
import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { FolkModel, folkLook, type FolkAction } from '../../open/shared/folk-model'
import { MoglinModel } from '../../open/shared/moglin-model'
import { KeeperDoll } from '../../open/shared/keeper-doll'

const chip: React.CSSProperties = { background: '#211f2b', border: '1px solid #38344a', color: '#ddd6ea', padding: '5px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer' }
const IDS = ['gregory', 'co-clerk-rune-hold', 'runesmith-rune-hold', 'smithy-citadel', 'cafe-veradyn']
const ACTIONS: FolkAction[] = ['idle', 'talk', 'wave']

export default function FolkBench() {
  const [action, setAction] = useState<FolkAction>('idle')
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#14131a' }}>
      <header style={{ padding: '10px 14px', borderBottom: '1px solid #2c2a38' }}>
        <h1 className="gx-title" style={{ margin: 0, fontSize: 15, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#e8e3d8' }}>The Folk Bench</h1>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9a94a8', maxWidth: 780, lineHeight: 1.5 }}>
          One human rig, posed by code. Gregory first, then four shop folk whose colours come from their ids (fixed for life,
          the same on every device). Alex's pick 11-18: the CARTOON look (docs/looks/alkin-looks.html). Colours are placeholders until Magii rules briefs.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {ACTIONS.map(a => <button key={a} data-action={a} onClick={() => setAction(a)} style={{ ...chip, opacity: action === a ? 1 : 0.45, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{a}</button>)}
        </div>
      </header>
      <div style={{ flex: 1, minHeight: 0 }} data-bench="folk">
        <Canvas shadows camera={{ position: [0, 1.4, 5.2], fov: 40 }}>
          <color attach="background" args={['#cfe3ef']} />
          <hemisphereLight args={['#cfe3ef', '#7d9455', 0.9]} />
          <directionalLight position={[3, 6, 4]} intensity={1.15} castShadow shadow-mapSize={[1024, 1024]} />
          <directionalLight position={[-2, 2, 5]} intensity={0.35} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[40, 40]} /><meshStandardMaterial color="#7d9455" roughness={1} /></mesh>
          {IDS.map((id, i) => (
            <group key={id} position={[(i - 2) * 1.05, 0, i === 0 ? 0.3 : 0]} rotation={[0, (2 - i) * 0.12, 0]}>
              <FolkModel look={folkLook(id)} action={action} seed={i} />
            </group>
          ))}
          <group position={[-3.1, 0, -0.4]} rotation={[0, 0.5, 0]}><KeeperDoll action="idle" limbs fps={0} speed={1} /></group>
          <group position={[3.0, 0, -0.2]} rotation={[0, -0.4, 0]}><MoglinModel action="idle" /></group>
          <OrbitControls target={[0, 0.9, 0]} maxPolarAngle={Math.PI / 2 - 0.02} />
        </Canvas>
      </div>
    </div>
  )
}
