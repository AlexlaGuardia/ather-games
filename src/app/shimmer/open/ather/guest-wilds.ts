// ── A GUEST'S WILDS IS THE HOST'S (BETA M156 s2; Alex 11-25 "A, then B") ────────────────────────────────────────────────────
// While partied in the Wilds, the host (shared/party-host.ts) sends which nodes they cleared, which the grey took back, and their
// settlement infection; a guest DRAWS and plays by those. LOOKING WRITES NOTHING: the guest's ledgers are not touched, they come
// back the moment the host is gone. s3 (Alex "B"): the champion is the host's (shared/fight-share.ts) and one kill counts for every
// keeper there: the host's node clears, and each guest there writes it in their OWN save (already clear there = nothing written;
// not charted = charted by the clear, as a kill alone always did). A guest's message never writes the host's ledger.
// ★ PURE. The socket half is use-guest-wilds.tsx.
import type { Infection } from './infection'
import { freshInfection } from './infection'
import type { SpreadMap } from './spread-map'
import { infectId } from './infect-id'

export const LEDGER_KIND = 'wilds.ledger'
export interface HostLedger { clean: string[]; grey: string[]; season: number; held: string | null; lost: string[] }
/** on the wire: node count + id hash (two builds with other nodes never mix), two bitmasks over the sorted ids, the infection */
export interface Wire { n: number; h: number; c: string; g: string; s: number; i: string | null; l: string[] }
export const RELAY_MAX = 2048, MAX_LOST = 24

const hashOf = (ids: readonly string[]) => { let h = 2166136261; for (const id of ids) { for (let k = 0; k < id.length; k++) h = Math.imul(h ^ id.charCodeAt(k), 16777619); h = Math.imul(h ^ 10, 16777619) } return h >>> 0 }
const bits = (ids: readonly string[], on: ReadonlySet<string>) => { const b = new Uint8Array(Math.ceil(ids.length / 8)); ids.forEach((id, k) => { if (on.has(id)) b[k >> 3] |= 1 << (k & 7) }); return btoa(String.fromCharCode(...b)) }
function unbits(ids: readonly string[], s: unknown): string[] | null {
  if (typeof s !== 'string') return null
  try { const b = atob(s); if (b.length !== Math.ceil(ids.length / 8)) return null; return ids.filter((_, k) => b.charCodeAt(k >> 3) & (1 << (k & 7))) } catch { return null }
}
/** `ids` = every node's id, SORTED (both ends) */
export const encodeLedger = (ids: readonly string[], l: HostLedger): Wire =>
  ({ n: ids.length, h: hashOf(ids), c: bits(ids, new Set(l.clean)), g: bits(ids, new Set(l.grey)), s: l.season, i: l.held, l: l.lost.slice(0, MAX_LOST) })
export function decodeLedger(ids: readonly string[], v: unknown): HostLedger | null {
  const w = v as Partial<Wire> | null
  if (!w || typeof w !== 'object' || w.n !== ids.length || w.h !== hashOf(ids) || !Number.isFinite(w.s)) return null
  const clean = unbits(ids, w.c), grey = unbits(ids, w.g)
  if (!clean || !grey || !Array.isArray(w.l) || w.l.length > MAX_LOST || w.l.some(k => typeof k !== 'string') || (w.i !== null && typeof w.i !== 'string')) return null
  return { clean, grey, season: w.s!, held: w.i ?? null, lost: w.l }
}
/** the host's infection as a guest draws it: the held place and the lost ones, no clocks and no clues (those are each keeper's own) */
export const guestInfection = (l: HostLedger, season: number): Infection =>
  ({ ...freshInfection(season), ...(l.season === season ? { active: l.held ? { id: l.held, at: 0, online: 0, clue: 0, sent: [] } : null, lost: l.lost } : {}) })
/** the guest's own charting (what they have stood in, this visit too) under the host's grey */
export const guestMap = (own: SpreadMap, l: HostLedger, visited: readonly string[]): SpreadMap =>
  ({ ...own, seen: { ...Object.fromEntries(visited.map(k => [k, 0])), ...own.seen }, grey: Object.fromEntries(l.grey.map(k => [k, 0])) })
/** what fell a moment ago reads clear until the host's next ledger says so too (their 'grew' / 'cleared' toasts must not flicker) */
export function withDowns(l: HostLedger, downs: readonly string[]): HostLedger {
  const d = downs.filter(id => !l.clean.includes(id) || l.grey.includes(id))
  return d.length ? { ...l, clean: [...new Set([...l.clean, ...d])].sort(), grey: l.grey.filter(id => !d.includes(id)), held: l.held && d.includes(infectId(l.held)) ? null : l.held } : l
}
