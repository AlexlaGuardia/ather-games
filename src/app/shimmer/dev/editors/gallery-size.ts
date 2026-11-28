// BETA M249 (assets, 2026-11-28): THE GALLERY'S SIZE SLIDER. Alex 11-28: each spirit's card in /shimmer/dev?mode=spirits gets a
// slider that resizes the selected spirit live, saved per FORM on this browser (a DEVICE key, like the gun bench's build dials:
// keeper-local.test DEVICE_KEYS), and 'Copy values' prints the line for the size table the game actually reads, so a tune drops
// straight in. Nothing here changes a live size: the game keeps reading its own tables until Alex pastes a line.
// The tables (one size number per form; no form has a separate height / length dial, so the slider is ONE overall scale):
//   base spirit   -> creature-size.ts GROWN.<species> (height, + length where canon gives one; CANON-GATED: npm run canon grown-sizes)
//   second form   -> spirit-models.ts FORM_GROW_BY.<name> (x her base's grown height; unlisted = FORM_GROW)
//   awakened form -> spirit-models.ts AWAKEN_GROW.<name> (x the Vulnyx rig height)
// ★ PURE: no three, no React. Run: npx tsx src/app/shimmer/dev/editors/gallery-size.test.ts
import { GROWN } from '../../sprites/creature-size'
import { AWAKEN_GROW, formGrow } from '../../open/ather/spirit-models'
import type { Species } from '../../spirits/spirit'

export const GALLERY_SIZE_KEY = 'open:gallery-size.v1'
export const SIZE_MIN = 0.5, SIZE_MAX = 2.5, SIZE_STEP = 0.01

/** what the slider sizes: a base spirit (by species), a second form or an awakened form (by look name) */
export type SizeForm = { kind: 'base'; sp: Species } | { kind: 'form'; name: string } | { kind: 'awakened'; name: string }

/** the saved slot's name: one per form */
export const sizeSlot = (f: SizeForm): string => (f.kind === 'base' ? `base:${f.sp}` : `${f.kind}:${f.name}`)

export const cleanScale = (v: unknown): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 1
  return Math.round(Math.min(SIZE_MAX, Math.max(SIZE_MIN, n)) / SIZE_STEP) * SIZE_STEP
}
const r2 = (n: number) => Math.round(n * 100) / 100
const num = (n: number) => String(r2(n))

/** the number the game reads today for this form (before any tune) */
export function tableValue(f: SizeForm): number | null {
  if (f.kind === 'awakened') return AWAKEN_GROW[f.name] ?? null
  if (f.kind === 'form') return formGrow(f.name)
  return GROWN[f.sp]?.height ?? null
}

/** 'Copy values': the comment naming the table + the line to paste into it (the record's own `key: value` shape) */
export function sizeLines(f: SizeForm, scale: number): string[] {
  const s = cleanScale(scale)
  if (f.kind === 'awakened') {
    const was = AWAKEN_GROW[f.name]; if (was == null) return []
    return [`// spirit-models.ts AWAKEN_GROW (was ${was})`, `${f.name}: ${num(was * s)},`]
  }
  if (f.kind === 'form') {
    const was = formGrow(f.name)
    return [`// spirit-models.ts FORM_GROW_BY (was ${was})`, `${f.name}: ${num(was * s)},`]
  }
  const g = GROWN[f.sp]; if (!g) return []
  const key = /^[a-z]+$/.test(f.sp) ? f.sp : `'${f.sp}'`
  const body = g.length != null ? `{ height: ${num(g.height * s)}, length: ${num(g.length * s)} }` : `{ height: ${num(g.height * s)} }`
  return [`// creature-size.ts GROWN (was ${JSON.stringify(g).replace(/"/g, '')}; canon-gated: the canon note changes with it, Magii)`, `${key}: ${body},`]
}

// ── saved on this browser (a dev tool's numbers, a DEVICE key) ──
export function loadSizes(): Record<string, number> {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(GALLERY_SIZE_KEY)
    const o = raw ? JSON.parse(raw) : null, out: Record<string, number> = {}
    if (o && typeof o === 'object') for (const k of Object.keys(o)) if (typeof o[k] === 'number' && Number.isFinite(o[k])) out[k] = cleanScale(o[k])
    return out
  } catch { return {} }
}
/** save one form's scale; 1 (or null) clears its slot (Reset) */
export function saveSize(slot: string, scale: number | null): Record<string, number> {
  const all = loadSizes()
  if (scale == null || cleanScale(scale) === 1) delete all[slot]; else all[slot] = cleanScale(scale)
  try { localStorage.setItem(GALLERY_SIZE_KEY, JSON.stringify(all)) } catch { /* private window: the slider still moves, unsaved */ }
  return all
}
