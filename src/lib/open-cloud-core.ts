// ── THE OPEN WORLD'S CLOUD SAVE, CLIENT CORE (BETA M12 step 5, docs/M12-cloud-save.md) ─────────────────────────────
// PURE over a Storage you pass in (tests hand it a Map-backed fake). The network + page wiring is open-cloud.ts.
//
// The doc: { v, _owner, _epoch, garden{keys}, keepers[{id, created_at, keys}], active, retired[] }, every section a map of
// BASE key -> the raw localStorage string. Which bases travel is the one registry (keeper-key-specs.ts, read through
// open-save-registry.ts, the same predicate the server checks). Device keys (settings, keymaps, gfx) are in neither list
// and never leave the browser. The server never parses a game value, and neither does this file.
//
// Where things live locally (keeper-roster.ts): garden keys and the ACTIVE keeper's keys at `u:<owner>:<base>`, an
// inactive keeper's at `u:<owner>:k:<id>:<base>`, the roster at `u:<owner>:ather:roster.v1`.
//
// ★ NEVER MERGE GAME VALUES (doc §4). Boot decides one of: adopt the server, push local, or both-moved = back local up
//   to ONE backup key, then adopt the server. A backup that cannot be written means DO NOT ADOPT (a full disk must never
//   become a silent loss).
import { isGardenKey, isKeeperKey } from './accounts/open-save-registry'

export const ROSTER_BASE = 'ather:roster.v1'
export const syncKey = (owner: string) => `ather:open:sync:${owner}`       // { rev, hash } of the last agreed state
export const backupKey = (owner: string) => `ather:open:backup:${owner}`   // ONE per account: { saved_at, rev, doc }
export const PENDING_KEY = 'ather:open:adopt'                              // sessionStorage: { owner, doc, rev } to apply on the next load

export interface KeeperSec { id: string; created_at: number; keys: Record<string, string>; updated_at?: number }
export interface OpenDoc {
  v: 1; _owner: string; _epoch: number
  garden: { keys: Record<string, string>; updated_at?: number }
  keepers: KeeperSec[]; active: string | null
  retired?: { id: string; retired_at?: number; keys?: Record<string, string> }[]
}
export interface SyncRec { rev: number; hash: string }
interface Roster { v: 1; keepers: { id: string; created_at: number }[]; active: string; pending?: string }

function names(s: Storage): string[] {
  const out: string[] = []
  for (let i = 0; i < s.length; i++) { const k = s.key(i); if (k) out.push(k) }
  return out
}
const sorted = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
function readRoster(s: Storage, owner: string): Roster | null {
  try {
    const r = JSON.parse(s.getItem(`u:${owner}:${ROSTER_BASE}`) ?? 'null') as Roster | null
    return r && r.v === 1 && Array.isArray(r.keepers) && r.keepers.some(k => k.id === r.active) ? r : null
  } catch { return null }
}

/** Build the doc from this browser. Null when the roster is mid-swap (ensureRoster replays it first) or absent. */
export function collectDoc(s: Storage, owner: string, epoch: number, retired: OpenDoc['retired'] = []): OpenDoc | null {
  const roster = readRoster(s, owner)
  if (!roster || roster.pending) return null
  const pre = `u:${owner}:`
  const garden: Record<string, string> = {}, live: Record<string, string> = {}
  const parked = new Map<string, Record<string, string>>()
  for (const k of names(s)) {
    if (!k.startsWith(pre)) continue
    const base = k.slice(pre.length), v = s.getItem(k)
    if (v === null) continue
    if (base.startsWith('k:')) {                                  // k:<id>:<base>
      const i = base.indexOf(':', 2); if (i < 0) continue
      const id = base.slice(2, i), b = base.slice(i + 1)
      if (!isKeeperKey(b)) continue
      if (!parked.has(id)) parked.set(id, {})
      parked.get(id)![b] = v
    } else if (isGardenKey(base)) garden[base] = v
    else if (isKeeperKey(base)) live[base] = v
  }
  return {
    v: 1, _owner: owner, _epoch: epoch,
    garden: { keys: sorted(garden) },
    keepers: roster.keepers.map(k => ({ id: k.id, created_at: k.created_at, keys: sorted(k.id === roster.active ? live : parked.get(k.id) ?? {}) })),
    active: roster.active,
    retired: (retired ?? []).map(r => ({ id: r.id })),             // carry every tombstone the server returned (doc §6)
  }
}

/** Content identity: garden + each keeper's keys + who is active. Timestamps, rev and tombstones don't count. */
export function contentHash(d: OpenDoc | null): string {
  if (!d) return ''
  const body = JSON.stringify([sorted(d.garden?.keys ?? {}), d.active ?? null,
    [...(d.keepers ?? [])].sort((a, b) => (a.id < b.id ? -1 : 1)).map(k => [k.id, sorted(k.keys ?? {})])])
  let h1 = 0x811c9dc5, h2 = 0x01000193                            // two FNV-style lanes: a cheap, stable 64-bit id
  for (let i = 0; i < body.length; i++) { const c = body.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 + c, 2246822519) ^ (h2 >>> 13) }
  return `${(h1 >>> 0).toString(36)}.${(h2 >>> 0).toString(36)}.${body.length}`
}
export const hasData = (d: OpenDoc | null) => !!d && (Object.keys(d.garden.keys).length > 0 || d.keepers.some(k => Object.keys(k.keys).length > 0))

/** Make this browser's open-world state EQUAL to the doc. Device keys and anything outside the registry are untouched. */
export function applyDoc(s: Storage, owner: string, d: OpenDoc): void {
  const pre = `u:${owner}:`
  const keepers = d.keepers ?? []
  const active = keepers.find(k => k.id === d.active) ?? keepers[0]
  for (const k of names(s)) {                                      // clear what the doc does not hold
    if (!k.startsWith(pre)) continue
    const base = k.slice(pre.length)
    if (base.startsWith('k:')) {
      const i = base.indexOf(':', 2), id = base.slice(2, i)
      if (keepers.some(x => x.id === id)) s.removeItem(k)          // a keeper the doc names is rewritten below
    } else if (isGardenKey(base) ? !(base in (d.garden?.keys ?? {})) : isKeeperKey(base) && !(active && base in active.keys)) s.removeItem(k)
  }
  for (const [b, v] of Object.entries(d.garden?.keys ?? {})) s.setItem(pre + b, v)
  if (!active) return                                              // an empty roster: the next ensureRoster starts one
  for (const k of keepers) {
    const at = k.id === active.id ? pre : `${pre}k:${k.id}:`
    for (const [b, v] of Object.entries(k.keys ?? {})) s.setItem(at + b, v)
  }
  s.setItem(pre + ROSTER_BASE, JSON.stringify({ v: 1, keepers: keepers.map(k => ({ id: k.id, created_at: k.created_at })), active: active.id }))
}

export type Boot =
  | { do: 'idle'; rev: number }                 // already agreed (also: a pagehide beacon that landed)
  | { do: 'push'; base: number }                // local moved, or the server holds nothing / an older world
  | { do: 'adopt'; backup: boolean }            // take the server's; back local up first when both moved
  | { do: 'hold'; why: string }                 // touch nothing, push nothing (a newer world on the server: stale bundle)

/** The boot rule (doc §4.3). `rec` = what this device last agreed with the server, if ever. */
export function decideBoot(local: OpenDoc | null, rec: SyncRec | null, server: { doc: OpenDoc | null; rev: number }, epoch: number): Boot {
  const lh = contentHash(local)
  if (!server.doc) return hasData(local) ? { do: 'push', base: server.rev } : { do: 'idle', rev: server.rev }
  if (server.doc._epoch > epoch) return { do: 'hold', why: 'the server holds a newer world than this page' }
  if (server.doc._epoch < epoch) return hasData(local) ? { do: 'push', base: server.rev } : { do: 'idle', rev: server.rev }
  if (contentHash(server.doc) === lh) return { do: 'idle', rev: server.rev }
  if (!hasData(local)) return { do: 'adopt', backup: false }
  if (rec && rec.rev === server.rev) return { do: 'push', base: server.rev }                // only this device moved
  if (rec && rec.hash === lh) return { do: 'adopt', backup: false }                         // only the server moved
  return { do: 'adopt', backup: true }                                                     // both moved, or never agreed
}

/** Write the ONE backup. False = could not (quota): the caller must NOT adopt. */
export function writeBackup(s: Storage, owner: string, local: OpenDoc, rev: number, now = Date.now()): boolean {
  try { s.setItem(backupKey(owner), JSON.stringify({ saved_at: now, rev, doc: local })); return true } catch { return false }
}
export function readRec(s: Storage, owner: string): SyncRec | null {
  try { const r = JSON.parse(s.getItem(syncKey(owner)) ?? 'null'); return r && Number.isInteger(r.rev) && typeof r.hash === 'string' ? r : null } catch { return null }
}
export function writeRec(s: Storage, owner: string, r: SyncRec): void { try { s.setItem(syncKey(owner), JSON.stringify(r)) } catch { /* the next boot re-agrees */ } }
