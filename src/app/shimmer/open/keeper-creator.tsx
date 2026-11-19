'use client'
// THE KEEPER CREATOR (BETA M29; the options + the save in shared/keeper-look.ts, the body in shared/keeper-figure.ts). Alex's
// signed-off mock (docs/looks/keeper-creator.html) in the Carved Hearth frame: a turning preview and one row per choice.
// Shown right after the birth rune (birth-gate.tsx) and from the Character tab (Change look). ★ Never a gate a new keeper can
// get stuck in (hub 11-19): RANDOM and LOOKS GOOD are always there, Looks good saves whatever is showing (the default if
// nothing was touched). Phone first: on a narrow screen the preview sits on top and the rows scroll under it.
import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { HearthFrame, HearthButton, H, hearthDisplay } from '../ui/hearth'
import { OPT, ROWS, FRAME_NOTE, setLook, randomLook, type Look, type LookKey } from './shared/keeper-look'
import { getLook, saveLook } from './shared/look-store'
import { KeeperFigure } from './shared/keeper-figure-view'


function Preview({ look }: { look: Look }) {
  return (
    <Canvas data-creator-preview camera={{ position: [0, 1.1, 4.3], fov: 30 }} dpr={[1, 1.75]} style={{ width: '100%', height: '100%' }}
      onCreated={({ camera }) => camera.lookAt(0, 0.88, 0)}>
      <hemisphereLight args={['#fff4e0', '#6a7d6e', 0.75]} />
      <directionalLight position={[2, 3, 2.5]} intensity={1.1} />
      <mesh rotation-x={-Math.PI / 2} position-y={0.001}><circleGeometry args={[0.55, 32]} /><meshBasicMaterial color="#000" transparent opacity={0.12} /></mesh>
      <KeeperFigure look={look} spin={0.45} yaw={-0.4} />
    </Canvas>
  )
}

export function KeeperCreator({ onDone, first = false }: { onDone: () => void; first?: boolean }) {
  const [look, setL] = useState<Look>(() => getLook())
  const pick = (k: LookKey, i: number) => setL(l => setLook(l, k, i))
  const done = () => { saveLook(look); onDone() }
  return (
    <HearthFrame title={first ? 'Who are you?' : 'Your look'} maxWidth={820} onClose={done} dataPanel="keeper-creator" fixed closable={!first}
      footer={
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <HearthButton onClick={() => setL(l => randomLook(l))}><span data-creator-random>Random</span></HearthButton>
          <HearthButton primary onClick={done}><span data-creator-done>Looks good</span></HearthButton>
        </div>
      }>
      <div className="grid gap-3 p-3 sm:grid-cols-[300px_1fr]" style={{ minHeight: 0 }}>
        <div className="rounded-[14px] overflow-hidden h-[220px] sm:h-[420px] sm:sticky sm:top-0" style={{ background: 'radial-gradient(circle at 50% 35%, #fbf4e4, #e8d8b8)', boxShadow: `inset 0 0 0 1px ${H.rule}` }}>
          <Preview look={look} />
        </div>
        <div className="grid gap-3 content-start">
          {ROWS.map(r => (
            <div key={r.key} data-creator-row={r.key}>
              <div className="text-[11px] font-bold uppercase tracking-[.14em] mb-1" style={{ color: H.inkSoft }}>{r.label}</div>
              <div className="flex flex-wrap gap-1.5">
                {OPT[r.key].map((v, i) => r.swatch
                  ? <button key={i} type="button" aria-pressed={look[r.key] === i} data-opt={i} onClick={() => pick(r.key, i)} title={v}
                      className="w-8 h-8 rounded-full transition-transform active:scale-90"
                      style={{ background: v, boxShadow: look[r.key] === i ? `0 0 0 2.5px ${H.paperHi}, 0 0 0 4.5px ${H.ember}` : `inset 0 0 0 1px ${H.rule}` }} />
                  : <button key={i} type="button" aria-pressed={look[r.key] === i} data-opt={i} onClick={() => pick(r.key, i)}
                      className="px-2.5 h-8 rounded-[9px] text-[13px] font-semibold transition-transform active:scale-95"
                      style={{ ...(r.key === 'frame' ? hearthDisplay : {}), color: look[r.key] === i ? '#fff' : H.ink, background: look[r.key] === i ? H.ember : H.paperHi, boxShadow: `inset 0 0 0 1px ${H.rule}` }}>{v}</button>)}
              </div>
              {r.key === 'frame' && <p data-frame-note className="mt-1 text-[12.5px]" style={{ color: H.inkSoft }}>{FRAME_NOTE[look.frame]}</p>}
            </div>
          ))}
        </div>
      </div>
    </HearthFrame>
  )
}
