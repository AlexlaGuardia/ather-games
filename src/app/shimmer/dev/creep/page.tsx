'use client'

// Hollow-voice listening bench — hear a thing walk around you, and see where it actually is.
//
// ★ AUDIO IS THE ONE THING A SCREENSHOT CANNOT VERIFY. Every other harness in this tree exists so a
// picture can disagree with the model; this one exists because no picture can. A human has to put
// headphones on. So the page pairs the sound with a top-down plot of the true position: if what you
// HEAR and what you SEE disagree, the cue is wrong, and that disagreement is the whole measurement.
//
// ★ IT MOUNTS THE SHIPPED PAIR — `stepVoices` for the decisions and `playEmissions` for the noise.
// A bench that re-derived the panning could be perfectly pleasant and prove nothing about the game.
//
// ⚠ HEADPHONES. Laptop speakers are two inches apart and will not resolve a pan, so the left/right
// half of the cue is untestable on them. The front/back half (the muffle) survives speakers.
//
// Run: tools/devwin.sh world  →  http://localhost:3201/shimmer/dev/creep

import { useEffect, useRef, useState } from 'react'
import { stepVoices, newVoiceClock, DEFAULT_VOICE, type Voice, type Emission } from '../../voxel3d/hollow-voice'
import { unlockHollowSfx, playEmissions, hollowSfxState, disposeHollowSfx } from '../../voxel3d/hollow-sfx'
import { HOLLOW_FORMS } from '../../voxel3d/hollows'

type Form = Voice['form']
const FORMS: Form[] = ['stalker', 'warden', 'caster']

export default function CreepBench() {
  const [form, setForm] = useState<Form>('stalker')
  const [radius, setRadius] = useState(9)
  const [orbit, setOrbit] = useState(true)
  const [live, setLive] = useState(false)
  const [angle, setAngle] = useState(Math.PI)          // where it stands, in ear-relative radians
  const [last, setLast] = useState<Emission | null>(null)
  const [state, setState] = useState<'off' | 'suspended' | 'running'>('off')
  const clock = useRef(newVoiceClock())
  const raf = useRef(0)
  const a = useRef(Math.PI)
  a.current = angle

  useEffect(() => {
    if (!live) return
    let prev = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now
      // The keeper stands at the origin facing +x; the body walks a circle around them.
      const speed = HOLLOW_FORMS[form].speed
      if (orbit) { a.current += (speed / Math.max(1, radius)) * dt; setAngle(a.current) }
      const body: Voice = {
        id: 'bench', form, speed: orbit ? speed : 0,
        x: Math.cos(a.current) * radius, z: Math.sin(a.current) * radius,
      }
      const ems = stepVoices(clock.current, [body], { x: 0, z: 0, yaw: 0 }, dt)
      if (ems.length) { playEmissions(ems); setLast(ems[0]) }
      setState(hollowSfxState())
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [live, form, radius, orbit])

  useEffect(() => () => disposeHollowSfx(), [])

  // Screen-space: the keeper faces UP, so +x world maps to up and +z world maps to right.
  const px = 110 + Math.sin(angle) * radius * 4
  const py = 110 - Math.cos(angle) * radius * 4
  const deg = Math.round(((angle * 180) / Math.PI + 540) % 360 - 180)
  const behind = Math.abs(deg) > 90

  return (
    <div className="min-h-screen bg-[#0d1014] p-6 text-white/80">
      <h1 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.18em] text-amber-200/70">hollow voice — listening bench</h1>
      <p className="mb-5 max-w-xl text-[11px] leading-relaxed text-white/40">
        Put headphones on, press start, then look away from the screen and say out loud where it is.
        Turn back and check. If the two disagree, the cue is wrong — that disagreement is the test.
      </p>

      <div className="flex flex-wrap items-start gap-8">
        <div>
          <svg width={220} height={220} className="rounded border border-white/10 bg-black/40">
            <circle cx={110} cy={110} r={radius * 4} fill="none" stroke="rgba(255,255,255,0.08)" />
            {/* the keeper, facing up */}
            <circle cx={110} cy={110} r={5} fill="#8fd9c4" />
            <line x1={110} y1={110} x2={110} y2={86} stroke="#8fd9c4" strokeWidth={2} />
            <path d="M 74 96 L 110 60 L 146 96" fill="none" stroke="rgba(143,217,196,0.25)" />
            <circle cx={px} cy={py} r={6} fill={behind ? '#e0655f' : '#d9c98f'} />
          </svg>
          <div className="mt-2 text-[10px] tabular-nums text-white/40">
            {deg}° · {behind ? <span className="text-[#e0655f]">BEHIND YOU</span> : 'in front'} · {radius} blocks
          </div>
        </div>

        <div className="flex flex-col gap-3 text-[11px]">
          <button
            onClick={() => { setState(unlockHollowSfx() ? 'running' : 'suspended'); setLive(v => !v) }}
            className={`w-40 rounded px-3 py-1.5 ${live ? 'bg-amber-300/20 text-amber-200' : 'bg-white/10'}`}
          >
            {live ? 'stop' : 'start — needs a click'}
          </button>
          <div className="flex gap-1">
            {FORMS.map(f => (
              <button key={f} onClick={() => setForm(f)}
                      className={`rounded px-2 py-1 ${form === f ? 'bg-amber-300/20 text-amber-200' : 'bg-white/10'}`}>
                {f}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2">
            distance
            <input type="range" min={2} max={DEFAULT_VOICE.range} value={radius} onChange={e => setRadius(+e.target.value)} />
            <span className="tabular-nums text-white/45">{radius}</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={orbit} onChange={e => setOrbit(e.target.checked)} />
            walking (unchecked = standing still, which must be SILENT)
          </label>
          {!orbit && (
            <label className="flex items-center gap-2">
              place it
              <input type="range" min={-180} max={180} value={deg}
                     onChange={e => { const r = (+e.target.value * Math.PI) / 180; a.current = r; setAngle(r) }} />
            </label>
          )}
          {/* ⚠ 'suspended' and 'muted' look identical from outside and have different fixes, which
              is why hollow-sfx reports the state rather than a boolean. */}
          <div className="text-[10px] tabular-nums text-white/40">
            audio {state}
            {last && <> · gain {last.gain.toFixed(2)} · pan {last.pan.toFixed(2)} · muffle {last.muffle.toFixed(2)}</>}
          </div>
          <div className="max-w-xs text-[10px] leading-relaxed text-white/30">
            Behind should sound darker, not just centred — pan alone puts 4 and 8 o&apos;clock in the
            same place. Standing still must be silent: a footfall from something that is not walking
            is the cue lying about what it is doing.
          </div>
        </div>
      </div>
    </div>
  )
}
