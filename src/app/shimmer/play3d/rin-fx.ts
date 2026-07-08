// Tiny self-contained juice for rinning (the walker has no shared sfx module). A WebAudio
// blip + a haptic buzz on the bite and the catch; a low slip on a miss. All guarded so a
// blocked AudioContext or an unsupported vibrate just no-ops.

let _ac: AudioContext | null = null
function tone(freq: number, durMs: number, opts: { type?: OscillatorType; gain?: number; slideTo?: number } = {}) {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    _ac = _ac || new AC()
    const t0 = _ac.currentTime, dur = durMs / 1000
    const o = _ac.createOscillator(), g = _ac.createGain()
    o.type = opts.type ?? 'sine'; o.frequency.setValueAtTime(freq, t0)
    if (opts.slideTo) o.frequency.linearRampToValueAtTime(opts.slideTo, t0 + dur)
    g.gain.setValueAtTime(opts.gain ?? 0.06, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    o.connect(g); g.connect(_ac.destination); o.start(t0); o.stop(t0 + dur)
  } catch { /* audio blocked — no-op */ }
}
function buzz(pat: number | number[]) { try { navigator.vibrate?.(pat) } catch { /* unsupported */ } }

export function rinBite() { tone(560, 70, { type: 'triangle', gain: 0.07 }); tone(760, 90, { gain: 0.05 }); buzz(38) }
export function rinCatch() { tone(420, 260, { type: 'triangle', slideTo: 820, gain: 0.07 }); buzz([15, 40]) }
export function rinMiss() { tone(190, 240, { type: 'sawtooth', slideTo: 120, gain: 0.05 }) }
