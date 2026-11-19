// ── GAME SFX (BETA M36) ─ one registry, one AudioContext, a yay gate ───────────────────────────────────────────────────────
// `sounds.json` is the registry: every sound is proposed | yay | nay, and the GAME PLAYS ONLY `yay`. A proposed or nay sound is
// silent in play; Alex votes on /shimmer/dev/sounds (which POSTs /shimmer/save-sound-vote), and the vote is live at the next deploy.
// The synth recipes live here, in code, modelled on gun-sound.ts and played through ITS context and master bus (one AudioContext).
// Sounds are build/feel, not canon.

import registry from './sounds.json'
import { audio, masterBus, noise } from './gun-sound'

export type SoundStatus = 'proposed' | 'yay' | 'nay'
export type BusName = 'sfx' | 'ui' | 'ambience' | 'music'
export type AreaName = 'open' | 'glade' | 'town' | 'indoor'
export interface SoundLayer { files: string[]; chance: number; vol?: number }
export interface SoundRow { id: string; area: string; status: SoundStatus; note: string; desc?: string; source: 'synth' | 'cc0'; licence?: string; bus?: BusName; files?: string[]; layer?: SoundLayer; /** this sound's own level, 0..1 (default 1): Alex 11-19 'the player sounds come off too loud' -> movement 0.5 */ vol?: number }
export const SOUNDS = registry as unknown as SoundRow[]
export const statusOf = (id: string): SoundStatus | null => SOUNDS.find(s => s.id === id)?.status ?? null
export const BUSES: BusName[] = ['sfx', 'ui', 'ambience', 'music']
export const busOf = (r: SoundRow): BusName => r.bus ?? (r.area === 'ui' ? 'ui' : 'sfx')

export interface V3 { x: number; y: number; z: number }
export interface PlayOpts { vol?: number; pitch?: number; at?: V3 }
type Bus = { c: AudioContext; out: AudioNode; t: number; vol: number; pitch: number }

// ── variation: a random variant (never the same twice running) + a small pitch/volume wobble ──
export const PITCH_WOBBLE = 0.04, VOL_WOBBLE = 0.1
/** index in [0,n), never `last` when n > 1. `rnd` is injectable for tests. */
export function pickVariant(n: number, last: number, rnd: () => number = Math.random): number {
  if (n <= 1) return 0
  if (last < 0 || last >= n) return Math.min(n - 1, Math.floor(rnd() * n))
  const i = Math.min(n - 2, Math.floor(rnd() * (n - 1))); return i >= last ? i + 1 : i
}
export function wobble(rnd: () => number = Math.random) { return { pitch: 1 + (rnd() * 2 - 1) * PITCH_WOBBLE, vol: 1 + (rnd() * 2 - 1) * VOL_WOBBLE } }
const lastPick = new Map<string, number>()
function nextFile(key: string, files: string[]): string | null {
  if (!files.length) return null
  const i = pickVariant(files.length, lastPick.get(key) ?? -1); lastPick.set(key, i); return files[i]
}

// ── mixer: buses under the master, persisted ──
const BUS_KEY = 'open:sfx-buses.v1'
const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1)
let busVols: Record<BusName, number> | null = null
function vols() {
  if (!busVols) {
    busVols = { sfx: 1, ui: 1, ambience: 1, music: 1 }
    try { const j = JSON.parse(localStorage.getItem(BUS_KEY) ?? 'null'); if (j && typeof j === 'object') for (const b of BUSES) if (typeof j[b] === 'number') busVols[b] = clamp01(j[b]) } catch { /* fine */ }
  }
  return busVols
}
export const getBusVolume = (b: BusName) => vols()[b]
const busNodes: Partial<Record<BusName, GainNode>> = {}
export function setBusVolume(b: BusName, v: number) {
  const x = clamp01(v); vols()[b] = x
  const n = busNodes[b]; if (n) n.gain.value = x
  try { localStorage.setItem(BUS_KEY, JSON.stringify(vols())) } catch { /* fine */ }
}
function busNode(c: AudioContext, m: AudioNode, b: BusName): AudioNode {
  let n = busNodes[b]
  if (!n) { n = c.createGain(); n.gain.value = vols()[b]; n.connect(m); busNodes[b] = n }
  return n
}

/** The ambience bus input, for ambience.ts (one mixer, one context). */
export const ambienceBus = (c: AudioContext, m: AudioNode): AudioNode => busNode(c, m, 'ambience')

// ── space: a short generated reverb send per area (decaying noise, no files) ──
const AREAS: Record<AreaName, { secs: number; send: number }> = { open: { secs: 0.2, send: 0.03 }, glade: { secs: 0.9, send: 0.16 }, town: { secs: 0.6, send: 0.18 }, indoor: { secs: 0.45, send: 0.28 } }
let area: AreaName = 'open'
let verb: { conv: ConvolverNode; send: GainNode } | null = null
const irCache = new Map<AreaName, AudioBuffer>()
function impulse(c: AudioContext, a: AreaName): AudioBuffer {
  let b = irCache.get(a); if (b) return b
  const n = Math.max(1, Math.floor(c.sampleRate * AREAS[a].secs)); b = c.createBuffer(2, n, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.5) }
  irCache.set(a, b); return b
}
function reverb(c: AudioContext, m: AudioNode) {
  if (!verb && typeof c.createConvolver === 'function') {
    const conv = c.createConvolver(), send = c.createGain(); conv.buffer = impulse(c, area); send.gain.value = AREAS[area].send
    send.connect(conv); conv.connect(m); verb = { conv, send }
  }
  return verb
}
/** Pick the room: a short reverb send mixed lightly. `open` is almost dry. */
export function setArea(a: AreaName) {
  if (!AREAS[a]) return
  area = a
  const c = audio(); if (!c || !verb) return
  try { verb.conv.buffer = impulse(c, a); verb.send.gain.value = AREAS[a].send } catch { /* fine */ }
}
export const currentArea = () => area

// ── distance + pan ──
let lpos: V3 = { x: 0, y: 0, z: 0 }
/** Once per frame: where the listener is and which way it faces. */
export function setListener(pos: V3, forward: V3) {
  lpos = pos
  const c = audio(); if (!c) return
  try {
    const l = c.listener as AudioListener & { positionX?: AudioParam }
    if (l.positionX) { l.positionX.value = pos.x; l.positionY.value = pos.y; l.positionZ.value = pos.z; l.forwardX.value = forward.x; l.forwardY.value = forward.y; l.forwardZ.value = forward.z; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0 }
    else if (l.setPosition) { l.setPosition(pos.x, pos.y, pos.z); l.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0) }
  } catch { /* fine */ }
}
/** lowpass cutoff for a distance: open at 0, closing towards ~900 Hz. */
export const lowpassFor = (d: number) => Math.max(900, 18000 / (1 + d / 12))

/** Build the per-voice chain and return its input. 2D (no `at`) goes straight to the bus. */
function voiceInput(c: AudioContext, m: AudioNode, bus: BusName, at?: V3): AudioNode {
  const bn = busNode(c, m, bus), tail = c.createGain()
  tail.connect(bn)
  const rv = bus === 'sfx' || bus === 'ambience' ? reverb(c, m) : null
  if (rv) tail.connect(rv.send)
  if (!at) return tail
  const d = Math.hypot(at.x - lpos.x, at.y - lpos.y, at.z - lpos.z)
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = lowpassFor(d); lp.Q.value = 0.5
  const head: AudioNode = lp
  if (typeof c.createPanner === 'function') {
    const p = c.createPanner()
    try { p.panningModel = 'HRTF' } catch { try { p.panningModel = 'equalpower' } catch { /* fine */ } }
    p.distanceModel = 'inverse'; p.refDistance = 4; p.rolloffFactor = 1; p.maxDistance = 80
    if (p.positionX) { p.positionX.value = at.x; p.positionY.value = at.y; p.positionZ.value = at.z } else p.setPosition?.(at.x, at.y, at.z)
    lp.connect(p); p.connect(tail)
  } else lp.connect(tail)
  return head
}

// ── recorded samples: fetched + decoded lazily, cached per url, a failure is silent ──
const samples = new Map<string, AudioBuffer | 'loading' | 'fail'>()
function load(c: AudioContext, url: string) {
  if (samples.has(url)) return
  samples.set(url, 'loading')
  try {
    void fetch(url).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer() }).then(b => c.decodeAudioData(b)).then(buf => { samples.set(url, buf) }).catch(() => { samples.set(url, 'fail') })
  } catch { samples.set(url, 'fail') }
}
/** Warm the cache for a row so its first play is not silent. Never throws, never blocks. */
export function preload(id: string) {
  const r = SOUNDS.find(s => s.id === id), c = audio(); if (!r?.files || !c) return
  for (const f of [...r.files, ...(r.layer?.files ?? [])]) load(c, f)
}
export const sampleState = (url: string) => { const s = samples.get(url); return s === undefined ? 'none' : typeof s === 'string' ? s : 'ready' }
function sample(b: Bus, url: string, vol: number) {
  const s = samples.get(url)
  if (s === undefined) { load(b.c, url); return }   // not loaded yet: silent this time, ready next
  if (typeof s === 'string') return
  const src = b.c.createBufferSource(), g = b.c.createGain(); src.buffer = s; src.playbackRate.value = b.pitch; g.gain.value = b.vol * vol
  src.connect(g).connect(b.out); src.start(b.t)
}

function env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
}
/** a filtered noise burst */
function puff(b: Bus, type: BiquadFilterType, freq: number, q: number, gain: number, attack: number, decay: number, at = 0) {
  const t = b.t + at, s = b.c.createBufferSource(); s.buffer = noise(b.c)
  const f = b.c.createBiquadFilter(); f.type = type; f.frequency.value = freq * b.pitch; f.Q.value = q
  const g = b.c.createGain(); env(g, t, gain * b.vol, attack, decay)
  s.connect(f).connect(g).connect(b.out); s.start(t, Math.random()); s.stop(t + attack + decay + 0.05)
}
/** a pitched tone, optionally gliding */
function tone(b: Bus, type: OscillatorType, from: number, to: number, gain: number, attack: number, decay: number, at = 0) {
  const t = b.t + at, o = b.c.createOscillator(), g = b.c.createGain()
  o.type = type; o.frequency.setValueAtTime(from * b.pitch, t); o.frequency.exponentialRampToValueAtTime(Math.max(to * b.pitch, 10), t + attack + decay)
  env(g, t, gain * b.vol, attack, decay); o.connect(g).connect(b.out); o.start(t); o.stop(t + attack + decay + 0.05)
}

const RECIPES: Record<string, (b: Bus) => void> = {
  'step-grass': b => { puff(b, 'bandpass', 1400, 0.7, 0.09, 0.006, 0.07); puff(b, 'lowpass', 350, 0.7, 0.06, 0.003, 0.05) },   // r2: softer (Alex)
  'step-stone': b => { tone(b, 'triangle', 2600, 2300, 0.12, 0.001, 0.025); puff(b, 'highpass', 4000, 1, 0.06, 0.001, 0.012); tone(b, 'triangle', 2100, 1900, 0.09, 0.001, 0.022, 0.04) },   // r2: domino click-clack (Alex)
  'step-wood': b => { tone(b, 'sine', 130, 65, 0.26, 0.002, 0.12); puff(b, 'bandpass', 320, 4, 0.12, 0.002, 0.1); tone(b, 'sawtooth', 210, 260, 0.018, 0.03, 0.14, 0.05) },   // r2: hollow thud + soft creak (Alex)
  'jump': b => { tone(b, 'sine', 95, 50, 0.3, 0.002, 0.09); puff(b, 'lowpass', 500, 0.6, 0.28, 0.003, 0.11); puff(b, 'bandpass', 900, 0.7, 0.1, 0.03, 0.16, 0.03); puff(b, 'bandpass', 2200, 0.7, 0.06, 0.04, 0.14, 0.05) },   // r3: heavier push-off thump + a body swish (r2 + recorded nay)
  'air-jump': b => { puff(b, 'bandpass', 1600, 0.6, 0.16, 0.015, 0.2); tone(b, 'sine', 330, 620, 0.07, 0.01, 0.16); puff(b, 'lowpass', 700, 0.6, 0.12, 0.004, 0.08) },   // new 11-19: double jump = an airy whoosh up + a soft kick
  'slide': b => { puff(b, 'bandpass', 2400, 0.6, 0.16, 0.02, 0.5); puff(b, 'bandpass', 1100, 0.5, 0.12, 0.03, 0.42, 0.04); puff(b, 'lowpass', 420, 0.6, 0.1, 0.01, 0.3) },   // new 11-19: grassy swoosh fading as the slide bleeds off
  'land': b => { tone(b, 'sine', 120, 60, 0.16, 0.002, 0.08); puff(b, 'lowpass', 700, 0.5, 0.26, 0.012, 0.22); puff(b, 'bandpass', 1100, 0.6, 0.08, 0.02, 0.18, 0.03) },   // r2: pushing dirt (Alex)
  'hit-axe-tree': b => { tone(b, 'triangle', 220, 80, 0.34, 0.001, 0.09); puff(b, 'highpass', 3500, 1, 0.18, 0.001, 0.02); puff(b, 'bandpass', 1300, 1.6, 0.2, 0.001, 0.045) },   // r2: sharper (Alex)
  'hit-prune-tree': b => { puff(b, 'highpass', 3200, 1, 0.14, 0.001, 0.04); puff(b, 'bandpass', 2200, 1, 0.12, 0.003, 0.12, 0.03) },
  'hit-pick-crystal': b => { tone(b, 'triangle', 1900, 1700, 0.18, 0.001, 0.14); puff(b, 'highpass', 5000, 1, 0.1, 0.001, 0.03) },
  'hit-prospect-crystal': b => { tone(b, 'sine', 2400, 2300, 0.14, 0.001, 0.3); tone(b, 'sine', 3100, 3000, 0.07, 0.001, 0.22); puff(b, 'highpass', 6000, 1, 0.06, 0.001, 0.02) },
  'pickup-grey-matter': b => { tone(b, 'sine', 300, 340, 0.16, 0.01, 0.09); tone(b, 'sine', 420, 440, 0.1, 0.01, 0.1, 0.05) },
  'pickup-item': b => { tone(b, 'triangle', 660, 680, 0.14, 0.004, 0.07); tone(b, 'triangle', 990, 1000, 0.12, 0.004, 0.1, 0.07) },
  'ui-tap': b => { tone(b, 'sine', 1300, 1100, 0.1, 0.001, 0.03) },
  'ui-panel-open': b => { puff(b, 'bandpass', 900, 1, 0.09, 0.03, 0.1); tone(b, 'sine', 400, 700, 0.06, 0.02, 0.1) },
  'ui-panel-close': b => { puff(b, 'bandpass', 1300, 1, 0.08, 0.02, 0.09); tone(b, 'sine', 700, 380, 0.06, 0.015, 0.09) },
}

function run(id: string, o: PlayOpts) {
  const row = SOUNDS.find(s => s.id === id); if (!row) return
  const files = row.files?.length ? row.files : null, r = files ? null : RECIPES[id]
  if (!files && !r) return
  const c = audio(), m = masterBus(); if (!c || !m) return
  try {
    const w = wobble(), out = voiceInput(c, m, busOf(row), o.at)
    const b: Bus = { c, out, t: c.currentTime + 0.003, vol: (o.vol ?? 1) * (row.vol ?? 1) * w.vol, pitch: (o.pitch ?? 1) * w.pitch }
    if (r) { r(b); return }
    const f = nextFile(id, files!); if (f) sample(b, f, 1)
    const L = row.layer
    if (L && Math.random() < L.chance) { const lf = nextFile(id + '#layer', L.files); if (lf) sample(b, lf, L.vol ?? 1) }
  } catch { /* a sound never breaks the game */ }
}
/** Play a sound IN THE GAME. Only a `yay` sound makes noise; proposed and nay are silent. `at` = positional (3D); none = 2D. */
/** probe for checks (sfx-check.mts): how many times each yay id was played this page */
const played: Record<string, number> = {}
if (typeof window !== 'undefined') (window as unknown as { __sfx?: object }).__sfx = { played: () => ({ ...played }) }
export function play(id: string, opts: PlayOpts = {}) { if (statusOf(id) === 'yay') { played[id] = (played[id] ?? 0) + 1; run(id, opts) } }
/** The review page's play button: sounds regardless of status. Never call from the game. */
export function audition(id: string) { run(id, {}) }

// ── the walker's feet: footsteps on the step cadence, jump and land on the air edge ──
/** The surface underfoot. ⚠ The walker's world (LocoWorld) knows floor height and water, not what the floor is made of, so
 *  this is grass everywhere until a surface query exists. */
export type Surface = 'grass' | 'stone' | 'wood'
export const surfaceUnder = (): Surface => 'grass'
export const STRIDE = 1.9   // metres of ground covered per footfall
let strideLeft = STRIDE, wasAir = false
export interface FeetState { px: number; pz: number; hvx: number; hvz: number; vy: number; airborne: boolean; swimming?: boolean; sliding?: boolean; justAirJumped?: boolean }
let wasSliding = false
/** One call per walker frame, after the locomotion tick. */
export function tickFeet(lc: FeetState, dt: number, surface: Surface = surfaceUnder()) {
  const air = lc.airborne && !lc.swimming
  if (air && !wasAir && lc.vy > 0) play('jump')
  if (lc.justAirJumped) play('air-jump')   // the double jump (one-tick edge from locomotion)
  if (!air && wasAir) { play('land'); strideLeft = STRIDE }
  wasAir = air
  if (lc.sliding && !wasSliding) play('slide')   // the slide's start; no footsteps while it lasts
  wasSliding = !!lc.sliding
  if (air || lc.swimming || lc.sliding) return
  const sp = Math.hypot(lc.hvx, lc.hvz)
  if (sp < 0.5) { strideLeft = Math.min(strideLeft, STRIDE * 0.5); return }
  strideLeft -= sp * dt
  if (strideLeft <= 0) { strideLeft += STRIDE; play(`step-${surface}`, { pitch: 0.94 + Math.random() * 0.12 }) }
}
