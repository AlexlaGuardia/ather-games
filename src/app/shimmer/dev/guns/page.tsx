'use client'

/**
 * THE GUN TUNER — place the held gun and the gloves on it (Alex 11-18: "a similar dev tool for the guns like we made for the
 * hands so I can tweak it later").
 *
 * The game's lens (fov 75 at EYE_STAND) and the game's own rig (open/shared/fp-gun.tsx), stepped from a synthetic input per
 * preview: Hip, Aim (held in the sights), Run (the bob), Fire (a round every 0.6 s, the kick). Every slider writes the LIVE
 * tune (VM) and saves it to this browser (`open:gun-tune.v1`, a device key), so the open world on this browser uses it at
 * once. "Copy values" puts the numbers on the clipboard: paste them to Jin and they become GUN_DEFAULTS for everyone.
 *
 * ⚠ The zoom of aiming (adsFov) is the page's, not the rig's, so Aim here shows the gun's placement at the base fov. A scoped gun at
 * full aim gives way to the scope ring, drawn here as in the game.
 */

import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { FpGun, ScopeRing, VM, GUN_DEFAULTS, setGunTune, resetGunTune, loadGunTune, selectGunTune, defaultsFor, dialedGun, rhythmDefaultsFor, previewGunModel, todayModelOf, setRhythm, noteCycle, type FpGunApi, type GunTune } from '../../open/shared/fp-gun'
import { RANGE_GUNS, RHYTHM_DIALS, burstCycle, holdGun, stepGun, type GunState, type RangeGun } from '../../open/shared/gunplay'
import { playShot } from '../../open/shared/gun-sound'
import { OPTICS, viewFov, opticOf } from '../../open/shared/optics'
import { EYE_STAND } from '../../open/shared/locomotion'
import { V2_GUNS, V2_SIGHTS, type V2GunId, type V2SightId } from '../../open/shared/gun-kit-v2'
import { SoundBench } from './sound-bench'
import { BUILD_DIALS, BUILD_ZERO, builtModel, hasSocket, loadBuilds, saveBuild, type GunBuild, type BuildKey } from '../../open/shared/gun-build'
import { CompareStrip } from './compare'

type Preview = 'hip' | 'aim' | 'run' | 'fire'
const PREVIEWS: { id: Preview; label: string }[] = [{ id: 'hip', label: 'Hip' }, { id: 'aim', label: 'Aim' }, { id: 'run', label: 'Run' }, { id: 'fire', label: 'Fire' }]
type Knob = { k: keyof GunTune; label: string; min: number; max: number; step: number }
const GROUPS: { title: string; note: string; show: Preview; knobs: Knob[] }[] = [
  { title: 'Hip', note: 'where the gun rests', show: 'hip', knobs: [
    { k: 'HIP_X', label: 'right', min: -0.1, max: 0.45, step: 0.005 },
    { k: 'HIP_Y', label: 'height', min: -0.5, max: 0, step: 0.005 },
    { k: 'HIP_Z', label: 'distance', min: -0.9, max: -0.2, step: 0.005 },
    { k: 'S', label: 'gun size', min: 0.3, max: 1.2, step: 0.01 },
  ] },
  { title: 'Aim', note: 'in the sights', show: 'aim', knobs: [
    { k: 'ADS_DIST', label: 'sight distance', min: 0.15, max: 0.7, step: 0.005 },
    { k: 'ADS_IN', label: 'raise (s)', min: 0.03, max: 0.5, step: 0.005 },
    { k: 'ADS_OUT', label: 'drop (s)', min: 0.03, max: 0.5, step: 0.005 },
  ] },
  { title: 'Run', note: 'the bob', show: 'run', knobs: [
    { k: 'BOB', label: 'bob', min: 0, max: 0.05, step: 0.001 },
    { k: 'BOB_ADS', label: 'bob in sights', min: 0, max: 1, step: 0.01 },
  ] },
  { title: 'Fire', note: 'the kick', show: 'fire', knobs: [
    { k: 'KICK_Z', label: 'kick back', min: 0, max: 0.2, step: 0.002 },
    { k: 'KICK_PITCH', label: 'kick up', min: 0, max: 0.5, step: 0.005 },
    { k: 'KICK_DECAY', label: 'settle speed', min: 2, max: 40, step: 0.5 },
  ] },
  { title: 'Right glove', note: 'on the grip', show: 'hip', knobs: [
    { k: 'HAND', label: 'glove size', min: 0.3, max: 1.4, step: 0.01 },
    { k: 'R_DX', label: 'x', min: -0.08, max: 0.08, step: 0.002 },
    { k: 'R_DY', label: 'y', min: -0.08, max: 0.08, step: 0.002 },
    { k: 'R_DZ', label: 'z', min: -0.08, max: 0.08, step: 0.002 },
    { k: 'R_PITCH', label: 'tilt', min: -3.1, max: 3.1, step: 0.01 },
    { k: 'R_ROLL', label: 'roll', min: -3.1, max: 3.1, step: 0.01 },
  ] },
  { title: 'Left glove', note: 'under the foregrip', show: 'hip', knobs: [
    { k: 'L_DX', label: 'x', min: -0.08, max: 0.08, step: 0.002 },
    { k: 'L_DY', label: 'y', min: -0.08, max: 0.08, step: 0.002 },
    { k: 'L_DZ', label: 'z', min: -0.12, max: 0.12, step: 0.002 },
    { k: 'L_PITCH', label: 'tilt', min: -3.1, max: 3.1, step: 0.01 },
    { k: 'L_ROLL', label: 'roll', min: -3.1, max: 3.1, step: 0.01 },
  ] },
]
const chip: React.CSSProperties = { background: '#211f2b', border: '1px solid #38344a', color: '#ddd6ea', padding: '5px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer' }

/** Feeds the rig a synthetic input for the preview, every frame. Fire shoots a round every 0.6 s. */
let shots = 0   // M197: rounds the Fire preview has let go (the fire-rate check reads __gunTuner)
function Driver({ api, gun, preview, paused }: { api: React.RefObject<FpGunApi | null>; gun: RangeGun; preview: Preview; paused: boolean }) {
  const fired = useRef(-Infinity), held = useRef<GunState | null>(null)
  useFrame((_, dt) => {
    const now = performance.now()
    if (preview === 'fire' && !paused) {
      // M148: a burst gun fires as it does in hand, trigger held: its own rhythm, its sound (a spent clip refills at once)
      // M197: every gun now, on its dialled fire rate (single guns re-fire at their fire interval, held)
      const g = held.current && held.current.gun.id === gun.id ? held.current : (held.current = holdGun(gun))
      g.gun = gun; if (g.ammo <= 0 || g.reloading > 0) { g.ammo = gun.clip; g.reloading = 0 }
      const n = stepGun(g, Math.min(dt, 0.05), true, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, Math.random, []).length
      if (n) { fired.current = now; if (gun.burst > 1) noteCycle(gun.fireCd); playShot(gun.id); shots += n }
      ;(window as unknown as { __gunTuner?: unknown }).__gunTuner = { id: gun.id, fireCd: gun.fireCd, burstGap: gun.burstGap, shots }
    }
    api.current?.step({ gun, aiming: preview === 'aim', speed: preview === 'run' ? 6.5 : 0, firedAt: fired.current, reloading: false, now }, paused ? 0 : dt)
  })
  return null
}

/** the new sights' small punch-in (a prism's zoom is in its lens, not the view); today's models keep the bare lens as before */
function Fov({ fov }: { fov: number }) {
  useFrame(({ camera }) => { const c = camera as import('three').PerspectiveCamera; if (Math.abs(c.fov - fov) > 0.01) { c.fov = fov; c.updateProjectionMatrix() } }, -1)
  return null
}

export default function GunTuner() {
  const api = useRef<FpGunApi>(null)
  const [gunId, setGunId] = useState(RANGE_GUNS[0].id)
  const [preview, setPreview] = useState<Preview>('hip')
  const [paused, setPaused] = useState(false)
  const [, bump] = useState(0)
  const [copied, setCopied] = useState(false)
  // M149: the new family beside today's, this page only (the game never reads it). Off unless picked here or by ?set=new
  const [fresh, setFresh] = useState(false), [pick, setPick] = useState<V2SightId | null>(null)
  useEffect(() => {   // ?gun= &preview= &set=new &sight= (the look-sheet shots)
    const q = new URLSearchParams(window.location.search)
    if (RANGE_GUNS.some(g => g.id === q.get('gun'))) setGunId(q.get('gun')!)
    if (PREVIEWS.some(p => p.id === q.get('preview'))) setPreview(q.get('preview') as Preview)
    if (q.get('set') === 'new') setFresh(true)
    if (q.get('sight') && q.get('sight')! in V2_SIGHTS) setPick(q.get('sight') as V2SightId)
  }, [])
  const kit = gunId in V2_GUNS ? V2_GUNS[gunId as V2GunId] : null, kitSight = kit ? (pick && kit.sights.includes(pick) ? pick : kit.own) : null
  const v2 = fresh ? kit : null, sight = v2 ? kitSight : null
  // M150 s4: the new model's BUILD dials (gun-build.ts), this browser's, loaded after mount (no localStorage on the server)
  const [builds, setBuilds] = useState<Partial<Record<V2GunId, GunBuild>>>({})
  useEffect(() => { setBuilds(loadBuilds()) }, [])
  const build = kit ? builds[kit.id] ?? BUILD_ZERO : BUILD_ZERO
  const setBuild = (b: GunBuild | null) => { if (kit) setBuilds(saveBuild(kit.id, b)) }
  const built = kit && kitSight ? builtModel(kit.id, kitSight, build) : null
  useEffect(() => {
    if (!v2 || !sight || !built) return
    previewGunModel(v2.id, built, v2.hold); bump(n => n + 1)
    return () => { previewGunModel(v2.id, null); bump(n => n + 1) }
  }, [v2, sight, built])
  const fov = preview === 'aim' && sight ? viewFov(75, OPTICS[V2_SIGHTS[sight].optic]) : 75
  const [ready, setReady] = useState(false)
  useEffect(() => { loadGunTune(); setReady(true) }, [])
  // M197: this browser's dials only after mount (the server has no localStorage: reading them in the first render broke hydration)
  const row = RANGE_GUNS.find(g => g.id === gunId) ?? RANGE_GUNS[0], gun = ready ? dialedGun(row) : rhythmDefaultsFor(row)
  // per gun (11-19): picking a gun loads ITS numbers into the sliders
  useEffect(() => { selectGunTune(gunId); bump(n => n + 1) }, [gunId])
  const values = () => JSON.stringify({ gun: gunId, ...Object.fromEntries(Object.keys(GUN_DEFAULTS).map(k => [k, VM[k as keyof GunTune]])), ...(gun.burst > 1 ? { BURST_GAP: gun.burstGap, BURST_DELAY: gun.fireCd } : { FIRE_INTERVAL: gun.fireCd }), ...(kit ? { BUILD: build } : {}) })
  const base = rhythmDefaultsFor(row)   // M197: what the dials read with nobody's moves (the row, under any baked rhythm)
  const dials = gun.burst > 1
    ? ([['BURST_GAP', 'round gap (s)', RHYTHM_DIALS.gap, gun.burstGap, base.burstGap], ['BURST_DELAY', 'burst delay (s)', RHYTHM_DIALS.delay, gun.fireCd, base.fireCd]] as const)
    : ([['FIRE_INTERVAL', 'fire interval (s)', RHYTHM_DIALS.fire, gun.fireCd, base.fireCd]] as const)

  return (
    <div style={{ height: '100dvh', display: 'flex', background: '#14131a' }}>
      <aside data-panel style={{ width: 300, overflowY: 'auto', padding: '10px 12px', borderRight: '1px solid #2c2a38', color: '#ddd6ea' }}>
        <h1 className="gx-title" style={{ margin: 0, fontSize: 14, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#e8e3d8' }}>The Gun Tuner</h1>
        <p style={{ margin: '4px 0 10px', fontSize: 11, color: '#9a94a8', lineHeight: 1.5 }}>
          The game&apos;s lens and held gun. Sliders save to this browser and the open world uses them at once. Copy values and paste them to Jin to make them the default.
        </p>
        <select data-gun value={gunId} onChange={e => setGunId(e.target.value)} style={{ ...chip, width: '100%', marginBottom: 8 }}>
          {RANGE_GUNS.map(g => <option key={g.id} value={g.id}>{g.name} · {g.slot.toLowerCase()} · {opticOf(g).id}</option>)}
        </select>
        {kit && (
          <div data-v2 style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <button data-set="today" onClick={() => setFresh(false)} style={{ ...chip, opacity: fresh ? 0.45 : 1 }}>Today</button>
            <button data-set="new" onClick={() => setFresh(true)} style={{ ...chip, opacity: fresh ? 1 : 0.45 }}>New model</button>
            {kit.sights.map(s => <button key={s} data-sight={s} onClick={() => setPick(s)} style={{ ...chip, opacity: s === kitSight ? 1 : 0.45 }}>{V2_SIGHTS[s].name}</button>)}
          </div>
        )}
        {kit && (
          <section data-build style={{ marginBottom: 12 }}>
            <span className="gx-label" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8b98a' }}>New model build</span>
            <span style={{ fontSize: 10, color: '#8b8598', marginLeft: 6 }}>{kit.name}: saved to this browser</span>
            {BUILD_DIALS.filter(d => !d.socket || hasSocket(kit.id)).map(d => (
              <label key={d.k} style={{ display: 'grid', gridTemplateColumns: '92px 1fr 46px', gap: 6, alignItems: 'center', fontSize: 11, marginTop: 4 }}>
                <span style={{ color: '#b5afc2' }}>{d.label}</span>
                <input type="range" data-build-knob={d.k} min={d.min} max={d.max} step={d.step} value={build[d.k]}
                  onChange={e => setBuild({ ...build, [d.k as BuildKey]: Number(e.target.value) })} />
                <span data-build-val={d.k} style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right', color: build[d.k] === BUILD_ZERO[d.k] ? '#8b8598' : '#e8b04a' }}>{build[d.k].toFixed(3)}</span>
              </label>
            ))}
            <button data-build-reset style={{ ...chip, marginTop: 6 }} onClick={() => setBuild(null)}>Reset build</button>
          </section>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {PREVIEWS.map(p => <button key={p.id} data-preview={p.id} onClick={() => setPreview(p.id)} style={{ ...chip, opacity: preview === p.id ? 1 : 0.45 }}>{p.label}</button>)}
          <button onClick={() => setPaused(!paused)} style={{ ...chip, opacity: paused ? 1 : 0.45 }}>{paused ? 'Paused' : 'Pause'}</button>
        </div>
          <section data-rhythm style={{ marginBottom: 12 }}>
            <button onClick={() => setPreview('fire')} style={{ all: 'unset', cursor: 'pointer', display: 'block' }}>
              <span className="gx-label" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: preview === 'fire' ? '#e8b04a' : '#c8b98a' }}>{gun.burst > 1 ? 'Burst' : 'Fire rate'}</span>
              <span style={{ fontSize: 10, color: '#8b8598', marginLeft: 6 }}>its rhythm, trigger held</span>
            </button>
            {dials.map(([k, label, d, v, def]) => (
              <label key={k} style={{ display: 'grid', gridTemplateColumns: '92px 1fr 46px', gap: 6, alignItems: 'center', fontSize: 11, marginTop: 4 }}>
                <span style={{ color: '#b5afc2' }}>{label}</span>
                <input type="range" data-knob={k} min={d.min} max={d.max} step={d.step} value={v} onChange={e => { setRhythm(row.id, { [k]: Number(e.target.value) }); setPreview('fire'); bump(x => x + 1) }} />
                <span data-dial-val={k} style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right', color: v === def ? '#8b8598' : '#e8b04a' }}>{v.toFixed(3)}</span>
              </label>
            ))}
            <div data-rhythm-read style={{ fontSize: 10, color: '#8b8598', marginTop: 4 }}>cycle {burstCycle(gun).toFixed(2)} s · {gun.damage.toFixed(1)} damage a round{gun.pellets > 1 ? ` x ${gun.pellets}` : ''} · {(gun.burst * gun.pellets * gun.damage / burstCycle(gun)).toFixed(1)} a second (held steady)</div>
          </section>
        {GROUPS.map(g => (
          <section key={g.title} style={{ marginBottom: 12 }}>
            <button onClick={() => setPreview(g.show)} style={{ all: 'unset', cursor: 'pointer', display: 'block' }}>
              <span className="gx-label" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: preview === g.show ? '#e8b04a' : '#c8b98a' }}>{g.title}</span>
              <span style={{ fontSize: 10, color: '#8b8598', marginLeft: 6 }}>{g.note}</span>
            </button>
            {g.knobs.map(n => (
              <label key={n.k} style={{ display: 'grid', gridTemplateColumns: '92px 1fr 46px', gap: 6, alignItems: 'center', fontSize: 11, marginTop: 4 }}>
                <span style={{ color: '#b5afc2' }}>{n.label}</span>
                <input type="range" data-knob={n.k} min={n.min} max={n.max} step={n.step} value={VM[n.k]}
                  onChange={e => { setGunTune({ [n.k]: Number(e.target.value) }); bump(x => x + 1) }} />
                <span style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right', color: VM[n.k] === defaultsFor(gunId)[n.k] ? '#8b8598' : '#e8b04a' }}>{VM[n.k].toFixed(3)}</span>
              </label>
            ))}
          </section>
        ))}
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button style={chip} onClick={() => { void navigator.clipboard?.writeText(values()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }}>{copied ? 'Copied' : 'Copy values'}</button>
          <button style={chip} onClick={() => { resetGunTune(); bump(n => n + 1) }}>Reset to defaults</button>
        </div>
        <pre data-values style={{ marginTop: 8, fontSize: 9, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#8b8598' }}>{values()}</pre>
        <SoundBench chip={chip} />
      </aside>
      <div style={{ flex: 1, position: 'relative' }}>
        <Canvas camera={{ position: [0, EYE_STAND, 0], fov: 75, near: 0.05, far: 500 }} onCreated={({ camera }) => camera.lookAt(0, EYE_STAND, -10)}>
          <color attach="background" args={['#cfe3ef']} />
          <hemisphereLight args={['#cfe3ef', '#7d9455', 0.9]} />
          <directionalLight position={[3, 6, 4]} intensity={1.1} />
          <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[400, 400]} /><meshStandardMaterial color="#86a35a" roughness={1} /></mesh>
          {[-6, -3, 3, 6].map(x => <mesh key={x} position={[x, 0.75, -12]}><boxGeometry args={[0.3, 1.5, 0.3]} /><meshStandardMaterial color="#8a6a3c" /></mesh>)}
          <mesh position={[0, EYE_STAND, -20]}><boxGeometry args={[0.6, 0.6, 0.1]} /><meshStandardMaterial color="#c0503a" /></mesh>
          <Fov fov={fov} />
          <FpGun ref={api} />
          <Driver api={api} gun={gun} preview={preview} paused={paused} />
        </Canvas>
        <ScopeRing />
        {kit && built && <CompareStrip today={todayModelOf(row)} fresh={built} body={row.color} />}
        {/* where the HUD's mana orb + Q/X chips sit at 1100x700 (bottom right), so the gun can stay clear of them */}
        <div style={{ position: 'absolute', right: 56, bottom: 24, width: 136, height: 136, borderRadius: '50%', border: '1px dashed rgba(60,40,90,0.6)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 262, bottom: 22, width: 240, height: 34, border: '1px dashed rgba(60,40,90,0.6)', borderRadius: 6, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 4, height: 4, margin: -2, borderRadius: 2, background: 'rgba(255,255,255,0.85)', boxShadow: '0 0 0 1px rgba(0,0,0,0.35)', pointerEvents: 'none' }} />
      </div>
    </div>
  )
}
