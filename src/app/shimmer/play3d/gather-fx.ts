// Tiny self-contained juice for gathering (forestry/prospecting), matching rin-fx for fishing.
// A working "thunk" per chop/mine tick while channeling, and a bright pop + buzz on the grant.
// All guarded so a blocked AudioContext / unsupported vibrate just no-ops.

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

// per-skill working tick: forestry = a low wooden thunk, prospecting = a higher rock clink.
export function gatherTick(skill: string) {
  if (skill === 'prospecting') tone(680, 70, { type: 'square', gain: 0.035, slideTo: 520 })
  else tone(150, 90, { type: 'triangle', gain: 0.05, slideTo: 110 }) // forestry / default
}

// the payoff: a bright two-note pop + a short buzz when a harvest lands.
export function gatherPop() {
  tone(520, 90, { type: 'triangle', gain: 0.06 })
  tone(780, 140, { type: 'sine', gain: 0.05, slideTo: 920 })
  buzz(20)
}
