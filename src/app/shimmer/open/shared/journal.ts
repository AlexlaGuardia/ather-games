// THE JOURNAL = KAEL'S LEDGER (CANON game/ather-rework-2026-11.md › §7½, RULED 11-15): his ship-repair work list, some
// lines struck, some open; every open line is a mission; the keeper's own entries go beneath his. The UI and the flow
// are Jin's; THE LINES THEMSELVES (Kael's hand, his margins) ARE LARK'S, Alex signs. Until lark writes them, Kael's
// page holds no lines and every entry here is a neutral system line the game posts (the keeper's own entries).
//
// Systems POST entries by source (a page posts what its world knows: the nearest infected node, the gun shop, a
// contract); the journal keeps the one the player made ACTIVE and, per entry, whether its WAYMARK (compass + beacon)
// and its TRAIL (the ground line) show. Alex 11-15: "toggle way point markers and quest trails as well as set their
// active quest". Pure + store; the choices persist per viewer.

import { useSyncExternalStore } from 'react'

export type Zone = 'continent' | 'ather' | 'wilds'
export interface JournalEntry {
  id: string
  /** short, the line on the page */
  title: string
  /** the situation, shown when the line is opened */
  note: string
  /** where it points (null = nowhere to go yet) */
  where: { zone: Zone; x: number; z: number } | null
  /** whose line: 'kael' (his page, lark's words) or 'keeper' (the keeper's own entries) */
  hand: 'kael' | 'keeper'
  struck?: boolean
}
export interface JournalPrefs { v: 1; active: string | null; marker: Record<string, boolean>; trail: Record<string, boolean>
  /** true once the player has picked (or cleared) an active entry themselves; until then the game picks for them */
  chosen?: boolean }
/** THE NEXT STEP IS TOLD (BETA M4, 11-16). A new keeper has never opened the journal, so nothing was active and the world
 *  pointed nowhere. Until the player chooses, the open first errand IS the active line (beacon + trail on, Greg first). */
export const DEFAULT_ACTIVE = 'errand'
export function withDefault(p: JournalPrefs, entries: JournalEntry[]): JournalPrefs {
  if (p.chosen || p.active) return p
  return entries.some(e => e.id === DEFAULT_ACTIVE && !e.struck) ? { ...p, active: DEFAULT_ACTIVE } : p
}

const bySource = new Map<string, JournalEntry[]>()
let prefs: JournalPrefs | null = null
const KEY = 'open.journal.v1'
const subs = new Set<() => void>()
let snap: { entries: JournalEntry[]; prefs: JournalPrefs } = { entries: [], prefs: { v: 1, active: null, marker: {}, trail: {} } }
const SERVER = snap

function loadPrefs(): JournalPrefs {
  try { const p = JSON.parse(localStorage.getItem(KEY) ?? 'null') as JournalPrefs | null; if (p && p.v === 1) return p } catch { /* private */ }
  return { v: 1, active: null, marker: {}, trail: {} }
}
function emit() {
  if (!prefs) prefs = typeof window === 'undefined' ? SERVER.prefs : loadPrefs()
  const entries = [...bySource.values()].flat()
  snap = { entries, prefs: withDefault(prefs, entries) }
  subs.forEach(f => f())
}
const same = (a: JournalEntry[], b: JournalEntry[]) =>
  a.length === b.length && a.every((e, i) => { const f = b[i]; return e.id === f.id && e.title === f.title && e.note === f.note && !!e.struck === !!f.struck
    && (e.where === f.where || (!!e.where && !!f.where && e.where.zone === f.where.zone && Math.abs(e.where.x - f.where.x) < 0.5 && Math.abs(e.where.z - f.where.z) < 0.5)) })

/** A system replaces its own lines (call it whenever what it knows changes; unchanged posts are free). */
export function postEntries(source: string, entries: JournalEntry[]) {
  if (same(bySource.get(source) ?? [], entries)) return
  bySource.set(source, entries)
  emit()
}
export function setPrefs(fn: (p: JournalPrefs) => JournalPrefs) {
  if (!prefs) prefs = loadPrefs()
  prefs = fn(prefs)
  try { localStorage.setItem(KEY, JSON.stringify(prefs)) } catch { /* private */ }
  emit()
}
/** Make an entry the active one (or clear it). The active entry's waymark and trail default ON. */
export const setActive = (id: string | null) => setPrefs(p => ({ ...p, active: id, chosen: true }))
// a toggle flips what the player SEES, which includes the default-active errand
export const toggleMarker = (id: string) => setPrefs(p => ({ ...p, marker: { ...p.marker, [id]: !markerOn(withDefault(p, snap.entries), id) } }))
export const toggleTrail = (id: string) => setPrefs(p => ({ ...p, trail: { ...p.trail, [id]: !trailOn(withDefault(p, snap.entries), id) } }))
/** Defaults: the active entry shows both; any other shows neither until toggled. */
export const markerOn = (p: JournalPrefs, id: string) => p.marker[id] ?? p.active === id
export const trailOn = (p: JournalPrefs, id: string) => p.trail[id] ?? p.active === id

export function getJournal() { if (!prefs && typeof window !== 'undefined') emit(); return snap }
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
const server = () => SERVER
export const useJournal = () => useSyncExternalStore(subscribe, getJournal, server)

/** What the world should point at, in this zone: every entry with its marker on, and the trailed ones. */
export function guides(zone: Zone) {
  const { entries, prefs: p } = getJournal()
  const here = entries.filter(e => e.where && e.where.zone === zone && !e.struck)
  return {
    markers: here.filter(e => markerOn(p, e.id)).map(e => ({ id: e.id, title: e.title, x: e.where!.x, z: e.where!.z, active: p.active === e.id })),
    trails: here.filter(e => trailOn(p, e.id)).map(e => ({ id: e.id, x: e.where!.x, z: e.where!.z, active: p.active === e.id })),
  }
}
/** Compass marks for the template's `marks` ref (the active one in ember, the rest in ink). */
export const questMarks = (zone: Zone) =>
  guides(zone).markers.map(m => ({ x: m.x, z: m.z, color: m.active ? '#e0823f' : '#8a6a48', title: m.title }))
