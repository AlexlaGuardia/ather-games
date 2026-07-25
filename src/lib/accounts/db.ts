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
  d.exec(`
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
  `)
  _db = d
  return d
}

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

/** Test/maintenance seam — lets an oracle point the module at a scratch file. */
export function _openAt(path: string): DatabaseSync {
  const d = new DatabaseSync(path)
  _db = d
  d.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      user_id TEXT PRIMARY KEY, google_sub TEXT UNIQUE NOT NULL, email TEXT,
      username TEXT COLLATE NOCASE UNIQUE, character_id TEXT, avatar TEXT, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS friends (
      a_id TEXT NOT NULL, b_id TEXT NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL,
      PRIMARY KEY (a_id, b_id));
  `)
  return d
}
