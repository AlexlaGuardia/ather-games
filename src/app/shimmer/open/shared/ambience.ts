// ── AMBIENCE (BETA M36 batch 3) ─ quiet code-made beds on the `ambience` bus, crossfaded, gated by the yay vote ────────────
// Alex 11-19: the player sounds are the only sound in the game; add environmental sound. A bed is a quiet loop you notice when it
// stops: generated noise + filters + slow LFOs + sparse randomized events (birds, owl, drips) scheduled AHEAD on the audio clock.
// No files, nothing to license. Each bed is a handful of long-lived nodes; events are 2-3 short nodes that stop themselves.
// API only: the page calls setAmbience(bedId | null) when the area changes and ambienceTick(dt, ...) once per frame.
// Only a `yay` bed plays in game (same gate as sfx.ts); auditionAmbience plays any bed for the review page.

import { audio, masterBus } from './gun-sound'
import { SOUNDS, statusOf, ambienceBus } from './sfx'

export const XFADE = 2.5            // seconds, bed to bed
const LOOKAHEAD = 0.6               // schedule events this far ahead of the audio clock
const rr = (a: number, b: number) => a + Math.random() * (b - a)

export interface AmbienceOpts { hour?: number; near?: { water?: number } }
/** which glade bed fits an hour of day (0..24): night 20:00 to 05:30. */
export const gladeBedFor = (hour: number) => (hour >= 20 || hour < 5.5 ? 'amb-glade-night' : 'amb-glade-day')

interface Events { gap: () => number; fire: (c: AudioContext, out: AudioNode, t: number) => void }
interface Built { sources: AudioScheduledSourceNode[]; ev?: Events; gapScale?: { v: number } }
interface Bed extends Built { id: string; out: GainNode; peak: number; next: number; dead: number | null }

// one 4 s brownish noise loop, shared by every bed (soft, no hiss)
let buf: AudioBuffer | null = null
function brown(c: AudioContext): AudioBuffer {
  if (buf) return buf
  const n = Math.floor(c.sampleRate * 4); buf = c.createBuffer(1, n, c.sampleRate)
  const d = buf.getChannelData(0); let last = 0
  for (let i = 0; i < n; i++) { last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.04; d[i] = last * 3.5 }
  return buf
}

function kit(c: AudioContext, out: AudioNode) {
  const sources: AudioScheduledSourceNode[] = []
  /** looping noise -> filter -> gain -> out; returns the filter + gain so an LFO can move them */
  const hiss = (type: BiquadFilterType, freq: number, q: number, gain: number) => {
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain()
    s.buffer = brown(c); s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = gain
    s.connect(f); f.connect(g); g.connect(out); s.start(0, rr(0, 3)); sources.push(s); return { f, g }
  }
  const lfo = (rate: number, depth: number, param: AudioParam) => {
    const o = c.createOscillator(), d = c.createGain(); o.frequency.value = rate; d.gain.value = depth
    o.connect(d); d.connect(param); o.start(); sources.push(o)
  }
  /** a short enveloped sine with a glide, for events */
  const blip = (to: AudioNode, t: number, f0: number, f1: number, peak: number, attack: number, dur: number) => {
    const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + attack + dur)
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur)
    o.connect(g); g.connect(to); o.start(t); o.stop(t + attack + dur + 0.05)
  }
  return { sources, hiss, lfo, blip }
}

const BUILD: Record<string, (c: AudioContext, out: AudioNode) => Built> = {
  'amb-glade-day': (c, out) => {
    const k = kit(c, out)
    const leaves = k.hiss('bandpass', 700, 0.45, 0.5); k.lfo(0.11, 0.18, leaves.g.gain); k.lfo(0.07, 260, leaves.f.frequency)
    k.hiss('highpass', 2600, 0.3, 0.05)   // the thin rustle on top
    const birds = c.createBiquadFilter(); birds.type = 'lowpass'; birds.frequency.value = 5200; birds.connect(out)
    const gapScale = { v: 1 }
    return { sources: k.sources, gapScale, ev: { gap: () => rr(2.2, 6.5) * gapScale.v, fire: (cx, _o, t) => {
      const n = 2 + Math.floor(Math.random() * 4), base = rr(2300, 4200), up = Math.random() < 0.6
      let at = t
      for (let i = 0; i < n; i++) { const f = base * (1 + (Math.random() - 0.5) * 0.12) * (up ? 1 + i * 0.03 : 1 - i * 0.03), d = rr(0.05, 0.1); k.blip(birds, at, f, f * rr(1.08, 1.3), rr(0.07, 0.13), 0.012, d); at += d + rr(0.07, 0.2) }
      void cx } } }
  },
  'amb-glade-night': (c, out) => {
    const k = kit(c, out)
    const leaves = k.hiss('bandpass', 520, 0.45, 0.28); k.lfo(0.09, 0.1, leaves.g.gain); k.lfo(0.06, 160, leaves.f.frequency)
    for (const [f, rate] of [[4300, 5.1], [4650, 4.4]] as const) {   // each cricket: a high sine pulsed by a fast LFO, swelling by a slow one
      const o = c.createOscillator(), g = c.createGain(); o.frequency.value = f; g.gain.value = 0.012; o.connect(g); g.connect(out); o.start(); k.sources.push(o)
      k.lfo(rate, 0.011, g.gain); k.lfo(0.17 + rate / 100, 0.004, g.gain)
    }
    const owl = c.createBiquadFilter(); owl.type = 'lowpass'; owl.frequency.value = 700; owl.connect(out)
    return { sources: k.sources, ev: { gap: () => rr(18, 45), fire: (_c, _o, t) => {
      const f = rr(330, 400); k.blip(owl, t, f * 1.05, f, 0.11, 0.06, 0.32); k.blip(owl, t + 0.55, f, f * 0.9, 0.12, 0.07, 0.5) } } }
  },
  'amb-water': (c, out) => {
    const k = kit(c, out)
    const lap = k.hiss('bandpass', 420, 0.9, 0.55); k.lfo(0.36, 0.22, lap.g.gain); k.lfo(0.23, 120, lap.f.frequency)
    const tr = k.hiss('bandpass', 2300, 3.5, 0.06); k.lfo(1.7, 0.035, tr.g.gain); k.lfo(0.5, 500, tr.f.frequency)
    return { sources: k.sources, ev: { gap: () => rr(0.9, 3), fire: (_c, o, t) => { const f = rr(700, 1300); k.blip(o, t, f, f * 1.7, rr(0.03, 0.06), 0.004, 0.07) } } }
  },
  'amb-wilds-wind': (c, out) => {
    const k = kit(c, out)
    const w = k.hiss('bandpass', 480, 0.4, 0.5); k.lfo(0.05, 0.3, w.g.gain); k.lfo(0.08, 320, w.f.frequency)   // slow gusts: level and colour drift together
    const air = k.hiss('highpass', 1800, 0.3, 0.08); k.lfo(0.06, 0.06, air.g.gain)
    return { sources: k.sources }
  },
  'amb-town': (c, out) => {
    const k = kit(c, out)
    const m = k.hiss('bandpass', 320, 0.6, 0.5); k.lfo(0.06, 0.25, m.g.gain); k.lfo(0.04, 70, m.f.frequency)
    const m2 = k.hiss('bandpass', 640, 0.8, 0.22); k.lfo(0.09, 0.14, m2.g.gain)
    return { sources: k.sources }
  },
}
export const AMBIENCE_BEDS = Object.keys(BUILD)

// ── engine: one main bed (crossfaded) plus an automatic water layer that sits under it ──
let main: Bed | null = null, water: Bed | null = null, wanted: string | null = null
const dying: Bed[] = []
let lastWater = 0, auditionTimer: ReturnType<typeof setInterval> | null = null, auditionEnd: ReturnType<typeof setTimeout> | null = null

function start(id: string, level: number, fade: number): Bed | null {
  const c = audio(), m = masterBus(), build = BUILD[id]; if (!c || !m || !build) return null
  try {
    const row = SOUNDS.find(s => s.id === id), peak = (row?.vol ?? 0.35)
    const out = c.createGain(); out.gain.value = 0.0001; out.connect(ambienceBus(c, m))
    const b = build(c, out), t = c.currentTime
    out.gain.setValueAtTime(0.0001, t); out.gain.setTargetAtTime(Math.max(peak * level, 0.0001), t, fade / 4)
    return { ...b, id, out, peak, next: t + (b.ev ? rr(0.5, 2) : 0), dead: null }
  } catch { return null }
}
function release(b: Bed, fade: number) {
  const c = audio(); if (!c) return
  const t = c.currentTime
  try { b.out.gain.cancelScheduledValues(t); b.out.gain.setTargetAtTime(0, t, fade / 4); b.out.gain.setValueAtTime(0, t + fade) } catch { /* fine */ }
  b.dead = t + fade + 0.2; b.ev = undefined
  for (const s of b.sources) { try { s.stop(b.dead) } catch { /* fine */ } }
  dying.push(b)
}
const gated = (id: string | null) => (id && statusOf(id) === 'yay' && BUILD[id] ? id : null)

/** Crossfade the main bed to `id` (~2.5 s). null, or a bed that is not `yay`, fades the main bed out to silence. */
export function setAmbience(id: string | null) {
  wanted = gated(id)
  if (auditionTimer) return   // an audition owns the main slot until it ends
  swap(wanted)
}
function swap(id: string | null) {
  if (main && main.id === id) return
  if (main) { release(main, XFADE); main = null }
  if (id) main = start(id, 1, XFADE)
}

/** Review page: play a bed for `seconds` regardless of status, then fade out and hand the main slot back. */
export function auditionAmbience(id: string, seconds = 12) {
  if (!BUILD[id]) return
  if (auditionTimer) clearInterval(auditionTimer); if (auditionEnd) clearTimeout(auditionEnd)
  if (main) { release(main, XFADE); main = null }
  main = start(id, 1, XFADE)
  auditionTimer = setInterval(() => pump(0.2), 200)
  auditionEnd = setTimeout(() => { if (auditionTimer) clearInterval(auditionTimer); auditionTimer = null; auditionEnd = null; swap(wanted) }, Math.max(1, seconds) * 1000)
}

function run(b: Bed, now: number, scale = 1) {
  const c = audio(); if (!c || !b.ev) return
  if (b.gapScale) b.gapScale.v = scale
  let guard = 0
  while (b.next < now + LOOKAHEAD && guard++ < 8) { try { b.ev.fire(c, b.out, Math.max(b.next, now)) } catch { /* fine */ } b.next += b.ev.gap() }
}
function pump(_dt: number, o: AmbienceOpts = {}) {
  const c = audio(); if (!c) return
  const now = c.currentTime, h = o.hour
  if (main) run(main, now, h !== undefined && h >= 4.5 && h < 9 ? 0.55 : 1)   // dawn chorus: birds twice as often
  if (water) run(water, now)
  for (let i = dying.length - 1; i >= 0; i--) { const d = dying[i]; if (d.dead !== null && now > d.dead) { for (const s of d.sources) { try { s.disconnect() } catch { /* fine */ } } try { d.out.disconnect() } catch { /* fine */ } dying.splice(i, 1) } }
}

/** Once per frame. `near.water` (0..1) layers the pool bed under the main bed; `hour` (0..24) shifts how lively the day bed is. */
export function ambienceTick(dt: number, o: AmbienceOpts = {}) {
  const c = audio(); if (!c) return
  const w = Math.min(1, Math.max(0, o.near?.water ?? 0)), ok = gated('amb-water') && main?.id !== 'amb-water'
  if (ok && w > 0.02 && !water) { water = start('amb-water', w, 1.2); lastWater = w }
  else if (water && (!ok || w <= 0.02)) { release(water, 1.5); water = null; lastWater = 0 }
  else if (water && Math.abs(w - lastWater) > 0.03) { lastWater = w; const t = c.currentTime; water.out.gain.setTargetAtTime(Math.max(water.peak * w, 0.0001), t, 0.35) }
  pump(dt, o)
}

/** Debug / tests: what is alive right now. */
export const ambienceBeds = () => ({ main: main?.id ?? null, water: water?.id ?? null, dying: dying.map(d => d.id), nodes: { main: main?.out ?? null, water: water?.out ?? null, dying: dying.map(d => d.out) } })
