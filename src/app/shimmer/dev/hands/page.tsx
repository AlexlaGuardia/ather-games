'use client'

/**
 * THE HANDS TUNER — place the open world's first-person hands in each key pose (Alex 11-17: "in the dev tools can you
 * make me a tool to control the position of the hands in a few key positions").
 *
 * The scene is the game's own lens: fov 75 at the keeper's eye (EYE_STAND), the same two gloves the open world draws
 * (open/shared/open-hands.tsx), posed by the same function (open/shared/fp-hands-pose.ts) from a synthetic input per
 * preview. Every slider writes the LIVE tune (FP) and saves it to this browser (`open:hands-tune.v1`, a device key), so
 * the open world on this browser uses it at once. "Copy values" puts the numbers on the clipboard: paste them to Jin and
 * they become the shipped defaults (FP_DEFAULTS) for everyone.
 *
 * ⚠ The HUD is not drawn here. The marks at the bottom right show roughly where the mana orb and the Q/X chips sit at
 * 1100×700, so a glove can be kept clear of them.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { OpenHands, ORDER, type OpenHandsApi } from '../../open/shared/open-hands'
import { ACTIONS, ACTION_IDS, EASES, POSE_FIELDS, loadActions, setAction, resetAction, exportAction, sampleAction, actionDuration, keyStart, type ActionKey, type Ease, type HandAction } from '../../open/shared/fp-actions'
import { FP, FP_DEFAULTS, setFpTune, resetFpTune, loadFpTune, type FpTune, type FpInput } from '../../open/shared/fp-hands-pose'
import { EYE_STAND } from '../../open/shared/locomotion'
import { HeldItem } from '../../open/ather/held-item'

type Preview = 'rest' | 'run' | 'jump' | 'cast' | 'hold' | 'hidden' | 'actions'
const PREVIEWS: { id: Preview; label: string }[] = [
  { id: 'rest', label: 'Rest' }, { id: 'run', label: 'Run' }, { id: 'jump', label: 'Jump' }, { id: 'cast', label: 'Cast' }, { id: 'hold', label: 'Hold' }, { id: 'hidden', label: 'Hidden' }, { id: 'actions', label: 'Actions' },
]
type Knob = { k: keyof FpTune; label: string; min: number; max: number; step: number }
const GROUPS: { title: string; note: string; show: Preview; knobs: Knob[] }[] = [
  { title: 'Rest', note: 'both hands, mirrored', show: 'rest', knobs: [
    { k: 'X', label: 'apart', min: 0.05, max: 0.5, step: 0.005 },
    { k: 'REST_Y', label: 'height', min: -0.6, max: -0.1, step: 0.005 },
    { k: 'Z', label: 'distance', min: -0.9, max: -0.3, step: 0.005 },
    { k: 'PITCH', label: 'tilt', min: -3.1, max: 3.1, step: 0.01 },
    { k: 'ROLL', label: 'roll (cuffs out)', min: -3.1, max: 3.1, step: 0.01 },
    { k: 'SCALE', label: 'size', min: 0.5, max: 2, step: 0.01 },
  ] },
  { title: 'Run', note: 'they take turns dropping out of view', show: 'run', knobs: [
    { k: 'DROP_Y', label: 'drop', min: 0, max: 0.8, step: 0.005 },
    { k: 'SWING_Z', label: 'forward', min: 0, max: 0.15, step: 0.005 },
    { k: 'STRIDE_M', label: 'stride (m)', min: 1, max: 10, step: 0.05 },
  ] },
  { title: 'Jump', note: 'both up, the right higher', show: 'jump', knobs: [
    { k: 'JUMP_Y_R', label: 'right up', min: 0, max: 0.4, step: 0.005 },
    { k: 'JUMP_Y_L', label: 'left up', min: 0, max: 0.4, step: 0.005 },
    { k: 'JUMP_SPREAD', label: 'spread', min: -0.1, max: 0.2, step: 0.005 },
    { k: 'JUMP_PITCH', label: 'tilt', min: -1, max: 1.5, step: 0.01 },
  ] },
  { title: 'Cast', note: 'the glove raised to aim', show: 'cast', knobs: [
    { k: 'CAST_X', label: 'x', min: -0.2, max: 0.5, step: 0.005 },
    { k: 'CAST_Y', label: 'height', min: -0.5, max: 0, step: 0.005 },
    { k: 'CAST_PITCH', label: 'tilt', min: -1, max: 1.5, step: 0.01 },
  ] },
  { title: 'Hold', note: 'the right mitt turned to present a hotbar item', show: 'hold', knobs: [
    { k: 'HOLD_X', label: 'x', min: -0.2, max: 0.5, step: 0.005 },
    { k: 'HOLD_Y', label: 'height', min: -0.6, max: 0, step: 0.005 },
    { k: 'HOLD_Z', label: 'distance', min: -0.9, max: -0.3, step: 0.005 },
    { k: 'HOLD_PITCH', label: 'tilt', min: -Math.PI, max: Math.PI, step: 0.01 },
    { k: 'HOLD_ROLL', label: 'roll (turn)', min: -Math.PI, max: Math.PI, step: 0.01 },
    { k: 'HOLD_YAW', label: 'twist', min: -Math.PI, max: Math.PI, step: 0.01 },
  ] },
  { title: 'Held item', note: 'floating over the mitt', show: 'hold', knobs: [
    { k: 'ITEM_UP', label: 'float up', min: -0.1, max: 0.6, step: 0.005 },
    { k: 'ITEM_FWD', label: 'toward eye', min: -0.15, max: 0.15, step: 0.005 },
    { k: 'ITEM_SIZE', label: 'size', min: 0.3, max: 3, step: 0.01 },
    { k: 'ITEM_TILT', label: 'tip to eye', min: -1, max: 1.5, step: 0.01 },
    { k: 'ITEM_SPIN', label: 'spin (rad/s)', min: 0, max: 4, step: 0.05 },
    { k: 'ITEM_BOB', label: 'bob', min: 0, max: 0.03, step: 0.001 },
  ] },
]
/** Things to hold in the Hold preview: a piece, a Keepstone, a potion, a dish. */
const SAMPLES: { id: string; label: string }[] = [
  { id: 'goldwood_stool', label: 'Stool' }, { id: 'iron_lantern', label: 'Lantern' }, { id: 'keepstone_violet', label: 'Keepstone' }, { id: 'starlight_tincture', label: 'Tincture' },
]
const chip: React.CSSProperties = { background: '#211f2b', border: '1px solid #38344a', color: '#ddd6ea', padding: '5px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer' }

/** M82: the action clock the Driver runs and the scrub bar reads (a ref, not state: it ticks every frame) */
interface Clock { id: string; t: number; playing: boolean; scrub: HTMLInputElement | null; readout: HTMLSpanElement | null }

/** Feeds the hands a synthetic input for the preview, every frame. Cast holds mid-raise; Run runs at full speed. Actions plays
 *  the picked action as a loop (the right mitt only, like the game will). */
function Driver({ api, preview, paused, holdW, clock }: { api: React.RefObject<OpenHandsApi | null>; preview: Preview; paused: boolean; holdW: number | null; clock: React.RefObject<Clock> }) {
  useFrame((_, dt) => {
    const now = performance.now(), c = clock.current
    let actionR: FpInput['actionR']
    if (preview === 'actions') {
      const a = ACTIONS[c.id], dur = actionDuration(a)
      if (c.playing && dur > 0) c.t = (c.t + dt * 1000) % dur
      actionR = { ...sampleAction(a, c.t), w: 1 }
      if (c.scrub) { c.scrub.max = String(dur); c.scrub.value = String(c.t) }
      if (c.readout) c.readout.textContent = `${Math.round(c.t)} / ${Math.round(dur)} ms`
    }
    const input: FpInput = {
      now, speed: preview === 'run' ? FP.RUN_SPEED : 0, airborne: preview === 'jump', hidden: preview === 'hidden',
      castAt: preview === 'cast' ? now - FP.CAST_MS * 0.4 : -Infinity, working: false, holding: preview === 'hold', ...(preview === 'hold' && holdW !== null ? { holdW } : {}),
      ...(actionR ? { actionR } : {}),
    }
    // a paused or scrubbed action still has to LAND on the frame asked for: the mitt eases there at full step
    api.current?.step(input, preview === 'actions' && !c.playing ? 0.1 : paused ? 0 : dt)
    api.current?.seat(preview === 'cast' ? 1 : 0)
  })
  return null
}

export default function HandsTuner() {
  const api = useRef<OpenHandsApi>(null)
  const [preview, setPreview] = useState<Preview>('rest')
  useEffect(() => { if (new URLSearchParams(window.location.search).get('preview') === 'hold') setPreview('hold') }, [])   // ?preview=hold (11-21 strip)
  const [paused, setPaused] = useState(false)
  const [, bump] = useState(0)
  const [copied, setCopied] = useState(false)
  const [sample, setSample] = useState(SAMPLES[0].id)
  // the Hold blend scrub (11-21): null = the mitt turns on its own; 0..1 pins the rest->hold turn there (?hold=0.5 seeds it)
  const [holdW, setHoldW] = useState<number | null>(null)
  useEffect(() => { const v = new URLSearchParams(window.location.search).get('hold'); if (v !== null && Number.isFinite(+v)) setHoldW(Math.max(0, Math.min(1, +v))) }, [])
  useEffect(() => { loadFpTune(); loadActions(); bump(n => n + 1) }, [])
  const clock = useRef<Clock>({ id: ACTION_IDS[0], t: 0, playing: true, scrub: null, readout: null })
  useEffect(() => { if (new URLSearchParams(window.location.search).get('preview') === 'actions') setPreview('actions') }, [])   // ?preview=actions
  const values = () => JSON.stringify(Object.fromEntries(Object.keys(FP_DEFAULTS).map(k => [k, FP[k as keyof FpTune]])))

  return (
    <div style={{ height: '100dvh', display: 'flex', background: '#14131a' }}>
      <aside style={{ width: 300, overflowY: 'auto', padding: '10px 12px', borderRight: '1px solid #2c2a38', color: '#ddd6ea' }}>
        <h1 className="gx-title" style={{ margin: 0, fontSize: 14, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#e8e3d8' }}>The Hands Tuner</h1>
        <p style={{ margin: '4px 0 10px', fontSize: 11, color: '#9a94a8', lineHeight: 1.5 }}>
          The game&apos;s lens and gloves. Sliders save to this browser and the open world uses them at once. Copy values and paste them to Jin to make them the default.
        </p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {PREVIEWS.map(p => <button key={p.id} data-preview={p.id} onClick={() => setPreview(p.id)} style={{ ...chip, opacity: preview === p.id ? 1 : 0.45 }}>{p.label}</button>)}
          <button onClick={() => setPaused(!paused)} style={{ ...chip, opacity: paused ? 1 : 0.45 }}>{paused ? 'Paused' : 'Pause'}</button>
        </div>
        {preview === 'hold' && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {SAMPLES.map(x => <button key={x.id} data-sample={x.id} onClick={() => setSample(x.id)} style={{ ...chip, opacity: sample === x.id ? 1 : 0.45 }}>{x.label}</button>)}
        </div>}
        {preview === 'hold' && <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'grid', gridTemplateColumns: '92px 1fr 46px', gap: 6, alignItems: 'center', fontSize: 11 }}>
            <span style={{ color: '#b5afc2' }}>hold blend</span>
            <input type="range" data-knob="hold-blend" min={0} max={1} step={0.01} value={holdW ?? 1} onChange={e => setHoldW(Number(e.target.value))} />
            <span style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right', color: holdW === null ? '#8b8598' : '#e8b04a' }}>{holdW === null ? 'free' : holdW.toFixed(2)}</span>
          </label>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <button style={{ ...chip, opacity: holdW === null ? 1 : 0.45 }} data-act="hold-free" onClick={() => setHoldW(null)}>Free turn</button>
            <button style={chip} data-act="hold-reset-rot" title="tilt / roll / twist back to the rest pose's, so the turn starts from a natural base"
              onClick={() => { setFpTune({ HOLD_PITCH: FP.PITCH, HOLD_ROLL: FP.ROLL, HOLD_YAW: 0 }); bump(n => n + 1) }}>Reset hold rotation</button>
          </div>
        </div>}
        {GROUPS.map(g => (
          <section key={g.title} style={{ marginBottom: 12 }}>
            <button onClick={() => setPreview(g.show)} style={{ all: 'unset', cursor: 'pointer', display: 'block' }}>
              <span className="gx-label" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: preview === g.show ? '#e8b04a' : '#c8b98a' }}>{g.title}</span>
              <span style={{ fontSize: 10, color: '#8b8598', marginLeft: 6 }}>{g.note}</span>
            </button>
            {g.knobs.map(n => (
              <label key={n.k} style={{ display: 'grid', gridTemplateColumns: '92px 1fr 46px', gap: 6, alignItems: 'center', fontSize: 11, marginTop: 4 }}>
                <span style={{ color: '#b5afc2' }}>{n.label}</span>
                <input type="range" data-knob={n.k} min={n.min} max={n.max} step={n.step} value={FP[n.k]}
                  onChange={e => { setFpTune({ [n.k]: Number(e.target.value) }); setPreview(g.show); bump(x => x + 1) }} />
                <span style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right', color: FP[n.k] === FP_DEFAULTS[n.k] ? '#8b8598' : '#e8b04a' }}>{FP[n.k].toFixed(3)}</span>
              </label>
            ))}
          </section>
        ))}
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button style={chip} onClick={() => { void navigator.clipboard?.writeText(values()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }}>{copied ? 'Copied' : 'Copy values'}</button>
          <button style={chip} onClick={() => { resetFpTune(); bump(n => n + 1) }}>Reset to defaults</button>
        </div>
        <pre data-values style={{ marginTop: 8, fontSize: 9, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#8b8598' }}>{values()}</pre>
      </aside>
      {preview === 'actions' && <ActionsPanel clock={clock} />}
      <div style={{ flex: 1, position: 'relative' }}>
        <Canvas camera={{ position: [0, EYE_STAND, 0], fov: 75, near: 0.05, far: 500 }} onCreated={({ camera }) => camera.lookAt(0, EYE_STAND, -10)}>
          <color attach="background" args={['#cfe3ef']} />
          <hemisphereLight args={['#cfe3ef', '#7d9455', 0.9]} />
          <directionalLight position={[3, 6, 4]} intensity={1.1} />
          <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[400, 400]} /><meshStandardMaterial color="#86a35a" roughness={1} /></mesh>
          {[-6, -3, 3, 6].map(x => <mesh key={x} position={[x, 0.75, -12]}><boxGeometry args={[0.3, 1.5, 0.3]} /><meshStandardMaterial color="#8a6a3c" /></mesh>)}
          <OpenHands ref={api} held={preview === 'actions' ? <ActionProp clock={clock} /> : <HeldItem id={preview === 'hold' ? sample : null} />} />
          <Driver api={api} preview={preview} paused={paused} holdW={holdW} clock={clock} />
        </Canvas>
        {/* where the HUD's mana orb + Q/X chips sit at 1100x700 (bottom right), so a glove can stay clear of them */}
        <div style={{ position: 'absolute', right: 56, bottom: 24, width: 136, height: 136, borderRadius: '50%', border: '1px dashed rgba(60,40,90,0.6)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 262, bottom: 22, width: 240, height: 34, border: '1px dashed rgba(60,40,90,0.6)', borderRadius: 6, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 4, height: 4, margin: -2, borderRadius: 2, background: 'rgba(255,255,255,0.85)', boxShadow: '0 0 0 1px rgba(0,0,0,0.35)', pointerEvents: 'none' }} />
      </div>
    </div>
  )
}

/** M82: the rinstick in the mitt while its action plays (hand-local: the hand's +y points ahead at rest; the rig scales x2) */
function ActionProp({ clock }: { clock: React.RefObject<Clock> }) {
  const [item, setItem] = useState(ACTIONS[clock.current.id].item)
  useFrame(() => { const it = ACTIONS[clock.current.id].item; if (it !== item) setItem(it) })
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#9a8160', roughness: 0.8, transparent: true, opacity: 1 }), [])
  if (item !== 'rinstick') return null
  return <mesh material={mat} position={[0.01, 0.22, 0.02]} rotation={[0.12, 0, 0]} renderOrder={ORDER} frustumCulled={false}><cylinderGeometry args={[0.0035, 0.007, 0.46, 6]} /></mesh>
}

const KEY_KNOBS: { k: (typeof POSE_FIELDS)[number] | 'ms' | 'hold'; label: string; min: number; max: number; step: number }[] = [
  { k: 'x', label: 'x', min: -0.3, max: 0.6, step: 0.005 },
  { k: 'y', label: 'height', min: -0.7, max: 0.1, step: 0.005 },
  { k: 'z', label: 'distance', min: -1, max: -0.2, step: 0.005 },
  { k: 'pitch', label: 'tilt', min: -Math.PI, max: Math.PI, step: 0.01 },
  { k: 'roll', label: 'roll', min: -Math.PI, max: Math.PI, step: 0.01 },
  { k: 'yaw', label: 'twist', min: -Math.PI, max: Math.PI, step: 0.01 },
  { k: 'ms', label: 'move (ms)', min: 0, max: 1500, step: 10 },
  { k: 'hold', label: 'hold (ms)', min: 0, max: 1500, step: 10 },
]

/** M82: build an action as a loop of key poses: pick one, add / reorder / delete keys, play, step, scrub, export. Every edit
 *  saves the draft to this browser (fp-actions ACTIONS_KEY), so a reload keeps it. */
function ActionsPanel({ clock }: { clock: React.RefObject<Clock> }) {
  const [id, setId] = useState(clock.current.id)
  const [sel, setSel] = useState(0)
  const [playing, setPlaying] = useState(clock.current.playing)
  const [copied, setCopied] = useState(false)
  const [, bump] = useState(0)
  const a = ACTIONS[id], k = a.keys[Math.min(sel, a.keys.length - 1)]
  const play = (on: boolean) => { clock.current.playing = on; setPlaying(on) }
  /** stop on key i, just as it is reached (so the mitt shows that pose) */
  const showKey = (i: number, act: HandAction = ACTIONS[id]) => { setSel(i); play(false); clock.current.t = keyStart(act, i) + act.keys[i].ms }
  const save = (next: HandAction, focus = sel) => { setAction(next); bump(n => n + 1); showKey(Math.max(0, Math.min(focus, next.keys.length - 1)), ACTIONS[id]) }
  const editKey = (patch: Partial<ActionKey>) => save({ ...a, keys: a.keys.map((x, i) => i === sel ? { ...x, ...patch } : x) })
  const move = (d: -1 | 1) => { const j = sel + d; if (j < 0 || j >= a.keys.length) return; const ks = [...a.keys]; [ks[sel], ks[j]] = [ks[j], ks[sel]]; save({ ...a, keys: ks }, j) }
  const add = () => { const ks = [...a.keys]; ks.splice(sel + 1, 0, { ...k }); save({ ...a, keys: ks }, sel + 1) }
  const del = () => { if (a.keys.length <= 1) return; save({ ...a, keys: a.keys.filter((_, i) => i !== sel) }, sel - 1) }
  const pick = (next: string) => { clock.current.id = next; clock.current.t = 0; setId(next); setSel(0); play(true) }

  return (
    <aside data-actions style={{ width: 300, overflowY: 'auto', padding: '10px 12px', borderRight: '1px solid #2c2a38', color: '#ddd6ea' }}>
      <span className="gx-label" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#e8b04a' }}>Actions</span>
      <span style={{ fontSize: 10, color: '#8b8598', marginLeft: 6 }}>the right mitt, a loop of poses</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
        {ACTION_IDS.map(x => <button key={x} data-action={x} onClick={() => pick(x)} style={{ ...chip, opacity: id === x ? 1 : 0.45 }}>{ACTIONS[x].label}</button>)}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
        <button data-act="play" style={{ ...chip, opacity: playing ? 1 : 0.6 }} onClick={() => play(!playing)}>{playing ? 'Pause' : 'Play'}</button>
        <button data-act="step" style={chip} title="to the next key" onClick={() => showKey((sel + 1) % a.keys.length)}>Step</button>
        <span ref={el => { clock.current.readout = el }} data-readout style={{ fontSize: 10, color: '#8b8598', fontVariantNumeric: 'tabular-nums' }} />
      </div>
      <input ref={el => { clock.current.scrub = el }} data-knob="scrub" type="range" min={0} step={1} defaultValue={0} style={{ width: '100%' }}
        onChange={e => { play(false); clock.current.t = Number(e.target.value) }} />
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', margin: '8px 0' }}>
        {a.keys.map((_, i) => <button key={i} data-key={i} onClick={() => showKey(i)} style={{ ...chip, padding: '4px 8px', opacity: i === sel ? 1 : 0.45 }}>{i + 1}</button>)}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        <button data-act="add" style={chip} title="copy this key in after it" onClick={add}>+ Key</button>
        <button data-act="up" style={chip} onClick={() => move(-1)}>◀</button>
        <button data-act="down" style={chip} onClick={() => move(1)}>▶</button>
        <button data-act="del" style={{ ...chip, opacity: a.keys.length > 1 ? 1 : 0.35 }} onClick={del}>Delete</button>
      </div>
      <span className="gx-label" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8b98a' }}>Key {Math.min(sel, a.keys.length - 1) + 1}</span>
      {KEY_KNOBS.map(n => (
        <label key={n.k} style={{ display: 'grid', gridTemplateColumns: '72px 1fr 46px', gap: 6, alignItems: 'center', fontSize: 11, marginTop: 4 }}>
          <span style={{ color: '#b5afc2' }}>{n.label}</span>
          <input type="range" data-keyknob={n.k} min={n.min} max={n.max} step={n.step} value={k[n.k]} onChange={e => editKey({ [n.k]: Number(e.target.value) })} />
          <span style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{n.k === 'ms' || n.k === 'hold' ? k[n.k] : k[n.k].toFixed(3)}</span>
        </label>
      ))}
      <label style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 6, alignItems: 'center', fontSize: 11, marginTop: 6 }}>
        <span style={{ color: '#b5afc2' }}>ease in</span>
        <select data-keyknob="ease" value={k.ease} onChange={e => editKey({ ease: e.target.value as Ease })} style={{ background: '#211f2b', color: '#ddd6ea', border: '1px solid #38344a', fontSize: 11 }}>
          {EASES.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
      </label>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button style={chip} data-act="export" onClick={() => { void navigator.clipboard?.writeText(exportAction(a)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }}>{copied ? 'Copied' : 'Copy action'}</button>
        <button style={chip} data-act="reset" onClick={() => { resetAction(id); bump(n => n + 1); showKey(0, ACTIONS[id]) }}>Reset action</button>
      </div>
      <pre data-export style={{ marginTop: 8, fontSize: 9, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#8b8598' }}>{exportAction(a)}</pre>
    </aside>
  )
}
