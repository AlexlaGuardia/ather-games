// ── THE INFECTIONS, TOLD (BETA M128 s2): which signed line is due, and to whom. The engine is infection.ts; the words infect-lines.ts.
// ★ PINGS COME FROM THE SAVED STATE, NOT FROM THE EVENT: what the engine has sent (active.sent, lost, saved, told) minus what this
//   garden was already told (`said`). So a ping that fired before this shipped, with the tab hidden, or a moment before a reload is
//   still told, once; and none is told twice. A place already lost gets only its lost line, a saved one none of Morel's.
// ★ CLUES: while a place is held, its folk tell its clue. One lost with its clue: one of ITS folk stands at the next held place
//   (refugee), opener then clue. A clue nobody was asked for before the big one fell is still told at the place last saved (after
//   the thanks), so no clue can be missed for good. Heard clues and the opening carry across seasons, places do not.
// ★ PURE but for the guarded load/save (garden-tied like infection.ts). Off (not the owner) nothing here is called.
import { gardenKey } from '@/lib/keeper-local'
import { CLUES, waitsHome, type Infection, type Ping } from './infection'
import { INFECT_CARRY, INFECT_CLUE, INFECT_OPEN, INFECT_SAVED, MOREL_INFECT } from './infect-lines'
import type { Folk } from './settlement-folk'
import type { Settlement } from './network'
import type { Spot } from './folk-spots'

export interface Tell { v: 1; season: number; /** lines said: `start:<sid>`, ..., `obj:<sid>` */ said: string[]; /** which clue a place held (0 = none) */ clueOf: Record<string, number>; /** places whose folk have thanked the keeper, lost places whose folk gave the opener */ met: string[]; /** clues heard from folk, 1..7 */ heard: number[]; open: boolean; /** M156 s4: where a clue came as a guest: clue -> `<host>|<place>`, whose settlers say its folk half */ at?: Record<string, string> }
export const freshTell = (season: number): Tell => ({ v: 1, season, said: [], clueOf: {}, met: [], heard: [], open: false })
export interface Due { key: string; text: string; morel: boolean }

const fill = (line: string, place: string) => line.split('{PLACE}').join(place)
/** Write down which clue the held place has (the engine forgets it once the place is saved or lost). Same object = nothing new. */
export const note = (t: Tell, s: Infection): Tell => (s.active && t.clueOf[s.active.id] !== s.active.clue ? { ...t, clueOf: { ...t.clueOf, [s.active.id]: s.active.clue } } : t)
/** The next line the keeper has not been told, or null. `name` = a settlement's name ('' = unknown: it waits). */
export function due(t: Tell, s: Infection, name: (id: string) => string): Due | null {
  const ping = (k: Ping, id: string): Due | null => { const key = `${k}:${id}`, n = name(id); return t.said.includes(key) || !n ? null : { key, text: fill(MOREL_INFECT[k], n), morel: true } }
  for (const id of s.lost) { const d = ping('lost', id); if (d) return d }
  for (const id of s.saved) {
    const obj = INFECT_CLUE[(t.clueOf[id] ?? 0) - 1]?.obj, key = `obj:${id}`
    if (obj && !t.said.includes(key)) return { key, text: obj, morel: false }
  }
  { const d = dueGiven(t, s); if (d) return d }
  if (s.told >= CLUES && !waitsHome(s) && !t.open) return { key: 'open', text: INFECT_OPEN, morel: false }
  if (s.active) for (const k of ['start', 'hold', 'second'] as const) if (s.active.sent.includes(k)) { const d = ping(k, s.active.id); if (d) return d }
  return null
}
/** M156 s3: the thing found where another keeper's infection fell (this keeper's own clue), once; also while in their Wilds */
export function dueGiven(t: Tell, s: Infection): Due | null {
  for (const n of s.given ?? []) { const text = INFECT_CLUE[n - 1]?.obj, key = `given:${n}`; if (text && !t.said.includes(key)) return { key, text, morel: false } }
  return null
}
export const told = (t: Tell, d: Due): Tell => (d.key === 'open' ? { ...t, open: true } : { ...t, said: [...t.said, d.key] })

/** The clues folk who got away still carry (told at the next place), in order. */
export const carried = (s: Infection): number[] => { const top = s.assigned, own = s.active?.clue ?? 0, out: number[] = []; for (let c = s.told + 1; c <= top; c++) if (c !== own) out.push(c); return out }
export interface Refugee { id: string; name: string; /** the lost place */ from: string; clue: number; lines: string[] }
/** The folk of lost places standing at the held one: one per carried clue, the first of that place's folk not gone to a garden.
 *  `folk(id)` = a lost place's folk still at home. */
export function refugees(t: Tell, s: Infection, folk: (id: string) => readonly Folk[]): Refugee[] {
  if (!s.active) return []
  const c = carried(s)
  return s.lost.flatMap(from => {
    const clue = t.clueOf[from] ?? 0, f = c.includes(clue) ? folk(from)[0] : undefined
    return f ? [{ id: f.id, name: f.name, from, clue, lines: [...(t.met.includes(from) ? [] : [INFECT_CARRY]), INFECT_CLUE[clue - 1].folk] }] : []
  })
}
export interface Say { lines: string[]; clues: number[]; met?: string }
/** What a settler of `place` says instead of their hello, or null. `last` = the place's own spokesman for a carried clue whose
 *  folk cannot stand here (their place was before the purge, or all of them live in gardens by now). */
export function settlerSay(t: Tell, s: Infection, place: string, last: boolean, here: readonly Refugee[]): Say | null {
  if (s.active?.id === place) {
    const orphan = last ? carried(s).filter(c => !here.some(r => r.clue === c)) : []
    // RULED-AFK athernyx 41e8efa: a resident tells the clue, never the opener (their own homes stand)
    if (orphan.length) return { lines: orphan.map(c => INFECT_CLUE[c - 1].folk), clues: orphan }
    return s.active.clue ? { lines: [INFECT_CLUE[s.active.clue - 1].folk], clues: [s.active.clue] } : null
  }
  if (!s.saved.includes(place)) return null
  const left = s.saved[s.saved.length - 1] === place ? Array.from({ length: s.told }, (_, k) => k + 1).filter(c => !t.heard.includes(c)) : []
  const thanks = !t.met.includes(place)
  return thanks || left.length ? { lines: [...(thanks ? [INFECT_SAVED] : []), ...left.map(c => INFECT_CLUE[c - 1].folk)], clues: left, met: place } : null
}
/** M156 s4: the clues between two states came at `place`, in `host`'s Wilds. Same object = none did. */
export const noteGuest = (t: Tell, was: Infection, now: Infection, host: string, place: string): Tell =>
  now.told > was.told ? { ...t, at: { ...t.at, ...Object.fromEntries(Array.from({ length: now.told - was.told }, (_, k) => [was.told + 1 + k, `${host}|${place}`])) } } : t
/** M156 s4 (RULED athernyx 4bdec6b): a settler of the HOST's cleared place says the guest's own clue, till it is heard (there or,
 *  settlerSay's path, at home). The folk line alone: the thanks are the host's. */
export function guestSay(t: Tell, host: string | null, place: string): Say | null {
  const c = host ? Object.keys(t.at ?? {}).map(Number).filter(k => t.at![k] === `${host}|${place}` && !t.heard.includes(k)).sort((a, b) => a - b) : []
  return c.length ? { lines: c.map(k => INFECT_CLUE[k - 1].folk), clues: c } : null
}
/** A line of it was said: the clue is heard, the place met. `upTo` = how many of `lines` the keeper has seen. */
export function heardSay(t: Tell, say: Say, upTo: number): Tell {
  const off = say.lines.length - say.clues.length, got = say.clues.filter((c, k) => off + k < upTo && !t.heard.includes(c))
  const met = say.met && !t.met.includes(say.met) ? [...t.met, say.met] : t.met
  return got.length || met !== t.met ? { ...t, heard: [...t.heard, ...got], met } : t
}
/** Where a refugee stands: on the green, clear of the folk, the homes and the big one. Pure, the same on every device. */
export function refugeeSpots(p: Settlement, here: readonly Refugee[], folk: readonly { x: number; z: number }[], champ: { x: number; z: number } | null): Spot[] {
  const out: Spot[] = []
  for (const r of here) {
    let at = { x: p.x, z: p.z }
    look: for (const d of [9, 7, 11, 13, 5]) for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2, x = p.x + Math.sin(a) * d, z = p.z + Math.cos(a) * d
      if ((p.pads ?? []).some(q => Math.hypot(q[0] - x, q[1] - z) < 6) || [...folk, ...out].some(f => Math.hypot(f.x - x, f.z - z) < 2.4) || (champ && Math.hypot(champ.x - x, champ.z - z) < 8)) continue
      at = { x, z }; break look
    }
    out.push({ id: r.id, ...at, yaw: Math.atan2(at.x - p.x, at.z - p.z) })
  }
  return out
}

const KEY = 'ather.infection-told.v1'
const strs = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((k): k is string => typeof k === 'string'))] : [])
export function parseTell(v: unknown, season: number): Tell {
  const o = v as Partial<Tell> | null
  if (!o || typeof o !== 'object' || o.v !== 1) return freshTell(season)
  const heard = Array.isArray(o.heard) ? [...new Set(o.heard.filter(c => Number.isInteger(c) && c >= 1 && c <= CLUES))] : [], open = o.open === true
  if (o.season !== season) return { ...freshTell(season), heard, open }   // the purge: places go, clues stay
  const clueOf = Object.fromEntries(Object.entries(o.clueOf && typeof o.clueOf === 'object' ? o.clueOf : {}).filter(([, c]) => Number.isInteger(c) && c >= 0 && c <= CLUES))
  const at = Object.fromEntries(Object.entries(o.at && typeof o.at === 'object' ? o.at : {}).filter(([c, p]) => INFECT_CLUE[Number(c) - 1] && typeof p === 'string'))
  return { v: 1, season, said: strs(o.said), clueOf, met: strs(o.met), heard, open, ...(Object.keys(at).length ? { at } : {}) }
}
export function loadTell(season: number): Tell { try { return parseTell(JSON.parse(localStorage.getItem(gardenKey(KEY)) ?? 'null'), season) } catch { return freshTell(season) } }
export function saveTell(t: Tell): void { try { localStorage.setItem(gardenKey(KEY), JSON.stringify(t)) } catch { /* private window */ } }
