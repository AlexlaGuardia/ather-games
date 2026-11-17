// ── THE KEEPER ROSTER (M12 step 2): several keepers per account, one active ─────────────────────
//
// PLUMBING ONLY. No UI (step 4), no sign-in prompt (step 3), no cloud sync (step 5).
//
// ★ THE ACTIVE KEEPER NEVER MOVES. Its data stays exactly where M12 step 1 put it (`u:<owner>:<base>`), so every
// existing reader keeps working unchanged. The roster is one extra record listing keepers {id, created_at} + active.
// An INACTIVE keeper's keeper-keys are parked under `u:<owner>:k:<keeperId>:<base>` (no base begins with `k:`, so a
// family scan on a live base can never catch a parked copy). GARDEN keys are never read or written here.
//
// swapKeeper(toId), in this order, and the order is the safety:
//   1. PARK   copy every live keeper key of the active keeper to its parked prefix (stale parked copies of
//             that keeper, for bases it no longer has, are removed only after the live write at 3 landed)
//   2. MARK   roster.pending = toId   (a journal: from here the parked copies are the truth, the live slots are mid-flight)
//   3. LIVE   copy the target's parked keys into the live slots; a live key the target lacks is removed
//   4. ACTIVE roster.active = toId, pending cleared
// Move-not-delete: a parked copy is never deleted before the live write succeeded; the target's own parked copy is
// left in place afterwards (a backup, refreshed by the next park). localStorage has no transaction, so an interruption
// between 2 and 4 is finished by the next ensureRoster() (it replays step 3 from the intact parked copies). Without the
// journal a half-written live slot would be parked as the OLD keeper's data on the next swap.
//
// ⚠ A SWAP CHANGES LOCALSTORAGE UNDER A RUNNING PAGE. Readers load at boot; the page must RELOAD (or re-run every
// reader) after swapKeeper resolves true. That reload is step 4's job, not this module's.
//
// Signed-in owner only. Owner null (anonymous) = no roster, one keeper, exactly as before.
import { saveOwner } from './save-slot'
import { keeperKeyFor } from './keeper-local'
import { KEEPER_KEY_SPECS } from './keeper-key-specs'
import { BIRTH_KEY } from '@/app/shimmer/play3d/rune-inventory'

/** Most keepers one account may hold (docs/M12-cloud-save.md: cap 8). */
export const ROSTER_CAP = 8

export interface RosterKeeper { id: string; created_at: number }
export interface Roster { v: 1; keepers: RosterKeeper[]; active: string; pending?: string }

/** The roster record's base. NOT a keeper key and NOT a garden key: it must never swap with a keeper. */
export const ROSTER_BASE = 'ather:roster.v1'

const rosterKey = (owner: string) => keeperKeyFor(ROSTER_BASE, owner)
const parkedPrefix = (owner: string, id: string) => `u:${owner}:k:${id}:`
const isKeeperBase = (name: string) => KEEPER_KEY_SPECS.some(s => (s.base.endsWith(':') ? name.startsWith(s.base) && name.length > s.base.length : name === s.base))

function names(s: Storage): string[] {
  const out: string[] = []
  for (let i = 0; i < s.length; i++) { const k = s.key(i); if (k) out.push(k) }
  return out
}
/** { base -> raw } of the keeper's LIVE keys for this owner. */
function liveKeys(s: Storage, owner: string): Map<string, string> {
  const pre = `u:${owner}:`
  const m = new Map<string, string>()
  for (const k of names(s)) {
    if (!k.startsWith(pre)) continue
    const base = k.slice(pre.length)
    if (base.startsWith('k:') || !isKeeperBase(base)) continue
    const v = s.getItem(k)
    if (v !== null) m.set(base, v)
  }
  return m
}
function parkedKeys(s: Storage, owner: string, id: string): Map<string, string> {
  const pre = parkedPrefix(owner, id)
  const m = new Map<string, string>()
  for (const k of names(s)) {
    if (!k.startsWith(pre)) continue
    const v = s.getItem(k)
    if (v !== null) m.set(k.slice(pre.length), v)
  }
  return m
}

function newId(): string {
  const b = new Uint8Array(6)
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(b)
  else for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256)
  return 'k_' + [...b].map(x => x.toString(16).padStart(2, '0')).join('')
}

function parse(raw: string | null): Roster | null {
  if (!raw) return null
  try {
    const r = JSON.parse(raw) as Roster
    if (r && r.v === 1 && Array.isArray(r.keepers) && r.keepers.length && r.keepers.some(k => k.id === r.active)) return r
  } catch { /* corrupt: treated as absent by readRoster; ensureRoster refuses to overwrite it */ }
  return null
}

/** Pure read. Null for anonymous or when no (valid) record exists. Never writes. */
export function readRoster(owner: string | null = saveOwner()): Roster | null {
  if (!owner) return null
  try { return parse(localStorage.getItem(rosterKey(owner))) } catch { return null }
}

function writeRoster(owner: string, r: Roster): void { localStorage.setItem(rosterKey(owner), JSON.stringify(r)) }

/** Step 3 of a swap, also the recovery replay. Parked copies are never touched here. */
function applyParked(s: Storage, owner: string, toId: string): void {
  const target = parkedKeys(s, owner, toId)
  const live = liveKeys(s, owner)
  for (const [base, v] of target) s.setItem(keeperKeyFor(base, owner), v)
  for (const base of live.keys()) if (!target.has(base)) s.removeItem(keeperKeyFor(base, owner))
}

/**
 * The account's roster, created on first read: ONE keeper = whatever is live today, active. No data moves.
 * Also finishes an interrupted swap. Null for anonymous. A corrupt record is left alone (null), never overwritten.
 */
export function ensureRoster(owner: string | null = saveOwner()): Roster | null {
  if (!owner) return null
  try {
    const raw = localStorage.getItem(rosterKey(owner))
    if (raw === null) {
      const r: Roster = { v: 1, keepers: [{ id: newId(), created_at: Date.now() }], active: '' }
      r.active = r.keepers[0].id
      writeRoster(owner, r)
      return r
    }
    const r = parse(raw)
    if (!r) return null
    if (r.pending) {
      applyParked(localStorage, owner, r.pending)
      const done: Roster = { v: 1, keepers: r.keepers, active: r.pending }
      writeRoster(owner, done)
      return done
    }
    return r
  } catch { return null }
}

/** Add an EMPTY keeper (not active). Returns its id, or null when anonymous, at ROSTER_CAP, or storage failed. */
export function addKeeper(owner: string | null = saveOwner()): string | null {
  const r = ensureRoster(owner)
  if (!owner || !r || r.keepers.length >= ROSTER_CAP) return null
  try {
    const id = newId()
    writeRoster(owner, { ...r, keepers: [...r.keepers, { id, created_at: Date.now() }] })
    return id
  } catch { return null }
}

/**
 * Add a keeper that ALREADY HAS DATA (M12 step 3: an anonymous keeper joining the roster). `data` is { base -> raw }.
 * Order is the safety: the parked copies are written FIRST, the roster entry LAST, so a failure never leaves a listed
 * keeper with half a body; on a throw the parked keys written so far are removed again. Never touches live keys or
 * the active keeper. Null when anonymous, at ROSTER_CAP, or storage failed (nothing added).
 */
export function addKeeperWith(data: Map<string, string>, owner: string | null = saveOwner()): string | null {
  const r = ensureRoster(owner)
  if (!owner || !r || r.keepers.length >= ROSTER_CAP) return null
  const id = newId()
  const pre = parkedPrefix(owner, id)
  const written: string[] = []
  try {
    for (const [base, v] of data) { localStorage.setItem(pre + base, v); written.push(pre + base) }
    writeRoster(owner, { ...r, keepers: [...r.keepers, { id, created_at: Date.now() }] })
    return id
  } catch {
    for (const k of written) { try { localStorage.removeItem(k) } catch { /* best effort */ } }
    return null
  }
}

/** Make `toId` the active keeper (see the file doc for the order). True when it is active afterwards. The page must reload. */
export function swapKeeper(toId: string, owner: string | null = saveOwner()): boolean {
  const r = ensureRoster(owner)
  if (!owner || !r || !r.keepers.some(k => k.id === toId)) return false
  if (r.active === toId) return true
  try {
    const s = localStorage
    // 1. PARK the active keeper's live keys.
    const live = liveKeys(s, owner)
    const pre = parkedPrefix(owner, r.active)
    for (const [base, v] of live) s.setItem(pre + base, v)
    // 2. MARK the journal.
    writeRoster(owner, { ...r, pending: toId })
    // 3. LIVE: target's parked keys in, extras out.
    applyParked(s, owner, toId)
    // Stale parked copies of the keeper we left (bases it no longer had), now that the live write landed.
    for (const base of parkedKeys(s, owner, r.active).keys()) if (!live.has(base)) s.removeItem(pre + base)
    // 4. ACTIVE.
    writeRoster(owner, { v: 1, keepers: r.keepers, active: toId })
    return true
  } catch { return false }   // interrupted: the journal (if written) lets the next ensureRoster() finish it
}

/** The birth rune id of a roster keeper: the live key for the active one, its parked copy for the others. Null = not yet born. Pure read. */
export function keeperBirthRune(id: string, owner: string | null = saveOwner()): string | null {
  if (!owner) return null
  try {
    const r = readRoster(owner)
    if (!r) return null
    const base = BIRTH_KEY
    const k = r.active === id && !r.pending ? keeperKeyFor(base, owner) : parkedPrefix(owner, id) + base
    return localStorage.getItem(k) || null
  } catch { return null }
}
