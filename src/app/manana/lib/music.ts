// MANA'NANA music bed — a warm looping backdrop, ducked under the commentator.
// Web Audio (not a plain <audio> tag) for two reasons: gapless looping of an
// MP3 (whose encoder padding would click on a tag loop), and a real GainNode so
// a spoken line can dip the music ~1s then swell back — voice always cuts through.

const BASE_VOL = 0.32   // quiet bed: sits under sfx (~0.45) and VO (~0.9)
const DUCK_TO = 0.4     // dip music to 40% of base while George talks
const DUCK_DIP_S = 0.08 // fast step down
const DUCK_RECOVER_S = 1.1 // gentle swell back over roughly a line's length

class Music {
  private ctx: AudioContext | null = null
  private gain: GainNode | null = null
  private buffer: AudioBuffer | null = null
  private source: AudioBufferSourceNode | null = null
  private loading: Promise<void> | null = null
  private muted = false
  private started = false

  constructor() {
    if (typeof window !== 'undefined') this.muted = localStorage.getItem('manana.vo.muted') === '1'
  }

  // create the context + decode the track. Safe pre-gesture (decode works suspended).
  ensure(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve()
    if (this.buffer) return Promise.resolve()
    if (this.loading) return this.loading
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.ctx = new AC()
    this.gain = this.ctx.createGain()
    this.gain.gain.value = this.muted ? 0 : BASE_VOL
    this.gain.connect(this.ctx.destination)
    this.loading = fetch('/manana/music.mp3')
      .then((r) => r.arrayBuffer())
      .then((buf) => this.ctx!.decodeAudioData(buf))
      .then((decoded) => { this.buffer = decoded })
      .catch(() => { /* music is garnish — never block play */ })
    return this.loading
  }

  // begin the loop. Needs a user gesture to resume the context; idempotent.
  start() {
    if (typeof window === 'undefined') return
    void this.ensure().then(() => {
      if (!this.ctx || !this.buffer || !this.gain) return
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      if (this.started) return
      const src = this.ctx.createBufferSource()
      src.buffer = this.buffer
      src.loop = true // gapless loop of the decoded PCM
      src.connect(this.gain)
      src.start()
      this.source = src
      this.started = true
    })
  }

  // halt the loop + park the audio thread when the game unmounts, so the bed
  // doesn't keep playing after you navigate away. Keeps the decoded buffer +
  // context so returning to the game restarts instantly (no re-decode).
  stop() {
    if (this.source) {
      try { this.source.stop() } catch { /* already stopped */ }
      try { this.source.disconnect() } catch { /* fine */ }
      this.source = null
    }
    this.started = false
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend()
  }

  setMuted(m: boolean) {
    this.muted = m
    if (typeof window !== 'undefined') localStorage.setItem('manana.vo.muted', m ? '1' : '0')
    if (this.gain && this.ctx) {
      const now = this.ctx.currentTime
      this.gain.gain.cancelScheduledValues(now)
      this.gain.gain.setTargetAtTime(m ? 0 : BASE_VOL, now, 0.05)
    }
    if (!m) this.start() // unmuting kicks it off if the game's already running
  }

  setVolume(v: number) {
    if (this.gain && this.ctx && !this.muted) this.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), this.ctx.currentTime, 0.05)
  }

  // dip under a spoken line, then swell back. Called whenever the commentator speaks.
  duck() {
    if (!this.gain || !this.ctx || this.muted) return
    const now = this.ctx.currentTime
    const g = this.gain.gain
    g.cancelScheduledValues(now)
    g.setValueAtTime(g.value, now)
    g.linearRampToValueAtTime(BASE_VOL * DUCK_TO, now + DUCK_DIP_S)
    g.linearRampToValueAtTime(BASE_VOL, now + DUCK_RECOVER_S)
  }
}

export const music = new Music()
