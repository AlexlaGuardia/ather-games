// MANA'NANA commentator — a cozy British sportscaster (ElevenLabs "George").
// Pre-baked clips in /public/manana/vo, played reactively on game state.
// The whole feel lives in the THROTTLE: a hard global cooldown + per-trigger
// probability keep it sparse and warm, never Candy-Crush chatter. Big moments
// (a Star, running out of moves, game over) can talk over the cooldown by
// priority; ordinary combos stay quiet more often than not.

export type VoTrigger =
  | 'start' | 'nice' | 'impressive' | 'big' | 'low_moves' | 'milestone' | 'shuffle' | 'over'

// how often a trigger is *allowed* to speak (before the cooldown even applies).
// low = the cozy dial: nice combos mostly stay silent so a spoken line feels earned.
const PROB: Record<VoTrigger, number> = {
  start: 1, nice: 0.4, impressive: 0.85, big: 1, low_moves: 1, milestone: 0.85, shuffle: 0.9, over: 1,
}
// a higher-priority beat may interrupt the cooldown (and a playing clip).
const PRIORITY: Record<VoTrigger, number> = {
  over: 5, big: 4, low_moves: 4, milestone: 3, impressive: 3, shuffle: 2, start: 2, nice: 1,
}

const MIN_GAP_MS = 2800 // no two lines closer than this unless out-prioritised

type Manifest = Partial<Record<VoTrigger, string[]>>

class VoBank {
  private manifest: Manifest | null = null
  private loading: Promise<void> | null = null
  private cache = new Map<string, HTMLAudioElement>()
  private muted = false
  private volume = 0.9
  private cooldownUntil = 0
  private playingPri = 0
  private current: HTMLAudioElement | null = null
  private lastIdx: Partial<Record<VoTrigger, number>> = {}
  private onSpeak: (() => void) | null = null // fired when a line actually plays (music ducks off this)

  constructor() {
    if (typeof window !== 'undefined') {
      this.muted = localStorage.getItem('manana.vo.muted') === '1'
    }
  }

  // fetch the manifest + warm the audio elements. Safe to call repeatedly.
  ensure(): Promise<void> {
    if (this.manifest) return Promise.resolve()
    if (this.loading) return this.loading
    this.loading = fetch('/manana/vo/manifest.json')
      .then((r) => r.json())
      .then((m: Manifest) => {
        this.manifest = m
        for (const files of Object.values(m)) {
          for (const fn of files ?? []) {
            const a = new Audio(`/manana/vo/${fn}`)
            a.preload = 'auto'
            this.cache.set(fn, a)
          }
        }
      })
      .catch(() => { this.manifest = {} }) // fail silent — VO is garnish, never blocks play
    return this.loading
  }

  setMuted(m: boolean) {
    this.muted = m
    if (typeof window !== 'undefined') localStorage.setItem('manana.vo.muted', m ? '1' : '0')
    if (m && this.current) { this.current.pause(); this.playingPri = 0 }
  }
  isMuted() { return this.muted }
  setVolume(v: number) { this.volume = Math.max(0, Math.min(1, v)) }
  setOnSpeak(fn: () => void) { this.onSpeak = fn }

  play(trigger: VoTrigger) {
    if (this.muted || typeof window === 'undefined') return
    const files = this.manifest?.[trigger]
    if (!files || !files.length) { void this.ensure(); return } // not warm yet — skip, no queue
    if (Math.random() > PROB[trigger]) return // sparse by design

    const now = performance.now()
    const pri = PRIORITY[trigger]
    if (now < this.cooldownUntil && pri <= this.playingPri) return // throttled

    // pick a clip, avoiding an immediate repeat of the same line
    let i = Math.floor(Math.random() * files.length)
    if (files.length > 1 && i === this.lastIdx[trigger]) i = (i + 1) % files.length
    this.lastIdx[trigger] = i
    const el = this.cache.get(files[i])
    if (!el) return

    if (this.current && !this.current.paused) this.current.pause() // interrupt lower-pri line
    el.currentTime = 0
    el.volume = this.volume
    this.current = el
    this.playingPri = pri
    this.cooldownUntil = now + MIN_GAP_MS
    el.onended = () => { if (this.current === el) this.playingPri = 0 }
    el.play().then(() => this.onSpeak?.()).catch(() => { this.playingPri = 0 }) // duck music only once the line truly starts
  }

  // call when moves climb back up (milestone / new game) so low-moves can re-arm
  reset() { this.cooldownUntil = 0; this.playingPri = 0 }
}

export const vo = new VoBank()
