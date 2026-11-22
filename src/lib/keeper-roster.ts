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
export interface Roster { v: 1; keepers: RosterKeeper[]; active: string; pending?: string; retired?: RetiredKeeper[] }
/** A keeper this browser removed (M66 s3). The cloud refuses a push that drops a keeper unless it is listed in
 *  `retired[]` ("keeper vanished", doc §6), so the roster remembers the id until the server's own 30-day window is past. */
export interface RetiredKeeper { id: string; at: number }
/** How long a local tombstone is carried: the server's RETIRED_KEEP_MS (it ignores an expired one, so longer is harmless). */
export const RETIRED_CARRY_MS = 30 * 24 * 3600 * 1000

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

/** Fired on `window` when the ACTIVE keeper's live keys were just replaced (a swap, or ensureRoster finishing an
 *  interrupted one). A store holding a keeper value in memory must drop it and re-read: the bytes under its key are now
 *  another keeper's, and writing its stale copy back would hand one keeper's progress to the other (11-22). */
export const KEEPER_SWAP_EVENT = 'ather:keeper-swap'
function notifySwap(): void {
  if (typeof window === 'undefined') return
  try { window.dispatchEvent(new CustomEvent(KEEPER_SWAP_EVENT)) } catch { /* no CustomEvent */ }
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
      const done: Roster = { v: 1, keepers: r.keepers, active: r.pending, ...(r.retired?.length ? { retired: r.retired } : {}) }
      writeRoster(owner, done)
      notifySwap()
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
    writeRoster(owner, { v: 1, keepers: r.keepers, active: toId, ...(r.retired?.length ? { retired: r.retired } : {}) })
    notifySwap()
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

// ── NAME + REMOVE (BETA M66 s3, the Character tab's Keepers edit) ────────────────────────────────────────────────
/** The keeper key holding the name the player gave a keeper. A keeper key, so it parks, swaps and syncs with the rest. */
export const KEEPER_NAME_KEY = 'open.keeper.name.v1'
/** Longest name kept. */
export const KEEPER_NAME_MAX = 20

/** Where a roster keeper's copy of `base` lives right now: live for the active one, parked for the others. */
function slotOf(r: Roster, owner: string, id: string, base: string): string {
  return r.active === id && !r.pending ? keeperKeyFor(base, owner) : parkedPrefix(owner, id) + base
}

/** Trim, fold runs of whitespace, drop control characters, cap at KEEPER_NAME_MAX. '' = no name. */
export function cleanKeeperName(raw: string): string {
  return raw.replace(/\s+/g, ' ').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, KEEPER_NAME_MAX).trim()
}

/** The name the player gave this keeper, or null. Pure read. */
export function keeperName(id: string, owner: string | null = saveOwner()): string | null {
  if (!owner) return null
  try {
    const r = readRoster(owner)
    if (!r || !r.keepers.some(k => k.id === id)) return null
    return localStorage.getItem(slotOf(r, owner, id, KEEPER_NAME_KEY)) || null
  } catch { return null }
}

/** Name (or, with '' after cleaning, un-name) a keeper. True when stored. Never moves any other key. */
export function renameKeeper(id: string, raw: string, owner: string | null = saveOwner()): boolean {
  const r = ensureRoster(owner)
  if (!owner || !r || r.pending || !r.keepers.some(k => k.id === id)) return false
  try {
    const name = cleanKeeperName(raw), k = slotOf(r, owner, id, KEEPER_NAME_KEY)
    if (name) localStorage.setItem(k, name); else localStorage.removeItem(k)
    return true
  } catch { return false }
}

/** Why a keeper cannot be removed, or null when it can. The active keeper never can: swap first (Alex, M66). */
export function removeRefusal(id: string, owner: string | null = saveOwner()): 'anonymous' | 'unknown' | 'active' | 'last' | 'mid-swap' | null {
  if (!owner) return 'anonymous'
  const r = readRoster(owner)
  if (!r || !r.keepers.some(k => k.id === id)) return 'unknown'
  if (r.pending) return 'mid-swap'
  if (r.active === id) return 'active'
  if (r.keepers.length < 2) return 'last'
  return null
}

/**
 * Remove an INACTIVE keeper. Order is the safety: the roster entry goes FIRST (with a tombstone, so the next cloud push
 * lists it in `retired[]` and the server keeps its last data 30 days), the parked keys LAST, so a failure mid-way leaves
 * at worst unlisted parked bytes, never a listed keeper with half a body. Live keys are never touched. True when removed.
 */
export function removeKeeper(id: string, owner: string | null = saveOwner(), now = Date.now()): boolean {
  if (removeRefusal(id, owner) !== null) return false
  const r = readRoster(owner)!
  try {
    const retired = [...(r.retired ?? []).filter(t => t.id !== id && now - t.at < RETIRED_CARRY_MS), { id, at: now }]
    writeRoster(owner!, { v: 1, keepers: r.keepers.filter(k => k.id !== id), active: r.active, retired })
  } catch { return false }
  try { for (const base of parkedKeys(localStorage, owner!, id).keys()) localStorage.removeItem(parkedPrefix(owner!, id) + base) } catch { /* unlisted leftovers: harmless */ }
  return true
}
