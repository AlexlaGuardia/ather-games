/**
 * Magii Audio Engine
 *
 * Hearthstone-inspired tavern soundscape via Web Audio API.
 * All SFX synthesized procedurally — no external files needed.
 * Background MUSIC is no longer owned here — it rides the shared hub bed
 * (lib/hub-audio.ts) so the same track carries continuously from the Room's
 * Mug door into the tavern. This engine keeps only the SFX + mute state.
 */

import { getHubAudio } from '@/lib/hub-audio'

export type SoundName =
  | 'card-draw' | 'card-place' | 'card-hover'
  | 'button-click' | 'turn-start' | 'magii-call'
  | 'double-down' | 'victory' | 'defeat' | 'game-start'

export interface Volumes {
  master: number
  sfx: number
  ambient: number
  music: number
}

class MagiiAudio {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private ambientGain: GainNode | null = null
  private ambientNodes: (AudioBufferSourceNode | OscillatorNode)[] = []
  private crackleTimer: ReturnType<typeof setTimeout> | null = null
  private logTimer: ReturnType<typeof setTimeout> | null = null
  private ready = false
  private _muted = false
  private _volumes: Volumes = { master: 0.7, sfx: 0.8, ambient: 0.3, music: 0.15 }
  private lastHover = 0
  private listeners = new Set<() => void>()

  /** Subscribe to state changes for React UI */
  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }
  private notify() { this.listeners.forEach(fn => fn()) }

  async init() {
    if (this.ready) {
      if (this.ctx?.state === 'suspended') await this.ctx.resume()
      return
    }
    this.ctx = new AudioContext()

    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = this._volumes.master
    this.masterGain.connect(this.ctx.destination)

    this.sfxGain = this.ctx.createGain()
    this.sfxGain.gain.value = this._volumes.sfx
    this.sfxGain.connect(this.masterGain)

    this.ambientGain = this.ctx.createGain()
    this.ambientGain.gain.value = 0
    this.ambientGain.connect(this.masterGain)

    this.ready = true
    this.buildAmbient()
    // Music = the shared hub bed. If you arrived through the Room, it's already
    // playing (open it to the in-game level); if you landed here directly, this
    // gesture starts it. Inherit the room's mute choice.
    const hub = getHubAudio()
    this._muted = hub.muted
    hub.start()
    hub.open()
    this.notify()
  }

  // ── Ambient Tavern Layer ──────────────────────────────────────

  private buildAmbient() {
    // Ambient disabled — cosmic tracks carry the atmosphere
  }

  // Background music now lives in the shared hub bed (lib/hub-audio.ts) — see init().

  // ── SFX ───────────────────────────────────────────────────────

  play(sound: SoundName) {
    if (!this.ctx || !this.sfxGain || this._muted) return
    if (this.ctx.state === 'suspended') this.ctx.resume()

    // Debounce hover sounds (80ms)
    if (sound === 'card-hover') {
      const now = Date.now()
      if (now - this.lastHover < 80) return
      this.lastHover = now
    }

    const t = this.ctx.currentTime
    switch (sound) {
      case 'card-draw':    return this.sCardDraw(t)
      case 'card-place':   return this.sCardPlace(t)
      case 'card-hover':   return this.sCardHover(t)
      case 'button-click': return this.sClick(t)
      case 'turn-start':   return this.sTurnChime(t)
      case 'magii-call':   return this.sMagiiCall(t)
      case 'double-down':  return this.sDoubleDown(t)
      case 'victory':      return this.sVictory(t)
      case 'defeat':       return this.sDefeat(t)
      case 'game-start':   return this.sGameStart(t)
    }
  }

  // Card sliding off deck — quick filtered noise sweep
  private sCardDraw(t: number) {
    const ctx = this.ctx!
    const dur = 0.15
    const n = this.noise(dur)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(800, t)
    bp.frequency.exponentialRampToValueAtTime(2200, t + dur)
    bp.Q.value = 2
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.3, t)
    g.gain.exponentialRampToValueAtTime(0.01, t + dur)
    n.connect(bp); bp.connect(g); g.connect(this.sfxGain!)
    n.start(t); n.stop(t + dur)
  }

  // Card hitting table — low thump + texture
  private sCardPlace(t: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(120, t)
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.35, t)
    g.gain.exponentialRampToValueAtTime(0.01, t + 0.12)
    o.connect(g); g.connect(this.sfxGain!)
    o.start(t); o.stop(t + 0.12)

    const n = this.noise(0.05)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = 900
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.15, t)
    ng.gain.exponentialRampToValueAtTime(0.01, t + 0.05)
    n.connect(lp); lp.connect(ng); ng.connect(this.sfxGain!)
    n.start(t); n.stop(t + 0.05)
  }

  // Subtle high ping on hover
  private sCardHover(t: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = 2400
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.06, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
    o.connect(g); g.connect(this.sfxGain!)
    o.start(t); o.stop(t + 0.05)
  }

  // Crisp UI click
  private sClick(t: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = 1800
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.15, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.03)
    o.connect(g); g.connect(this.sfxGain!)
    o.start(t); o.stop(t + 0.03)
  }

  // Your turn — gentle two-note chime (major third)
  private sTurnChime(t: number) {
    const ctx = this.ctx!
    ;[523, 659].forEach((freq, i) => {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = freq
      const s = t + i * 0.12
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, s)
      g.gain.linearRampToValueAtTime(0.18, s + 0.02)
      g.gain.exponentialRampToValueAtTime(0.01, s + 0.4)
      o.connect(g); g.connect(this.sfxGain!)
      o.start(s); o.stop(s + 0.4)
    })
  }

  // Dramatic magical ascending sweep + shimmer + chord
  private sMagiiCall(t: number) {
    const ctx = this.ctx!
    // Rising sweep
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.setValueAtTime(200, t)
    o.frequency.exponentialRampToValueAtTime(1200, t + 0.6)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.3, t + 0.1)
    g.gain.setValueAtTime(0.3, t + 0.4)
    g.gain.exponentialRampToValueAtTime(0.01, t + 0.8)
    o.connect(g); g.connect(this.sfxGain!)
    o.start(t); o.stop(t + 0.8)

    // High shimmer
    const n = this.noise(0.5)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(3000, t)
    bp.frequency.exponentialRampToValueAtTime(6000, t + 0.5)
    bp.Q.value = 5
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0, t + 0.1)
    ng.gain.linearRampToValueAtTime(0.08, t + 0.3)
    ng.gain.exponentialRampToValueAtTime(0.01, t + 0.5)
    n.connect(bp); bp.connect(ng); ng.connect(this.sfxGain!)
    n.start(t); n.stop(t + 0.5)

    // Resolving chord at peak (C5-E5-G5)
    ;[523, 659, 784].forEach(f => {
      const co = ctx.createOscillator()
      co.type = 'sine'
      co.frequency.value = f
      const cg = ctx.createGain()
      cg.gain.setValueAtTime(0, t + 0.4)
      cg.gain.linearRampToValueAtTime(0.1, t + 0.5)
      cg.gain.exponentialRampToValueAtTime(0.01, t + 1.0)
      co.connect(cg); cg.connect(this.sfxGain!)
      co.start(t + 0.4); co.stop(t + 1.0)
    })
  }

  // Stakes raising — low impact boom
  private sDoubleDown(t: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(80, t)
    o.frequency.exponentialRampToValueAtTime(30, t + 0.3)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.4, t)
    g.gain.exponentialRampToValueAtTime(0.01, t + 0.3)
    o.connect(g); g.connect(this.sfxGain!)
    o.start(t); o.stop(t + 0.3)

    const n = this.noise(0.07)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = 500
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.2, t)
    ng.gain.exponentialRampToValueAtTime(0.01, t + 0.07)
    n.connect(lp); lp.connect(ng); ng.connect(this.sfxGain!)
    n.start(t); n.stop(t + 0.07)
  }

  // Triumphant ascending arpeggio (C5-E5-G5-C6)
  private sVictory(t: number) {
    const ctx = this.ctx!
    ;[523, 659, 784, 1047].forEach((f, i) => {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const s = t + i * 0.15
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, s)
      g.gain.linearRampToValueAtTime(0.22, s + 0.03)
      g.gain.exponentialRampToValueAtTime(0.01, s + 0.6)
      o.connect(g); g.connect(this.sfxGain!)
      o.start(s); o.stop(s + 0.6)
    })
  }

  // Somber descending phrase (G4-F4-Eb4)
  private sDefeat(t: number) {
    const ctx = this.ctx!
    ;[392, 349, 311].forEach((f, i) => {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const s = t + i * 0.2
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, s)
      g.gain.linearRampToValueAtTime(0.18, s + 0.03)
      g.gain.exponentialRampToValueAtTime(0.01, s + 0.5)
      o.connect(g); g.connect(this.sfxGain!)
      o.start(s); o.stop(s + 0.5)
    })
  }

  // Card shuffle + settling tone
  private sGameStart(t: number) {
    const ctx = this.ctx!
    for (let i = 0; i < 4; i++) {
      const n = this.noise(0.05)
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 1500 + i * 300
      bp.Q.value = 2
      const s = t + i * 0.07
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.12, s)
      g.gain.exponentialRampToValueAtTime(0.01, s + 0.05)
      n.connect(bp); bp.connect(g); g.connect(this.sfxGain!)
      n.start(s); n.stop(s + 0.05)
    }
    // Settling tone
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = 440
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t + 0.3)
    g.gain.linearRampToValueAtTime(0.14, t + 0.35)
    g.gain.exponentialRampToValueAtTime(0.01, t + 0.75)
    o.connect(g); g.connect(this.sfxGain!)
    o.start(t + 0.3); o.stop(t + 0.75)
  }

  // ── Helpers ───────────────────────────────────────────────────

  private noise(dur: number): AudioBufferSourceNode {
    const ctx = this.ctx!
    const samples = Math.ceil(ctx.sampleRate * dur)
    const buf = ctx.createBuffer(1, samples, ctx.sampleRate)
    const ch = buf.getChannelData(0)
    for (let i = 0; i < samples; i++) ch[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    return src
  }

  // ── Volume Control ────────────────────────────────────────────

  setVolume(cat: keyof Volumes, val: number) {
    this._volumes[cat] = Math.max(0, Math.min(1, val))
    const t = this.ctx?.currentTime ?? 0
    if (this.masterGain) this.masterGain.gain.setValueAtTime(this._volumes.master, t)
    if (this.sfxGain) this.sfxGain.gain.setValueAtTime(this._volumes.sfx, t)
    if (this.ambientGain) this.ambientGain.gain.setValueAtTime(this._volumes.ambient, t)
    this.notify()
  }

  get volumes(): Volumes { return { ...this._volumes } }
  get muted(): boolean { return this._muted }
  get isReady(): boolean { return this.ready }

  toggleMute(): boolean {
    this._muted = !this._muted
    const t = this.ctx?.currentTime ?? 0
    if (this._muted) {
      this.masterGain?.gain.setValueAtTime(0, t)
    } else {
      this.masterGain?.gain.setValueAtTime(this._volumes.master, t)
    }
    getHubAudio().setMuted(this._muted) // mute the shared music bed too
    this.notify()
    return this._muted
  }

  destroy() {
    if (this.crackleTimer) { clearTimeout(this.crackleTimer); this.crackleTimer = null }
    if (this.logTimer) { clearTimeout(this.logTimer); this.logTimer = null }
    this.ambientNodes.forEach(n => { try { n.stop() } catch {} })
    this.ambientNodes = []
    this.ctx?.close()
    this.ctx = null
    this.ready = false
    this.notify()
  }
}

// Singleton
let instance: MagiiAudio | null = null
export function getMagiiAudio(): MagiiAudio {
  if (!instance) instance = new MagiiAudio()
  return instance
}
