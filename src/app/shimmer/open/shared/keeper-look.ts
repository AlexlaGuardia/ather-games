// THE KEEPER'S LOOK (BETA M29, Alex 11-18/19, mock signed off: docs/looks/keeper-creator.html, ref
// docs/looks/refs/keeper-doodle-alex-2026-11-18.jpg). Pure: the options, the defaults, the save and the ONE PvP choice.
// Every keeper has FLOATING LIMBS (Alex 11-19: no body option, no legs colour); no age, no clothes types. Look-only except
// FRAME: Small = a smaller hitbox and +5% move speed, Medium = the baseline, Large = a bigger hitbox and +10% defence.
// Saved per keeper (open.look.v1, KEEPER_KEY_SPECS) so it swaps with the roster and rides the cloud save.

export const SKIN = ['#f6d7bd', '#e8b98f', '#c98e62', '#9c6644', '#6e4630', '#4a2f22'] as const
export const HAIR = ['#1f1914', '#4a3020', '#7a4a26', '#b07a3c', '#d9b770', '#9a9a96', '#e9e6df', '#7a2f1e'] as const
export const CLOTH = ['#4f7c8a', '#7a8a4f', '#8a4f4f', '#5a4f8a', '#c9a06a', '#3f3a33', '#d8d0c0', '#2f4a5e'] as const
export const SCARF = ['#b3473a', '#d9a441', '#4f7c8a', '#5a8a4f', '#7a4f8a', '#e9e6df', '#2f2a26'] as const

export const OPT = {
  frame: ['Small', 'Medium', 'Large'],
  torso: ['Broad', 'Curved'],
  skin: SKIN,
  hairStyle: ['Short', 'Tousled', 'Spiky', 'Swept', 'Bob', 'Long', 'Bun', 'Tail'],
  hair: HAIR,
  eyes: ['Lines', 'Dots', 'Round', 'Bright', 'Wide', 'Happy', 'Sleepy', 'Wink'],
  brows: ['Soft', 'Bold', 'None'],
  mouth: ['Smile', 'Grin', 'Smirk', 'Flat', 'Open', 'Cat'],
  topColor: CLOTH,
  accent: CLOTH,
  scarf: SCARF,
} as const
export type LookKey = keyof typeof OPT
/** the creator's rows, in order, with their labels (the mock's) */
export const ROWS: readonly { key: LookKey; label: string; swatch: boolean }[] = [
  { key: 'frame', label: 'Frame', swatch: false }, { key: 'torso', label: 'Torso', swatch: false }, { key: 'skin', label: 'Skin', swatch: true },
  { key: 'hairStyle', label: 'Hair', swatch: false }, { key: 'hair', label: 'Hair colour', swatch: true }, { key: 'eyes', label: 'Eyes', swatch: false },
  { key: 'brows', label: 'Brows', swatch: false }, { key: 'mouth', label: 'Mouth', swatch: false }, { key: 'topColor', label: 'Body colour', swatch: true },
  { key: 'accent', label: 'Hands and feet', swatch: true }, { key: 'scarf', label: 'Scarf', swatch: true },
]
export const FRAME_NOTE = ['A smaller hitbox and +5% move speed.', 'The baseline: no bonus.', 'A bigger hitbox and +10% defence.'] as const

export type Look = { v: 1 } & Record<LookKey, number>
/** the mock's starting keeper */
export const DEFAULT_LOOK: Look = { v: 1, frame: 1, torso: 0, skin: 1, hairStyle: 1, hair: 2, eyes: 0, brows: 0, mouth: 0, topColor: 0, accent: 5, scarf: 0 }

// ── the ONE PvP choice ──
/** what FRAME does in play: `hit` scales the keeper's hitbox (radius + reach tests), `speed` the walk/run, `damage` what a hit
 *  takes. Small: hit 0.88, speed 1.05. Large: hit 1.16, damage 0.9 (+10% defence). Read by combat and the walker. */
export const FRAME_STATS = [
  { hit: 0.88, speed: 1.05, damage: 1 },
  { hit: 1, speed: 1, damage: 1 },
  { hit: 1.16, speed: 1, damage: 0.9 },
] as const
export const frameStats = (l: Look) => FRAME_STATS[l.frame] ?? FRAME_STATS[1]

/** A saved look, clamped field by field (an unknown or out-of-range field takes the default; never throws). */
export function parseLook(raw: unknown): Look | null {
  const o = raw as Partial<Look> | null
  if (!o || typeof o !== 'object' || o.v !== 1) return null
  const out = { ...DEFAULT_LOOK }
  for (const k of Object.keys(OPT) as LookKey[]) {
    const n = o[k]
    if (Number.isInteger(n) && (n as number) >= 0 && (n as number) < OPT[k].length) out[k] = n as number
  }
  return out
}
export const setLook = (l: Look, k: LookKey, i: number): Look => (i >= 0 && i < OPT[k].length ? { ...l, [k]: i } : l)
/** A random keeper (every row drawn fairly). Frame is left as it was: it's the one PvP choice, so it is never rolled for you. */
export function randomLook(l: Look, rnd: () => number = Math.random): Look {
  let out = l
  for (const r of ROWS) if (r.key !== 'frame') out = setLook(out, r.key, Math.floor(rnd() * OPT[r.key].length))
  return out
}

/** Packed for presence (M27: a remote keeper draws your look): one short string, 11 single digits/letters in ROWS order. */
export const packLook = (l: Look) => ROWS.map(r => l[r.key].toString(36)).join('')
export function unpackLook(s: unknown): Look | null {
  if (typeof s !== 'string' || s.length !== ROWS.length) return null
  const o: Record<string, number> = { v: 1 }
  ROWS.forEach((r, i) => { o[r.key] = parseInt(s[i], 36) })
  return parseLook(o)
}
export const LOOK_KEY = 'open.look.v1'
