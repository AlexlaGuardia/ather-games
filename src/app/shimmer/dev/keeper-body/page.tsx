'use client'

/**
 * THE KEEPER BODY BENCH (Alex 11-17; proportion sliders BETA M103, Alex 11-23).
 *
 * PROPORTIONS (the default view): the keeper that ships (open/shared/keeper-figure.ts) for each of its 6 models, Frame
 * (Small / Medium / Large) x Torso (Broad / Curved), with a slider per dial (open/shared/keeper-proportions.ts): the SIZE of
 * each part and the SPACING between them. Save writes open/shared/keeper-proportions.json through the owner-gated
 * /shimmer/save-keeper-proportions; the game, the creator and the Character doll all build from that file, LIVE AT THE NEXT
 * DEPLOY (the bench itself reads the file live, so save + reload shows the saved shape at once). Floating limbs stay
 * (Alex 11-23), so "arms" and "legs" are hand / foot size + placement and how high the torso floats.
 *
 * DOLL VS RAYMAN: the 11-17 placeholder comparison, kept behind its tab (doll-vs-rayman.tsx).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { KeeperFigure } from '../../open/shared/keeper-figure-view'
import { buildKeeper } from '../../open/shared/keeper-figure'
import { DEFAULT_LOOK, OPT, type Look } from '../../open/shared/keeper-look'
import { DIALS, DEFAULT_PROPORTIONS, MODELS, MODEL_LABEL, parseFile, type DialKey, type Proportions } from '../../open/shared/keeper-proportions'
import { DollVsRayman } from './doll-vs-rayman'

const chip: React.CSSProperties = { background: '#211f2b', border: '1px solid #38344a', color: '#ddd6ea', padding: '5px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer' }
const BACKDROPS = [
  { id: 'day', label: 'Daylight', sky: '#cfe3ef', ground: '#7d9455' },
  { id: 'void', label: 'Neutral grey', sky: '#8a8a8a', ground: '#6e6e6e' },
]
const fmt = (d: typeof DIALS[number], v: number) => d.kind === 'spacing' && d.key !== 'legs' ? `${v >= 0 ? '+' : ''}${v.toFixed(3)}` : v.toFixed(2)
const same = (a: Proportions, b: Proportions) => DIALS.every(d => a[d.key] === b[d.key])

export default function KeeperBodyBench() {
  const [tab, setTab] = useState<'proportions' | 'doll'>('proportions')
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#14131a' }}>
      <nav style={{ display: 'flex', gap: 8, padding: '8px 14px', borderBottom: '1px solid #2c2a38', alignItems: 'center', flexWrap: 'wrap' }}>
        <h1 className="gx-title" style={{ margin: '0 10px 0 0', fontSize: 14, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#e8e3d8' }}>The Keeper Body Bench</h1>
        <button data-tab="proportions" onClick={() => setTab('proportions')} style={{ ...chip, opacity: tab === 'proportions' ? 1 : 0.45 }}>Proportions</button>
        <button data-tab="doll" onClick={() => setTab('doll')} style={{ ...chip, opacity: tab === 'doll' ? 1 : 0.45 }}>Doll vs Rayman (11-17)</button>
      </nav>
      <div style={{ flex: 1, minHeight: 0 }}>{tab === 'proportions' ? <ProportionsBench /> : <DollVsRayman />}</div>
    </div>
  )
}

function ProportionsBench() {
  const [model, setModel] = useState(MODELS[2])   // medium-broad: the default keeper
  const [savedAll, setSavedAll] = useState<Record<string, Proportions> | null>(null)
  const [edits, setEdits] = useState<Record<string, Proportions>>({})
  const [spin, setSpin] = useState(true)
  const [compare, setCompare] = useState(true)
  const [eyes, setEyes] = useState(2)   // Round: the eye-size dial reads best on whites + pupils
  const [bd, setBd] = useState(BACKDROPS[0])
  const [status, setStatus] = useState('loading the saved file...')

  useEffect(() => {
    fetch('/shimmer/save-keeper-proportions', { cache: 'no-store' }).then(r => r.json())
      .then(j => { setSavedAll(parseFile(j.models)); setStatus('') })
      .catch(e => { setSavedAll(parseFile({})); setStatus(`could not read the file (${e}): showing today's body`) })
  }, [])

  const saved = savedAll?.[model] ?? DEFAULT_PROPORTIONS
  const cur = edits[model] ?? saved
  const dirty = !same(cur, saved)
  const set = useCallback((k: DialKey, v: number) => setEdits(e => ({ ...e, [model]: { ...(e[model] ?? saved), [k]: v } })), [model, saved])
  const [fi, ti] = model.split('-')
  const look: Look = useMemo(() => ({ ...DEFAULT_LOOK, frame: ['small', 'medium', 'large'].indexOf(fi), torso: ['broad', 'curved'].indexOf(ti), eyes }), [fi, ti, eyes])
  const metrics = useMemo(() => { const k = buildKeeper(look, cur); const m = { height: k.height, headY: k.headY }; k.group.clear(); return m }, [look, cur])

  const save = async () => {
    setStatus('saving...')
    try {
      const r = await fetch('/shimmer/save-keeper-proportions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, dials: cur }) })
      const j = await r.json()
      if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`)
      setSavedAll(a => ({ ...(a ?? {}), [model]: j.dials }))
      setEdits(e => { const n = { ...e }; delete n[model]; return n })
      setStatus(`saved ${MODEL_LABEL(model)}. In the game at the next deploy.`)
    } catch (e) { setStatus(`save failed: ${e instanceof Error ? e.message : e}`) }
  }

  const row = (d: typeof DIALS[number]) => (
    <div key={d.key} style={{ display: 'grid', gridTemplateColumns: '108px 1fr 52px 22px', gap: 6, alignItems: 'center', padding: '3px 0' }} title={d.note}>
      <span className="gx-label" style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: cur[d.key] !== d.def ? '#e8d49a' : '#9a94a8' }}>{d.label}</span>
      <input data-dial={d.key} type="range" min={d.min} max={d.max} step={d.step} value={cur[d.key]} onChange={e => set(d.key, Number(e.target.value))} style={{ width: '100%' }} />
      <span data-dial-value={d.key} style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11, color: '#ddd6ea', textAlign: 'right' }}>{fmt(d, cur[d.key])}</span>
      <button data-reset={d.key} onClick={() => set(d.key, d.def)} disabled={cur[d.key] === d.def} title="reset to today's body"
        style={{ ...chip, padding: '1px 4px', opacity: cur[d.key] === d.def ? 0.25 : 1 }}>↺</button>
    </div>
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexWrap: 'wrap', overflow: 'auto' }}>
      <div style={{ flex: '1 1 420px', minHeight: 360, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 12px' }}>
          {MODELS.map(m => (
            <button key={m} data-model={m} onClick={() => setModel(m)} style={{ ...chip, opacity: model === m ? 1 : 0.45 }}>
              {MODEL_LABEL(m)}{edits[m] && savedAll && !same(edits[m], savedAll[m]) ? ' •' : ''}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, minHeight: 300, position: 'relative' }}>
          <Canvas camera={{ position: [0, 1.0, 3.2], fov: 40 }}>
            <color attach="background" args={[bd.sky]} />
            <hemisphereLight args={[bd.sky, bd.ground, 0.9]} />
            <directionalLight position={[3, 6, 4]} intensity={1.2} />
            <directionalLight position={[-2, 2, 5]} intensity={0.35} />
            <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[40, 40]} /><meshStandardMaterial color={bd.ground} roughness={1} /></mesh>
            <group position={[compare ? 0.42 : 0, 0, 0]}><KeeperFigure look={look} shape={cur} spin={spin ? 0.5 : 0} /></group>
            {compare && <group position={[-0.62, 0, 0]}><KeeperFigure look={look} shape={DEFAULT_PROPORTIONS} spin={spin ? 0.5 : 0} /></group>}
            <OrbitControls target={[0, 0.75, 0]} maxPolarAngle={Math.PI / 2 - 0.02} />
          </Canvas>
          {compare && <div style={{ position: 'absolute', left: 12, bottom: 8, fontSize: 10, color: '#2c2a38', background: '#ffffffaa', padding: '2px 6px', borderRadius: 3 }}>left: today · right: your edit</div>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 12px', borderTop: '1px solid #2c2a38' }}>
          <button onClick={() => setSpin(!spin)} style={{ ...chip, opacity: spin ? 1 : 0.45 }}>{spin ? 'Turntable' : 'Still (drag to orbit)'}</button>
          <button data-act="compare" onClick={() => setCompare(!compare)} style={{ ...chip, opacity: compare ? 1 : 0.45 }}>Beside today</button>
          <button onClick={() => setEyes((eyes + 1) % OPT.eyes.length)} style={chip}>Eyes: {OPT.eyes[eyes]}</button>
          {BACKDROPS.map(b => <button key={b.id} onClick={() => setBd(b)} style={{ ...chip, opacity: bd.id === b.id ? 1 : 0.4 }}>{b.label}</button>)}
          <span data-metrics style={{ fontSize: 10, color: '#8b8598', alignSelf: 'center', fontVariantNumeric: 'tabular-nums' }} data-head-y={metrics.headY.toFixed(4)} data-height={metrics.height.toFixed(4)}>
            height {metrics.height.toFixed(2)} m · head at {metrics.headY.toFixed(2)} m
          </span>
        </div>
      </div>
      <aside style={{ flex: '0 1 380px', minWidth: 300, borderLeft: '1px solid #2c2a38', padding: '10px 14px', overflow: 'auto' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
          <span className="gx-title" style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c8b98a' }}>{MODEL_LABEL(model)}</span>
          <span style={{ flex: 1 }} />
          <button data-act="reset-model" onClick={() => setEdits(e => ({ ...e, [model]: { ...DEFAULT_PROPORTIONS } }))} style={chip} title="every dial back to today's body (save to keep it)">Reset all</button>
          <button data-act="save" onClick={save} disabled={!dirty || !savedAll} style={{ ...chip, background: dirty ? '#3c5a3a' : '#211f2b', opacity: dirty ? 1 : 0.4 }}>Save</button>
        </div>
        <div data-status style={{ fontSize: 11, color: status.startsWith('save failed') || status.startsWith('could not') ? '#e88' : '#9ac49a', minHeight: 16 }}>{status || (dirty ? 'unsaved changes' : '')}</div>
        <h2 className="gx-label" style={{ fontSize: 10, letterSpacing: '0.14em', color: '#7f7a8c', margin: '10px 0 2px' }}>SIZE</h2>
        {DIALS.filter(d => d.kind === 'size').map(row)}
        <h2 className="gx-label" style={{ fontSize: 10, letterSpacing: '0.14em', color: '#7f7a8c', margin: '12px 0 2px' }}>SPACING</h2>
        {DIALS.filter(d => d.kind === 'spacing').map(row)}
        <p style={{ fontSize: 10, color: '#6f6a7c', lineHeight: 1.5, marginTop: 12 }}>
          Floating limbs: no neck or limb segments, so arms = hand size + where the hands float, legs = foot size + how high the
          torso floats above them. A save is in the game at the next deploy.
        </p>
      </aside>
    </div>
  )
}
