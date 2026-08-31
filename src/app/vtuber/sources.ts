/**
 * THE OTHER TWO WAYS TO DRIVE A FACE, AND ONE OF THEM EXISTS SO THIS BOX CAN SEE ITS OWN WORK.
 *
 * ★★★ `synthetic()` IS NOT A TOY. The server has no camera, so without it the entire render path
 * — layers, pivot, glow coupling, parallax, compositing — would ship having been reasoned about
 * and never once looked at. PATTERNS' longest-running lesson is that a guard which cannot reach
 * its subject reports "nothing wrong"; a screenshot taken of a page whose driver never runs is
 * the same failure wearing a picture. This driver is deterministic in `t`, so a shot taken at
 * t=1200ms is reproducible, comparable between builds, and can be asserted against.
 *
 * ★ IT IS ALSO THE DEMO MODE. Someone opening /vtuber with no camera permission should see the
 * avatar performing rather than a dead portrait and an error, because the first question anyone
 * has is "what would this even look like" and it should not cost a permission prompt to answer.
 */
import { type ExpressionState, clamp01 } from './expression'

// ── AUDIO: a mouth from a microphone, for when the camera is off ──────────────────────────────
//
// ★★ AMPLITUDE IS NOT LOUDNESS AND RAW RMS MAKES A BAD MOUTH. Speech RMS spans maybe 0.02-0.25
// depending on mic, gain and how close someone sits; a fixed scale is either dead on a quiet mic
// or pinned open on a hot one. So the driver tracks a DECAYING PEAK and normalises against it,
// which self-tunes within a sentence or two and survives someone changing their mic mid-stream.
export class AudioMouth {
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private buf: Float32Array<ArrayBuffer> = new Float32Array(1024)
  private peak = 0.06
  private noise = 0.008

  async start(stream: MediaStream) {
    const Ctx: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.ctx = new Ctx()
    const src = this.ctx.createMediaStreamSource(stream)
    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 2048
    this.buf = new Float32Array(this.analyser.fftSize)
    src.connect(this.analyser)
  }

  stop() { void this.ctx?.close(); this.ctx = null; this.analyser = null }
  get running() { return this.analyser !== null }

  /** 0..1 openness. Returns 0 when not started, never NaN. */
  level(): number {
    if (!this.analyser) return 0
    this.analyser.getFloatTimeDomainData(this.buf)
    let sum = 0
    for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i]
    const rms = Math.sqrt(sum / this.buf.length)
    // Decay the peak so a single door slam does not deafen the rig for the rest of the stream.
    this.peak = Math.max(rms, this.peak * 0.995, 0.02)
    const over = rms - this.noise
    if (over <= 0) return 0
    // sqrt because loudness is perceptual: linear amplitude leaves normal speech near the bottom
    // of the range and the mouth barely parts.
    return clamp01(Math.sqrt(over / (this.peak - this.noise)))
  }
}

export function stateFromAudio(level: number, at: number): ExpressionState {
  return {
    mouthOpen: clamp01(level),
    // A voice cannot report a smile, so the grin widens slightly with emphasis rather than
    // sitting at a constant. Guessing MORE than this from audio reads as a puppet miming.
    mouthWide: clamp01(level * 0.35),
    // ⚠ A microphone cannot hear a pursed mouth. Guessing one from amplitude would put the
    // avatar into an "oh" at random moments, which reads worse than never puckering at all.
    mouthPucker: 0,
    eyeOpenL: 1, eyeOpenR: 1,
    browRaise: clamp01(level * 0.2),
    yaw: 0, pitch: 0, roll: 0,
    source: 'audio',
    at,
  }
}

// ── SYNTHETIC: a deterministic performance, for shots, demos and guards ───────────────────────
//
// Layered incommensurate periods so it never reads as a loop, plus a blink on its own slow clock.
// ⚠ Deliberately NO randomness: a shot of this at a given `t` must be the same shot next week or
// it cannot be compared against anything.
export function synthetic(t: number): ExpressionState {
  const ms = t
  const syll = Math.max(0, Math.sin(ms / 145)) ** 1.6      // syllable rate
  const phrase = 0.5 + 0.5 * Math.sin(ms / 2600)            // speaking vs pausing
  const open = clamp01(syll * phrase * 1.15)
  const blinkPhase = (ms % 4300) / 4300
  const blink = blinkPhase > 0.965 ? 0 : 1                  // ~150ms shut every 4.3s
  return {
    mouthOpen: open,
    mouthWide: clamp01(0.25 + 0.45 * (0.5 + 0.5 * Math.sin(ms / 5100))),
    // ⚠ Correlated with `open` on purpose. The first version ran pucker on its own clock, so
    // the demo puckered while the mouth was shut — which is not a thing a face does, and it
    // made a rig bug look like a driver quirk (and vice versa).
    mouthPucker: clamp01((Math.max(0, Math.sin(ms / 3300)) ** 3) * (0.35 + open)),
    eyeOpenL: blink, eyeOpenR: blink,
    browRaise: clamp01(0.15 + 0.4 * Math.max(0, Math.sin(ms / 3700))),
    yaw:   0.55 * Math.sin(ms / 4100),
    pitch: 0.30 * Math.sin(ms / 5900),
    roll:  0.22 * Math.sin(ms / 6700),
    source: 'idle',
    at: ms,
  }
}
