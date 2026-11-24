// BETA M118 s2 (play, 2026-11-24, canon c01931e/05f3d0d item 3): WHICH SPIRIT MAY USE WHICH TRAINING PIECE, set by the keeper.
// No React, no three. Shaping, not a leash: an assigned spirit still uses the piece as she pleases (no forced sessions, no
// timers, no penalty for not training); an unassigned one does not train there. By piece id -> the planter ids (= spirits)
// allowed, kept per plot (a garden key: the pieces are the plot's). A lifted piece leaves a harmless stale entry.
import { gardenKey } from '@/lib/keeper-local'

export type Assign = Readonly<Record<string, readonly string[]>>
/** pure: may spirit `spirit` train at piece `piece`? (default NO: the keeper chooses) */
export const mayUse = (a: Assign, piece: string, spirit: string) => !!a[piece]?.includes(spirit)
/** pure: allow (on) or stop (off) a spirit at a piece. The input is never mutated. */
export function withAssign(a: Assign, piece: string, spirit: string, on: boolean): Assign {
  const cur = a[piece] ?? [], has = cur.includes(spirit)
  if (on === has) return a
  const next = on ? [...cur, spirit] : cur.filter(x => x !== spirit), out: Record<string, readonly string[]> = { ...a }
  if (next.length) out[piece] = next; else delete out[piece]
  return out
}
/** pure: any stored value -> a clean map (junk dropped) */
export function parseAssign(v: unknown): Assign {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  const out: Record<string, string[]> = {}
  for (const [k, ids] of Object.entries(v as Record<string, unknown>)) {
    if (!Array.isArray(ids)) continue
    const ok = [...new Set(ids.filter((x): x is string => typeof x === 'string'))]
    if (ok.length) out[k] = ok
  }
  return out
}

const KEY = 'ather.trainAssign.v1'
const subs = new Set<() => void>()
export function loadAssign(): Assign {
  try { return parseAssign(JSON.parse(localStorage.getItem(gardenKey(KEY)) ?? '{}')) } catch { return {} }
}
export function setAssign(piece: string, spirit: string, on: boolean) {
  const next = withAssign(loadAssign(), piece, spirit, on)
  try { localStorage.setItem(gardenKey(KEY), JSON.stringify(next)) } catch { /* private mode: this session only */ }
  for (const f of subs) f()
}
export const subscribeAssign = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
