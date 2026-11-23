// THE KEEPER'S PROPORTIONS (BETA M103, Alex 11-23: "tweak or even mold the body with plenty of sliders ... for each of the 6
// models"). Pure. The 6 models are Frame (Small / Medium / Large) x Torso (Broad / Curved), keeper-look.ts. Each model has a
// set of dials read by buildKeeper (keeper-figure.ts); the owner moves them on the body bench (dev/keeper-body) and saves
// them to keeper-proportions.json through /shimmer/save-keeper-proportions.
// ★ DEFAULTS ARE TODAY'S BODY EXACTLY: a multiplier at 1 and an offset at 0 leave every part where it was, so an empty file
//   (or a dial never moved) changes nothing. keeper-proportions.test.ts pins it.
// ★ FLOATING LIMBS (Alex 11-19, re-said 11-23 "floating limbs stay"): there is no neck, upper arm or leg to size, so "arms"
//   are the hands' size + placement and "legs" are the feet + how high the torso floats above them (legs).
// ⚠ A SAVE IS LIVE IN THE GAME AT THE NEXT DEPLOY (the JSON is imported by the bundle); the bench reads the file live.
import saved from './keeper-proportions.json'
import type { Look } from './keeper-look'

export type DialKind = 'size' | 'spacing'
export interface Dial { key: string; label: string; kind: DialKind; min: number; max: number; step: number; def: number; note: string }

/** every dial, in the bench's order. `def` is today's body. */
export const DIALS = [
  // ── SIZE ──
  { key: 'headW', label: 'Head width', kind: 'size', min: 0.6, max: 1.4, step: 0.01, def: 1, note: 'the head, hair and face together, side to side' },
  { key: 'headH', label: 'Head height', kind: 'size', min: 0.6, max: 1.4, step: 0.01, def: 1, note: 'the head, hair and face together, top to chin' },
  { key: 'jaw', label: 'Chin taper', kind: 'size', min: 0, max: 1, step: 0.01, def: 0, note: '0 = round head (today), 1 = a tapered chin' },
  { key: 'eye', label: 'Eye size', kind: 'size', min: 0.5, max: 1.5, step: 0.01, def: 1, note: 'eye whites + pupils' },
  { key: 'ear', label: 'Ear size', kind: 'size', min: 0.4, max: 1.8, step: 0.01, def: 1, note: '' },
  { key: 'torsoL', label: 'Torso length', kind: 'size', min: 0.6, max: 1.6, step: 0.01, def: 1, note: 'the head rides on top of it' },
  { key: 'torsoW', label: 'Torso width', kind: 'size', min: 0.6, max: 1.5, step: 0.01, def: 1, note: 'the hands stay at its side' },
  { key: 'torsoD', label: 'Torso depth', kind: 'size', min: 0.6, max: 1.5, step: 0.01, def: 1, note: 'front to back' },
  { key: 'scarf', label: 'Scarf', kind: 'size', min: 0.6, max: 1.5, step: 0.01, def: 1, note: 'ring + tail' },
  { key: 'hand', label: 'Hand size', kind: 'size', min: 0.5, max: 1.8, step: 0.01, def: 1, note: '' },
  { key: 'foot', label: 'Foot size', kind: 'size', min: 0.5, max: 1.8, step: 0.01, def: 1, note: 'stays on the ground' },
  // ── SPACING ──
  { key: 'neck', label: 'Neck gap', kind: 'spacing', min: -0.1, max: 0.3, step: 0.005, def: 0, note: 'm, head above the torso' },
  { key: 'legs', label: 'Leg length', kind: 'spacing', min: 0.4, max: 2, step: 0.01, def: 1, note: 'how high the torso floats above the feet' },
  { key: 'handX', label: 'Shoulder width', kind: 'spacing', min: -0.15, max: 0.25, step: 0.005, def: 0, note: 'm, hands out from the torso' },
  { key: 'handY', label: 'Hand height', kind: 'spacing', min: -0.25, max: 0.35, step: 0.005, def: 0, note: 'm, up / down the torso' },
  { key: 'handZ', label: 'Hand forward', kind: 'spacing', min: -0.15, max: 0.2, step: 0.005, def: 0, note: 'm' },
  { key: 'footX', label: 'Stance width', kind: 'spacing', min: -0.1, max: 0.2, step: 0.005, def: 0, note: 'm, feet apart' },
] as const satisfies readonly Dial[]

export type DialKey = typeof DIALS[number]['key']
export type Proportions = Record<DialKey, number>
export const DEFAULT_PROPORTIONS: Proportions = Object.fromEntries(DIALS.map(d => [d.key, d.def])) as Proportions

/** the 6 model ids, frame-torso: 'small-broad' ... 'large-curved' */
export const FRAMES = ['small', 'medium', 'large'] as const
export const TORSOS = ['broad', 'curved'] as const
export const MODELS = FRAMES.flatMap(f => TORSOS.map(t => `${f}-${t}`))
export const modelId = (l: Pick<Look, 'frame' | 'torso'>) => `${FRAMES[l.frame] ?? 'medium'}-${TORSOS[l.torso] ?? 'broad'}`
export const MODEL_LABEL = (id: string) => id.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join(' / ')

/** one model's saved dials, clamped field by field: unknown keys dropped, a missing / bad field takes the default */
export function parseProportions(raw: unknown): Proportions {
  const out = { ...DEFAULT_PROPORTIONS }
  if (!raw || typeof raw !== 'object') return out
  const o = raw as Record<string, unknown>
  for (const d of DIALS) {
    const n = o[d.key]
    if (typeof n === 'number' && Number.isFinite(n)) out[d.key] = Math.min(d.max, Math.max(d.min, n))
  }
  return out
}

/** the whole file: every model present, each clamped. A bad file = all defaults (never throws). */
export function parseFile(raw: unknown): Record<string, Proportions> {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return Object.fromEntries(MODELS.map(m => [m, parseProportions(o[m])]))
}

/** only the dials that differ from today's body (what the file stores, so a diff reads as what Alex changed) */
export function changedOnly(p: Proportions): Partial<Proportions> {
  const out: Partial<Proportions> = {}
  for (const d of DIALS) if (p[d.key] !== d.def) out[d.key] = p[d.key]
  return out
}

const SAVED = parseFile(saved)
/** the shipped proportions for a look's model (from the bundled file) */
export const proportionsFor = (l: Pick<Look, 'frame' | 'torso'>): Proportions => SAVED[modelId(l)] ?? DEFAULT_PROPORTIONS
