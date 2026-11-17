// ── ather.games accounts store ────────────────────────────────────────────────
//
// The first real datastore in this app. Accounts + friends are genuinely relational
// (lookup by google sub, by username, uniqueness, bidirectional edges), which is where the
// house file-JSON style gets awkward — so this is sqlite.
//
// ⚠ DEVIATION FROM ACCOUNTS_SPEC: the spec called for `better-sqlite3`. This box runs Node
// 24, which ships `node:sqlite` (DatabaseSync) in core — same synchronous single-file API,
// zero npm dependency, no node-gyp native build to keep alive across Node upgrades. Node
// still prints one ExperimentalWarning for the module at load; that is the whole cost.
//
// Single PM2 process owns this file, so the in-process synchronous model is exactly right
// and there is no cross-process locking to think about. The WS server never opens it (the
// Next↔WS bridge is a signed JWT, by design) — keep it that way.

import { DatabaseSync } from 'node:sqlite'
import { randomBytes } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

export interface Account {
  user_id: string
  google_sub: string
  email: string | null
  username: string | null
  character_id: string | null
  avatar: string | null
  created_at: number
}

export const USERNAME_RE = /^[a-zA-Z0-9_]{3,16}$/

// Names that must never belong to a person: 'player'/'wanderer' are the anonymous defaults
// rendered elsewhere in the app, the rest would let someone impersonate the house.
const RESERVED = new Set(['player', 'wanderer', 'admin', 'administrator', 'mod', 'moderator', 'system', 'ather', 'athergames', 'root', 'null', 'undefined'])

const DATA_DIR = join(process.cwd(), 'data')
const DB_PATH = join(DATA_DIR, 'accounts.db')

let _db: DatabaseSync | null = null

function db(): DatabaseSync {
  if (_db) return _db
  mkdirSync(DATA_DIR, { recursive: true })
  const d = new DatabaseSync(DB_PATH)
  d.exec(SCHEMA)
  migrateSaves(d)
  _db = d
  return d
}

/** M12 (docs/M12-cloud-save.md §1): additive columns on `saves` for the open world's rev/CAS + write lease.
 *  Idempotent (PRAGMA first), runs on every open, never touches existing rows' data. */
function migrateSaves(d: DatabaseSync): void {
  const have = new Set((d.prepare('PRAGMA table_info(saves)').all() as Array<{ name: string }>).map(c => c.name))
  if (!have.has('rev')) d.exec('ALTER TABLE saves ADD COLUMN rev INTEGER NOT NULL DEFAULT 0')
  if (!have.has('lease_device')) d.exec('ALTER TABLE saves ADD COLUMN lease_device TEXT')
  if (!have.has('lease_at')) d.exec('ALTER TABLE saves ADD COLUMN lease_at INTEGER')
}

const SCHEMA = `
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS accounts (
      user_id      TEXT PRIMARY KEY,
      google_sub   TEXT UNIQUE NOT NULL,
      email        TEXT,
      username     TEXT COLLATE NOCASE UNIQUE,
      character_id TEXT,
      avatar       TEXT,
      created_at   INTEGER NOT NULL
    );

    -- One row per friendship edge (requester -> target). Reads treat 'accepted' as
    -- bidirectional; 'pending' keeps its direction so the UI can split incoming/outgoing.
    CREATE TABLE IF NOT EXISTS friends (
      a_id       TEXT NOT NULL,
      b_id       TEXT NOT NULL,
      status     TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (a_id, b_id)
    );
    CREATE INDEX IF NOT EXISTS idx_friends_b ON friends(b_id);

    -- Cloud saves: one blob per (account, game). The client is authoritative while playing
    -- (localStorage) — this is the copy that survives the browser, keyed to the account so a
    -- keeper's garden follows them across devices. Stage 2 of per-keeper Home Plots (07-31).
    CREATE TABLE IF NOT EXISTS saves (
      user_id    TEXT NOT NULL,
      game       TEXT NOT NULL,
      data       TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, game)
    );

    -- ── Garden clusters (canon: game/shimmer-geography.md › GARDEN CLUSTERS; clusters.ts) ──────
    -- A cluster is ONE fold with four quarters. folded_by is a RECORD (who raised the barn), never
    -- a role: nothing reads it to grant anything. There is deliberately no column for a leader,
    -- owner or title, and no statement anywhere that removes a member other than themselves.
    CREATE TABLE IF NOT EXISTS clusters (
      cluster_id TEXT PRIMARY KEY,
      folded_by  TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    -- One quarter per member; UNIQUE(user_id) = a keeper stands in at most one cluster.
    -- seed/tier are the member's OWN plot, reported by their own client (offline-first).
    CREATE TABLE IF NOT EXISTS cluster_members (
      cluster_id TEXT NOT NULL,
      quarter    TEXT NOT NULL CHECK (quarter IN ('ne','nw','sw','se')),
      user_id    TEXT NOT NULL UNIQUE,
      seed       INTEGER NOT NULL DEFAULT 0,
      tier       INTEGER NOT NULL DEFAULT 0,
      joined_at  INTEGER NOT NULL,
      PRIMARY KEY (cluster_id, quarter)
    );
    -- When a member was last IN THE WORLD (their game pings while it is open and visible), so a
    -- mate's client can show that keeper's gate station dormant while they are away. A time, never
    -- a place: it says nothing about where they were. ⛔ Nothing here may change GROUND — canon's
    -- "folded once, holds" (clusters.ts): away dims a lamp, it never greys or removes a thing.
    CREATE TABLE IF NOT EXISTS cluster_seen (
      user_id TEXT PRIMARY KEY,
      seen_at INTEGER NOT NULL
    );
    -- An open quarter offered to one friend. Filled only when EVERY current member has consented
    -- (canon: you cannot give away someone else's corner) and the invitee accepts.
    CREATE TABLE IF NOT EXISTS cluster_offers (
      cluster_id  TEXT NOT NULL,
      quarter     TEXT NOT NULL CHECK (quarter IN ('ne','nw','sw','se')),
      invitee_id  TEXT NOT NULL,
      proposed_by TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      PRIMARY KEY (cluster_id, quarter)
    );
    CREATE TABLE IF NOT EXISTS cluster_consents (
      cluster_id TEXT NOT NULL,
      quarter    TEXT NOT NULL,
      member_id  TEXT NOT NULL,
      PRIMARY KEY (cluster_id, quarter, member_id)
    );
    -- A member's plot, as the last picture their own client uploaded (cluster phase 3). One-way:
    -- the keeper's browser is the only place the garden is written; this is what their mates see,
    -- read-only. Only a CURRENT member can write one, only their cluster-mates can read it, and it
    -- goes with the corner (takeBackCorner) and with the account.
    CREATE TABLE IF NOT EXISTS cluster_plots (
      user_id    TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    -- The open world's version (2026-11-15): a member's Ather plot as the squares they hold (ather/garden-snapshot.ts).
    -- Same rules as cluster_plots: only a current member writes, only their mates read, it leaves with the corner.
    CREATE TABLE IF NOT EXISTS cluster_gardens (
      user_id    TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
`

/** Our own stable id — deliberately NOT the google sub, so a provider can change later. */
export function newUserId(): string {
  return `u_${randomBytes(9).toString('hex')}`
}

/** First login creates the account; every later login just refreshes the google-side fields. */
export function upsertGoogleAccount(google_sub: string, email: string | null, avatar: string | null): Account {
  const d = db()
  const existing = d.prepare('SELECT * FROM accounts WHERE google_sub = ?').get(google_sub) as Account | undefined
  if (existing) {
    d.prepare('UPDATE accounts SET email = ?, avatar = ? WHERE user_id = ?').run(email, avatar, existing.user_id)
    return { ...existing, email, avatar }
  }
  const account: Account = {
    user_id: newUserId(),
    google_sub,
    email,
    username: null,
    character_id: null,
    avatar,
    created_at: Date.now(),
  }
  d.prepare(
    'INSERT INTO accounts (user_id, google_sub, email, username, character_id, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(account.user_id, account.google_sub, account.email, account.username, account.character_id, account.avatar, account.created_at)
  return account
}

export function getAccount(user_id: string): Account | null {
  return (db().prepare('SELECT * FROM accounts WHERE user_id = ?').get(user_id) as Account | undefined) ?? null
}

export function getAccountByUsername(username: string): Account | null {
  // COLLATE NOCASE on the column makes this case-insensitive, which is what the uniqueness
  // guarantee means — 'Alex' and 'alex' are the same person, not two.
  return (db().prepare('SELECT * FROM accounts WHERE username = ?').get(username) as Account | undefined) ?? null
}

export type NameCheck = { available: true } | { available: false; reason: string }

/** Shape + reserved + taken, in that order, so the caller can show one honest message. */
export function checkUsername(username: string, forUserId?: string): NameCheck {
  if (!USERNAME_RE.test(username)) return { available: false, reason: 'Letters, numbers, and underscores. 3-16 characters.' }
  if (RESERVED.has(username.toLowerCase())) return { available: false, reason: 'That name is reserved' }
  const held = getAccountByUsername(username)
  if (held && held.user_id !== forUserId) return { available: false, reason: 'Username taken' }
  return { available: true }
}

export type ClaimResult = { ok: true; account: Account } | { ok: false; error: string }

/**
 * Claim (or change) a username. Design call 3 is CLAIM-ONCE, CHANGEABLE RARELY — v1 allows a
 * change and does not rate-limit it; the leaderboard renders the current name either way, so
 * a later cooldown is additive. The UNIQUE index is the real guard: two people racing the
 * same free name means one INSERT wins and the other lands here as 'Username taken'.
 */
export function claimUsername(user_id: string, username: string, character_id?: string | null): ClaimResult {
  const check = checkUsername(username, user_id)
  if (!check.available) return { ok: false, error: check.reason }
  try {
    db().prepare('UPDATE accounts SET username = ?, character_id = COALESCE(?, character_id) WHERE user_id = ?')
      .run(username, character_id ?? null, user_id)
  } catch {
    return { ok: false, error: 'Username taken' }
  }
  const account = getAccount(user_id)
  return account ? { ok: true, account } : { ok: false, error: 'Account not found' }
}

// ── friends ───────────────────────────────────────────────────────────────────
//
// One row per friendship, stored in the direction it was requested (a_id asked b_id).
// 'accepted' is read as bidirectional; 'pending' keeps its direction so the UI can tell
// "you asked them" from "they asked you". That is the whole model — deliberately no
// blocking, no follows, no one-way edges.

export interface FriendRow {
  user_id: string
  username: string
  character_id: string | null
  status: string
  incoming: boolean
}

/** Everyone you are connected to or have a pending request with, in one list. */
export function listFriends(user_id: string): FriendRow[] {
  const rows = db().prepare(`
    SELECT a.user_id, a.username, a.character_id, f.status,
           -- "incoming" means they asked YOU and you have not answered. It is only
           -- meaningful while pending: once accepted the relationship is undirected, and
           -- reporting a direction there invites a caller to render one side as a request.
           CASE WHEN f.b_id = ? AND f.status = 'pending' THEN 1 ELSE 0 END AS incoming
    FROM friends f
    JOIN accounts a ON a.user_id = CASE WHEN f.a_id = ? THEN f.b_id ELSE f.a_id END
    WHERE (f.a_id = ? OR f.b_id = ?) AND a.username IS NOT NULL
    ORDER BY f.status, a.username COLLATE NOCASE
  `).all(user_id, user_id, user_id, user_id) as Array<Omit<FriendRow, 'incoming'> & { incoming: number }>
  return rows.map(r => ({ ...r, incoming: r.incoming === 1 }))
}

export type FriendResult = { ok: true; friend: FriendRow; accepted?: boolean } | { ok: false; error: string }

/**
 * Send a request by username.
 *
 * The one non-obvious rule: if THEY already asked YOU, this accepts instead of opening a
 * second edge pointing the other way. Two people adding each other at the same time is a
 * normal thing to do, and it should mean "you are friends", not "you each have a pending
 * request from someone you already asked".
 */
export function addFriend(user_id: string, username: string): FriendResult {
  const target = getAccountByUsername(username)
  if (!target || !target.username) return { ok: false, error: 'No player by that name' }
  if (target.user_id === user_id) return { ok: false, error: 'You cannot add yourself' }

  const d = db()
  const existing = d.prepare(
    'SELECT a_id, b_id, status FROM friends WHERE (a_id = ? AND b_id = ?) OR (a_id = ? AND b_id = ?)',
  ).get(user_id, target.user_id, target.user_id, user_id) as { a_id: string; b_id: string; status: string } | undefined

  const row = (status: string, incoming: boolean): FriendRow => ({
    user_id: target.user_id, username: target.username!, character_id: target.character_id, status, incoming,
  })

  if (existing) {
    if (existing.status === 'accepted') return { ok: false, error: 'Already friends' }
    // They asked first — meeting in the middle accepts.
    if (existing.a_id === target.user_id) {
      d.prepare('UPDATE friends SET status = ? WHERE a_id = ? AND b_id = ?').run('accepted', target.user_id, user_id)
      return { ok: true, friend: row('accepted', false), accepted: true }
    }
    return { ok: false, error: 'Request already sent' }
  }

  d.prepare('INSERT INTO friends (a_id, b_id, status, created_at) VALUES (?, ?, ?, ?)')
    .run(user_id, target.user_id, 'pending', Date.now())
  return { ok: true, friend: row('pending', false) }
}

/** Accept a request that was sent TO you. Accepting one you sent is not a thing. */
export function acceptFriend(user_id: string, otherId: string): boolean {
  const res = db().prepare(
    "UPDATE friends SET status = 'accepted' WHERE a_id = ? AND b_id = ? AND status = 'pending'",
  ).run(otherId, user_id)
  return Number(res.changes) > 0
}

/** Remove, decline, or cancel — all the same operation on an undirected relationship. */
export function removeFriend(user_id: string, otherId: string): boolean {
  const res = db().prepare(
    'DELETE FROM friends WHERE (a_id = ? AND b_id = ?) OR (a_id = ? AND b_id = ?)',
  ).run(user_id, otherId, otherId, user_id)
  return Number(res.changes) > 0
}

/** Are these two actually friends? The gate every invite and garden visit has to pass. */
export function areFriends(a: string, b: string): boolean {
  const row = db().prepare(
    "SELECT 1 FROM friends WHERE status = 'accepted' AND ((a_id = ? AND b_id = ?) OR (a_id = ? AND b_id = ?))",
  ).get(a, b, b, a)
  return !!row
}

/**
 * Right to erasure, and it is a real delete — the account row and every friend edge that
 * mentions it, gone. Nothing here is soft-deleted or tombstoned, because a privacy page
 * that says "we delete it" and a DB that keeps a shadow copy is a lie with extra steps.
 *
 * NOT covered (and the privacy page says so): the garden save, which lives in the player's
 * own browser and was never ours to delete, and any arcade score rows, which are keyed by a
 * derived id in a public daily board — those age out with the board.
 */
export interface SaveRow { data: string; updated_at: number }

export function getSave(user_id: string, game: string): SaveRow | null {
  const row = db().prepare('SELECT data, updated_at FROM saves WHERE user_id = ? AND game = ?').get(user_id, game) as SaveRow | undefined
  return row ?? null
}

export function putSave(user_id: string, game: string, data: string): void {
  db().prepare(
    'INSERT INTO saves (user_id, game, data, updated_at) VALUES (?, ?, ?, ?) ' +
    'ON CONFLICT(user_id, game) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
  ).run(user_id, game, data, Date.now())
}

// ── the open world's save (game = 'open'): revision + compare-and-swap + write lease ─────────────────────────
export const OPEN_GAME = 'open'
export const OPEN_LEASE_MS = 10 * 60 * 1000

export interface OpenSaveRow { data: string; rev: number; lease_device: string | null; lease_at: number | null }

export function getOpenSave(user_id: string): OpenSaveRow | null {
  const row = db().prepare('SELECT data, rev, lease_device, lease_at FROM saves WHERE user_id = ? AND game = ?')
    .get(user_id, OPEN_GAME) as OpenSaveRow | undefined
  return row ?? null
}

/** Compare and swap. Returns the new rev, or null = stale (someone wrote first). One UPDATE, so atomic.
 *  INSERT only when there is no row and base_rev = 0. A successful write also refreshes the writer's lease. */
export function casOpenSave(user_id: string, base_rev: number, data: string, device: string | null = null): number | null {
  const d = db()
  const now = Date.now()
  const res = d.prepare(
    'UPDATE saves SET data = ?, rev = rev + 1, updated_at = ?, lease_device = COALESCE(?, lease_device), lease_at = CASE WHEN ? IS NULL THEN lease_at ELSE ? END ' +
    'WHERE user_id = ? AND game = ? AND rev = ?',
  ).run(data, now, device, device, now, user_id, OPEN_GAME, base_rev)
  if (Number(res.changes) > 0) return base_rev + 1
  if (base_rev !== 0) return null
  try {
    d.prepare('INSERT INTO saves (user_id, game, data, updated_at, rev, lease_device, lease_at) VALUES (?, ?, ?, ?, 1, ?, ?)')
      .run(user_id, OPEN_GAME, data, now, device, device ? now : null)
    return 1
  } catch { return null }   // row appeared between the UPDATE and the INSERT: stale
}

/** Take the write lease for `device`. False when no row exists yet (the first push claims it). */
export function takeOpenLease(user_id: string, device: string): boolean {
  const res = db().prepare('UPDATE saves SET lease_device = ?, lease_at = ? WHERE user_id = ? AND game = ?')
    .run(device, Date.now(), user_id, OPEN_GAME)
  return Number(res.changes) > 0
}

/** Does another device hold a LIVE (unexpired) lease? */
export function leaseHeldByOther(row: Pick<OpenSaveRow, 'lease_device' | 'lease_at'>, device: string, now = Date.now()): boolean {
  return !!row.lease_device && row.lease_device !== device && row.lease_at !== null && now - row.lease_at < OPEN_LEASE_MS
}

export function deleteAccount(user_id: string): boolean {
  const d = db()
  d.prepare('DELETE FROM friends WHERE a_id = ? OR b_id = ?').run(user_id, user_id)
  // Erasure takes the keeper's corner back exactly as they could themselves (clusters.ts):
  // their quarter goes, every offer TO them goes, their consents go. The rest stand.
  d.prepare('DELETE FROM cluster_members WHERE user_id = ?').run(user_id)
  d.prepare('DELETE FROM cluster_offers WHERE invitee_id = ? OR proposed_by = ?').run(user_id, user_id)
  d.prepare('DELETE FROM cluster_consents WHERE member_id = ?').run(user_id)
  d.prepare('DELETE FROM cluster_plots WHERE user_id = ?').run(user_id)
  d.prepare('DELETE FROM cluster_gardens WHERE user_id = ?').run(user_id)
  d.prepare('DELETE FROM cluster_seen WHERE user_id = ?').run(user_id)
  d.prepare('DELETE FROM saves WHERE user_id = ?').run(user_id)
  const res = d.prepare('DELETE FROM accounts WHERE user_id = ?').run(user_id)
  return Number(res.changes) > 0
}

/** The shared handle, for the stores that live beside accounts (clusters.ts). Same file, one schema. */
export function accountsDb(): DatabaseSync { return db() }

/** Test/maintenance seam — lets an oracle point the module at a scratch file.
 *  Runs the SAME schema as db() — it used to carry its own trimmed copy, which silently
 *  lacked the `saves` table the day that table was added. One schema, two doors. */
export function _openAt(path: string): DatabaseSync {
  const d = new DatabaseSync(path)
  _db = d
  d.exec(SCHEMA)
  migrateSaves(d)
  return d
}
