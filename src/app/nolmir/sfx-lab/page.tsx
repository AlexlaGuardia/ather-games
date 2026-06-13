'use client'

// NOLMIR — SFX VIBE LAB. A pitch surface: three sonic directions, each mapped to
// the SAME real Nolmir events, all synthesized in-browser (Web Audio) so there
// are zero assets and every sound is a few numbers away from being re-tuned.
// Pick a vibe, click through, A/B the feel, run the montage. No files, no deps.

import { useRef, useState } from 'react'

// ---- the tiny synth engine ----

interface ToneOpts {
  type?: OscillatorType
  dur?: number
  peak?: number
  attack?: number
  glideTo?: number // exponential pitch glide over dur
  detune?: number // a second voice this many cents off (beats / shimmer)
  vibHz?: number // vibrato rate
  vibDepth?: number // vibrato depth in cents
  filter?: number // lowpass cutoff
  filterType?: BiquadFilterType
  q?: number
}

interface NoiseOpts {
  dur?: number
  peak?: number
  attack?: number
  filter?: number
  filterType?: BiquadFilterType
  q?: number
  sweepTo?: number // sweep the filter cutoff to here over dur
}

interface Engine {
  ac: AudioContext
  master: GainNode
  now: () => number
  tone: (t0: number, freq: number, o?: ToneOpts) => void
  noise: (t0: number, o?: NoiseOpts) => void
}

function makeEngine(ac: AudioContext, master: GainNode): Engine {
  const voice = (t0: number, freq: number, o: ToneOpts, det: number) => {
    const dur = o.dur ?? 0.15
    const osc = ac.createOscillator()
    osc.type = o.type ?? 'square'
    osc.frequency.setValueAtTime(freq, t0)
    if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.glideTo), t0 + dur)
    if (det) osc.detune.setValueAtTime(det, t0)
    // vibrato
    if (o.vibHz && o.vibDepth) {
      const lfo = ac.createOscillator()
      const lg = ac.createGain()
      lfo.frequency.value = o.vibHz
      lg.gain.value = o.vibDepth
      lfo.connect(lg).connect(osc.detune)
      lfo.start(t0)
      lfo.stop(t0 + dur + 0.05)
    }
    let node: AudioNode = osc
    if (o.filter) {
      const f = ac.createBiquadFilter()
      f.type = o.filterType ?? 'lowpass'
      f.frequency.value = o.filter
      if (o.q) f.Q.value = o.q
      osc.connect(f)
      node = f
    }
    const g = ac.createGain()
    const peak = o.peak ?? 0.25
    const atk = o.attack ?? 0.005
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(peak, t0 + atk)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    node.connect(g).connect(master)
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
  }

  const tone: Engine['tone'] = (t0, freq, o = {}) => {
    voice(t0, freq, o, 0)
    if (o.detune) voice(t0, freq, o, o.detune)
  }

  const noise: Engine['noise'] = (t0, o = {}) => {
    const dur = o.dur ?? 0.2
    const len = Math.max(1, Math.floor(ac.sampleRate * dur))
    const buf = ac.createBuffer(1, len, ac.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    const src = ac.createBufferSource()
    src.buffer = buf
    const f = ac.createBiquadFilter()
    f.type = o.filterType ?? 'bandpass'
    f.frequency.setValueAtTime(o.filter ?? 1800, t0)
    if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.sweepTo), t0 + dur)
    f.Q.value = o.q ?? 1
    const g = ac.createGain()
    const peak = o.peak ?? 0.25
    const atk = o.attack ?? 0.004
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(peak, t0 + atk)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    src.connect(f).connect(g).connect(master)
    src.start(t0)
    src.stop(t0 + dur)
  }

  return { ac, master, now: () => ac.currentTime, tone, noise }
}

// ---- the events (shared across vibes) ----

type EventId =
  | 'click' | 'buy' | 'error' | 'unlock'
  | 'shot' | 'bolt' | 'hit' | 'death' | 'heal'
  | 'waveClear' | 'levelUp' | 'vault' | 'warp' | 'wash'

const EVENTS: { id: EventId; label: string; group: string }[] = [
  { id: 'click', label: 'UI click', group: 'interface' },
  { id: 'buy', label: 'buy / upgrade', group: 'interface' },
  { id: 'unlock', label: 'planet / research', group: 'interface' },
  { id: 'error', label: "can't afford", group: 'interface' },
  { id: 'shot', label: 'guard shot', group: 'combat' },
  { id: 'bolt', label: 'champion bolt', group: 'combat' },
  { id: 'hit', label: 'flood hit', group: 'combat' },
  { id: 'death', label: 'flood death', group: 'combat' },
  { id: 'heal', label: 'mender heal', group: 'combat' },
  { id: 'waveClear', label: 'wave cleared', group: 'moments' },
  { id: 'levelUp', label: 'level up', group: 'moments' },
  { id: 'vault', label: 'vault taken', group: 'moments' },
  { id: 'warp', label: 'the warp', group: 'moments' },
  { id: 'wash', label: 'the wash', group: 'moments' },
]

type Vibe = 'arcade' | 'arcane' | 'abyssal'

const VIBES: { id: Vibe; name: string; line: string }[] = [
  { id: 'arcane', name: 'Arcane', line: 'crystalline bells, runic shimmer — the machines hum magic' },
  { id: 'arcade', name: 'Arcade', line: 'retro chiptune, square-wave punch — pure pixel game' },
  { id: 'abyssal', name: 'Abyssal', line: 'deep, oceanic, weighty — the flood and the forge' },
]

type Patch = Record<EventId, (E: Engine, t: number) => void>

// ARCADE — square/pulse chiptune, short and bright
const arcade: Patch = {
  click: (E, t) => E.tone(t, 660, { type: 'square', dur: 0.05, peak: 0.18, glideTo: 880 }),
  buy: (E, t) => { E.tone(t, 784, { type: 'square', dur: 0.06, peak: 0.18 }); E.tone(t + 0.07, 1175, { type: 'square', dur: 0.08, peak: 0.18 }) },
  unlock: (E, t) => [523, 659, 784, 1047].forEach((f, i) => E.tone(t + i * 0.06, f, { type: 'square', dur: 0.09, peak: 0.16 })),
  error: (E, t) => E.tone(t, 196, { type: 'square', dur: 0.18, peak: 0.2, glideTo: 130 }),
  shot: (E, t) => E.tone(t, 980, { type: 'square', dur: 0.07, peak: 0.16, glideTo: 320 }),
  bolt: (E, t) => E.tone(t, 1320, { type: 'sawtooth', dur: 0.09, peak: 0.15, glideTo: 520 }),
  hit: (E, t) => { E.tone(t, 320, { type: 'square', dur: 0.04, peak: 0.16 }); E.noise(t, { dur: 0.04, peak: 0.1, filter: 2400 }) },
  death: (E, t) => { E.tone(t, 440, { type: 'square', dur: 0.13, peak: 0.18, glideTo: 80 }); E.noise(t, { dur: 0.12, peak: 0.12, filter: 1200 }) },
  heal: (E, t) => [784, 1047, 1319].forEach((f, i) => E.tone(t + i * 0.05, f, { type: 'triangle', dur: 0.14, peak: 0.16 })),
  waveClear: (E, t) => [523, 659, 784, 1047].forEach((f, i) => E.tone(t + i * 0.07, f, { type: 'square', dur: 0.12, peak: 0.17 })),
  levelUp: (E, t) => [659, 784, 988, 1319].forEach((f, i) => E.tone(t + i * 0.05, f, { type: 'square', dur: 0.13, peak: 0.18 })),
  vault: (E, t) => { E.tone(t, 165, { type: 'square', dur: 0.5, peak: 0.2, glideTo: 98 }); E.tone(t + 0.05, 110, { type: 'square', dur: 0.45, peak: 0.14 }) },
  warp: (E, t) => { E.tone(t, 196, { type: 'square', dur: 0.6, peak: 0.18, glideTo: 1568 }); [880, 1175, 1568, 2093].forEach((f, i) => E.tone(t + 0.3 + i * 0.05, f, { type: 'square', dur: 0.12, peak: 0.12 })) },
  wash: (E, t) => { E.noise(t, { dur: 0.9, peak: 0.22, filter: 600, sweepTo: 180, filterType: 'lowpass' }); E.tone(t, 220, { type: 'square', dur: 0.85, peak: 0.16, glideTo: 60 }) },
}

// ARCANE — sine/triangle bells, detuned shimmer, soft attacks, longer tails
const arcane: Patch = {
  click: (E, t) => E.tone(t, 1046, { type: 'triangle', dur: 0.12, peak: 0.16, attack: 0.008 }),
  buy: (E, t) => { E.tone(t, 880, { type: 'sine', dur: 0.4, peak: 0.16, detune: 6 }); E.tone(t + 0.04, 1320, { type: 'sine', dur: 0.5, peak: 0.12, detune: 7 }) },
  unlock: (E, t) => [523, 659, 784].forEach((f) => E.tone(t, f, { type: 'sine', dur: 0.7, peak: 0.12, detune: 5, attack: 0.01 })),
  error: (E, t) => E.tone(t, 233, { type: 'triangle', dur: 0.28, peak: 0.16, detune: 22, vibHz: 14, vibDepth: 30 }),
  shot: (E, t) => { E.tone(t, 1318, { type: 'triangle', dur: 0.16, peak: 0.14, glideTo: 740 }); E.noise(t, { dur: 0.1, peak: 0.05, filter: 5000, q: 0.6 }) },
  bolt: (E, t) => E.tone(t, 1568, { type: 'sine', dur: 0.2, peak: 0.14, glideTo: 880, detune: 8 }),
  hit: (E, t) => { E.tone(t, 600, { type: 'triangle', dur: 0.08, peak: 0.13 }); E.tone(t, 1200, { type: 'sine', dur: 0.1, peak: 0.07 }) },
  death: (E, t) => { E.tone(t, 520, { type: 'sine', dur: 0.35, peak: 0.14, glideTo: 120, detune: 10 }); E.noise(t + 0.02, { dur: 0.3, peak: 0.06, filter: 3000, sweepTo: 400, filterType: 'lowpass' }) },
  heal: (E, t) => [784, 1175, 1568].forEach((f, i) => E.tone(t + i * 0.06, f, { type: 'sine', dur: 0.5, peak: 0.14, detune: 6, attack: 0.01 })),
  waveClear: (E, t) => [523, 659, 784, 1047].forEach((f, i) => E.tone(t + i * 0.08, f, { type: 'sine', dur: 0.6, peak: 0.13, detune: 5 })),
  levelUp: (E, t) => [659, 988, 1319, 1976].forEach((f, i) => E.tone(t + i * 0.06, f, { type: 'sine', dur: 0.55, peak: 0.14, detune: 7, attack: 0.008 })),
  vault: (E, t) => { E.tone(t, 110, { type: 'sine', dur: 0.9, peak: 0.2, detune: 8 }); E.tone(t + 0.1, 220, { type: 'triangle', dur: 0.8, peak: 0.1, detune: 14, vibHz: 5, vibDepth: 12 }) },
  warp: (E, t) => { E.tone(t, 330, { type: 'sine', dur: 0.7, peak: 0.16, glideTo: 1980, detune: 10 }); [988, 1319, 1760, 2349].forEach((f, i) => E.tone(t + 0.25 + i * 0.06, f, { type: 'sine', dur: 0.5, peak: 0.1, detune: 8 })) },
  wash: (E, t) => { E.noise(t, { dur: 1.1, peak: 0.2, filter: 900, sweepTo: 220, filterType: 'lowpass', q: 0.7 }); E.tone(t, 98, { type: 'sine', dur: 1.0, peak: 0.16, detune: 9 }); E.tone(t + 0.2, 196, { type: 'triangle', dur: 0.8, peak: 0.08, vibHz: 3, vibDepth: 20 }) },
}

// ABYSSAL — low saws, filtered noise, sub weight; the flood + the forge
const abyssal: Patch = {
  click: (E, t) => { E.noise(t, { dur: 0.04, peak: 0.12, filter: 3000, q: 2 }); E.tone(t, 220, { type: 'sawtooth', dur: 0.05, peak: 0.12, filter: 900 }) },
  buy: (E, t) => E.tone(t, 110, { type: 'sawtooth', dur: 0.16, peak: 0.18, glideTo: 165, filter: 1200 }),
  unlock: (E, t) => { E.tone(t, 110, { type: 'sawtooth', dur: 0.4, peak: 0.14, filter: 900, detune: 12 }); E.noise(t, { dur: 0.25, peak: 0.08, filter: 2600, q: 3 }) },
  error: (E, t) => E.tone(t, 82, { type: 'sawtooth', dur: 0.24, peak: 0.2, glideTo: 60, filter: 700 }),
  shot: (E, t) => { E.noise(t, { dur: 0.08, peak: 0.16, filter: 1600, q: 1.5 }); E.tone(t, 200, { type: 'sawtooth', dur: 0.08, peak: 0.12, glideTo: 110, filter: 1000 }) },
  bolt: (E, t) => E.tone(t, 400, { type: 'sawtooth', dur: 0.1, peak: 0.14, glideTo: 150, filter: 1400 }),
  hit: (E, t) => { E.tone(t, 120, { type: 'sawtooth', dur: 0.05, peak: 0.16, filter: 800 }); E.noise(t, { dur: 0.05, peak: 0.1, filter: 1200 }) },
  death: (E, t) => { E.noise(t, { dur: 0.2, peak: 0.18, filter: 1000, sweepTo: 200, filterType: 'lowpass' }); E.tone(t, 150, { type: 'sawtooth', dur: 0.18, peak: 0.12, glideTo: 50, filter: 700 }) },
  heal: (E, t) => { E.tone(t, 330, { type: 'sine', dur: 0.4, peak: 0.14, glideTo: 660, filter: 2000 }); E.noise(t, { dur: 0.35, peak: 0.06, filter: 1400, sweepTo: 600, filterType: 'lowpass' }) },
  waveClear: (E, t) => { E.tone(t, 110, { type: 'sawtooth', dur: 0.4, peak: 0.16, glideTo: 220, filter: 1100 }); E.noise(t + 0.1, { dur: 0.4, peak: 0.08, filter: 1800, sweepTo: 400, filterType: 'lowpass' }) },
  levelUp: (E, t) => { E.tone(t, 110, { type: 'sawtooth', dur: 0.5, peak: 0.16, glideTo: 440, filter: 1600 }); E.tone(t + 0.05, 55, { type: 'sine', dur: 0.5, peak: 0.14 }) },
  vault: (E, t) => { E.tone(t, 55, { type: 'sine', dur: 1.0, peak: 0.24 }); E.tone(t, 82, { type: 'sawtooth', dur: 0.9, peak: 0.14, glideTo: 50, filter: 600 }); E.noise(t, { dur: 0.9, peak: 0.1, filter: 400, filterType: 'lowpass' }) },
  warp: (E, t) => { E.noise(t, { dur: 0.8, peak: 0.16, filter: 300, sweepTo: 2400, filterType: 'lowpass' }); E.tone(t, 60, { type: 'sawtooth', dur: 0.7, peak: 0.18, glideTo: 440, filter: 1800 }) },
  wash: (E, t) => { E.noise(t, { dur: 1.3, peak: 0.26, filter: 280, sweepTo: 90, filterType: 'lowpass', q: 0.8 }); E.tone(t, 110, { type: 'sawtooth', dur: 1.2, peak: 0.18, glideTo: 38, filter: 500 }); E.tone(t + 0.1, 55, { type: 'sine', dur: 1.1, peak: 0.2 }) },
}

const PATCHES: Record<Vibe, Patch> = { arcade, arcane, abyssal }

// the order a montage plays through
const MONTAGE: EventId[] = ['click', 'buy', 'unlock', 'shot', 'bolt', 'hit', 'death', 'heal', 'waveClear', 'levelUp', 'vault', 'warp', 'wash']

export default function SfxLabPage() {
  const [vibe, setVibe] = useState<Vibe>('arcane')
  const [vol, setVol] = useState(0.4)
  const [last, setLast] = useState<EventId | null>(null)
  const engRef = useRef<Engine | null>(null)
  const masterRef = useRef<GainNode | null>(null)

  // lazily build the audio graph on the first user gesture (autoplay policy)
  const engine = (): Engine => {
    if (!engRef.current) {
      const ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const master = ac.createGain()
      master.gain.value = vol
      master.connect(ac.destination)
      masterRef.current = master
      engRef.current = makeEngine(ac, master)
    }
    if (engRef.current.ac.state === 'suspended') engRef.current.ac.resume()
    return engRef.current
  }

  const setVolume = (v: number) => {
    setVol(v)
    if (masterRef.current) masterRef.current.gain.value = v
  }

  const play = (id: EventId) => {
    const E = engine()
    PATCHES[vibe][id](E, E.now() + 0.02)
    setLast(id)
  }

  const playMontage = () => {
    const E = engine()
    let t = E.now() + 0.05
    for (const id of MONTAGE) {
      PATCHES[vibe][id](E, t)
      t += 0.55
    }
  }

  const groups = ['interface', 'combat', 'moments']

  return (
    <div className="min-h-screen bg-[#070a10] text-slate-300 font-mono">
      <div className="max-w-[900px] mx-auto px-4 py-6">
        <header className="mb-5">
          <h1 className="text-cyan-300 text-xl tracking-[0.3em]">NOLMIR · SFX VIBE LAB</h1>
          <p className="text-slate-500 text-xs mt-1">
            three sonic directions · same events · all synthesized live, zero assets — pick the feel
          </p>
        </header>

        {/* vibe selector */}
        <div className="grid sm:grid-cols-3 gap-2 mb-4">
          {VIBES.map((v) => (
            <button
              key={v.id}
              onClick={() => setVibe(v.id)}
              className={`text-left rounded-lg border p-3 transition-colors ${
                vibe === v.id
                  ? 'border-cyan-400 bg-cyan-950/20'
                  : 'border-slate-800 bg-[#0b101c]/70 hover:border-slate-600'
              }`}
            >
              <div className={`text-sm tracking-widest ${vibe === v.id ? 'text-cyan-200' : 'text-slate-300'}`}>
                {v.name.toUpperCase()}
              </div>
              <div className="text-slate-500 text-[11px] mt-1 leading-snug">{v.line}</div>
            </button>
          ))}
        </div>

        {/* transport */}
        <div className="flex items-center gap-4 mb-5 rounded-lg border border-slate-800 bg-[#0b101c]/70 p-3">
          <button
            onClick={playMontage}
            className="px-3 py-1.5 rounded border border-violet-500 text-violet-200 text-xs tracking-widest hover:bg-violet-950/40"
          >
            ▶ PLAY THE MONTAGE
          </button>
          <label className="flex items-center gap-2 text-xs text-slate-500 flex-1">
            volume
            <input
              type="range"
              min={0}
              max={0.8}
              step={0.02}
              value={vol}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="flex-1 max-w-[200px] accent-cyan-400"
            />
          </label>
          <span className="text-slate-600 text-xs">
            last: <span className="text-slate-400">{last ? EVENTS.find((e) => e.id === last)?.label : '—'}</span>
          </span>
        </div>

        {/* the event board */}
        {groups.map((grp) => (
          <section key={grp} className="mb-4">
            <h2 className="text-slate-500 text-[10px] tracking-[0.25em] mb-2">{grp.toUpperCase()}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {EVENTS.filter((e) => e.group === grp).map((e) => (
                <button
                  key={e.id}
                  onClick={() => play(e.id)}
                  className={`rounded border px-3 py-2 text-xs text-left transition-colors ${
                    last === e.id
                      ? 'border-cyan-500 text-cyan-200 bg-cyan-950/20'
                      : 'border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                  }`}
                >
                  ♪ {e.label}
                </button>
              ))}
            </div>
          </section>
        ))}

        <footer className="mt-6 text-xs text-slate-700 text-center space-y-1">
          <div>each sound is ~one line of params — once you pick a vibe, re-tuning any cue is trivial</div>
          <div>a pitch surface · not wired into the game yet</div>
        </footer>
      </div>
    </div>
  )
}
