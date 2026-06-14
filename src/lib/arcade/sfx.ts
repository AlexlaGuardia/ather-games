// ARCADE TOOLKIT — Web Audio SFX engine + a generic manager. Game-agnostic:
// every game brings its own PATCH (a map of event id -> synth recipe) and gets
// lazy audio-unlock, a master gain, persisted mute + volume, and per-event
// throttling for free. Extracted from Nolmir's first SFX pass (2026-06-11).

export interface ToneOpts {
  type?: OscillatorType
  dur?: number
  peak?: number
  attack?: number
  glideTo?: number // exponential pitch glide over dur
  detune?: number // a second voice this many cents off (beats / shimmer)
  vibHz?: number // vibrato rate
  vibDepth?: number // vibrato depth in cents
  filter?: number // filter cutoff
  filterType?: BiquadFilterType
  q?: number
}

export interface NoiseOpts {
  dur?: number
  peak?: number
  attack?: number
  filter?: number
  filterType?: BiquadFilterType
  q?: number
  sweepTo?: number // sweep the filter cutoff to here over dur
}

export interface Engine {
  ac: AudioContext
  master: GainNode
  now: () => number
  tone: (t0: number, freq: number, o?: ToneOpts) => void
  noise: (t0: number, o?: NoiseOpts) => void
}

export function makeEngine(ac: AudioContext, master: GainNode): Engine {
  const voice = (t0: number, freq: number, o: ToneOpts, det: number) => {
    const dur = o.dur ?? 0.15
    const osc = ac.createOscillator()
    osc.type = o.type ?? 'square'
    osc.frequency.setValueAtTime(freq, t0)
    if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.glideTo), t0 + dur)
    if (det) osc.detune.setValueAtTime(det, t0)
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

// a game's sound set: event id -> a recipe that schedules voices at time t
export type Cue = (E: Engine, t: number) => void
export type Patch<Id extends string> = Record<Id, Cue>

export interface SfxConfig<Id extends string> {
  throttle?: Partial<Record<Id, number>> // per-event min gap (ms) so flurries stay musical
  storageKey?: string // localStorage prefix for mute/volume (default 'arcade.sfx')
  defaultVolume?: number
}

export class SfxManager<Id extends string> {
  private ac: AudioContext | null = null
  private master: GainNode | null = null
  private eng: Engine | null = null
  private muted = false
  private vol: number
  private lastAt: Partial<Record<Id, number>> = {}
  private key: string

  constructor(
    private patch: Patch<Id>,
    private cfg: SfxConfig<Id> = {},
  ) {
    this.key = cfg.storageKey ?? 'arcade.sfx'
    this.vol = cfg.defaultVolume ?? 0.4
    if (typeof window !== 'undefined') {
      this.muted = localStorage.getItem(`${this.key}.muted`) === '1'
      const v = parseFloat(localStorage.getItem(`${this.key}.vol`) ?? '')
      if (!isNaN(v)) this.vol = v
    }
  }

  // call from a user gesture (a click) so the browser lets audio start
  ensure() {
    if (typeof window === 'undefined') return
    if (this.ac) {
      if (this.ac.state === 'suspended') this.ac.resume()
      return
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    this.ac = new AC()
    this.master = this.ac.createGain()
    this.master.gain.value = this.muted ? 0 : this.vol
    this.master.connect(this.ac.destination)
    this.eng = makeEngine(this.ac, this.master)
    // iOS: a freshly created context starts 'suspended' and only wakes if we
    // resume + play a silent blip inside this user gesture. Without this there
    // is no sound at all on iPhone.
    if (this.ac.state === 'suspended') this.ac.resume()
    try {
      const blip = this.ac.createBufferSource()
      blip.buffer = this.ac.createBuffer(1, 1, 22050)
      blip.connect(this.ac.destination)
      blip.start(0)
    } catch {
      /* unlock is best-effort */
    }
  }

  play(id: Id) {
    if (!this.eng || !this.ac || this.muted) return
    if (this.ac.state !== 'running') return
    const now = this.ac.currentTime
    const gap = this.cfg.throttle?.[id]
    if (gap) {
      if (now - (this.lastAt[id] ?? -1) < gap / 1000) return
      this.lastAt[id] = now
    }
    const cue = this.patch[id]
    if (cue) cue(this.eng, now + 0.01)
  }

  setMuted(m: boolean) {
    this.muted = m
    if (this.master) this.master.gain.value = m ? 0 : this.vol
    if (typeof window !== 'undefined') localStorage.setItem(`${this.key}.muted`, m ? '1' : '0')
  }
  isMuted() {
    return this.muted
  }
  setVolume(v: number) {
    this.vol = v
    if (this.master && !this.muted) this.master.gain.value = v
    if (typeof window !== 'undefined') localStorage.setItem(`${this.key}.vol`, String(v))
  }
  volume() {
    return this.vol
  }
}
