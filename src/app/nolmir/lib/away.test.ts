// NOLMIR idle — the homecoming settle. The invariant that matters most for an
// idle game: the away haul is banked EXACTLY ONCE and lines up whether you open
// the Command Deck or the Crucible page (deterministic seeds + host.lastSeenAt).
// Uses an in-memory localStorage shim. Run: npx tsx src/app/nolmir/lib/away.test.ts
import { settleHomecoming, MATCH_INTERVAL, AWAY_CAP } from './away'
import { saveHost } from './host'
import { defaultForge, saveForge } from './starforge'
import type { HostState } from './types'

// ── in-memory localStorage (no top-level access in the modules, so this is in
// place before any load/save runs) ──────────────────────────────────────────
const store = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage

let pass = 0, fail = 0
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name}`) }
}

const HR = 3600_000
const NOW = 100 * HR // exactly on a 20-min boundary (100h / 20min = 300)

// seed a fresh world; optionally set when the host last held the watch
function seed(lastSeenAt?: number) {
  store.clear()
  saveForge(defaultForge(NOW))
  const host: HostState = { mana: 500, exp: 0, ledger: [] }
  if (lastSeenAt !== undefined) host.lastSeenAt = lastSeenAt
  saveHost(host)
}

// ── first visit arms the clock — no retroactive windfall ────────────────────
{
  seed(undefined)
  const h = settleHomecoming(NOW)
  ok('a first visit banks no away matches', h.away === null)
  ok('first visit still stamps lastSeenAt', h.host.lastSeenAt === NOW)
}

// ── an away window accrues matches on the 20-min cadence ────────────────────
{
  seed(NOW - 61 * 60 * 1000) // 61 minutes ago → 3 match boundaries
  const h = settleHomecoming(NOW)
  ok('an away window accrues matches', h.away !== null && h.away.matches >= 3 && h.away.matches <= 4)
  ok('the away digest reports mana', (h.away?.mana ?? -1) >= 0)
  ok('matches land in the ledger', h.host.ledger.length >= 3)
  ok('the digest keeps the deepest run', h.away?.best != null)
}

// ── THE idempotency guard: whoever loads first banks the haul ───────────────
{
  seed(NOW - 40 * 60 * 1000) // 2 matches
  const first = settleHomecoming(NOW)
  ok('the first load banks the away matches', (first.away?.matches ?? 0) >= 2)
  // the SECOND surface to load at the same instant sees an empty window
  const second = settleHomecoming(NOW)
  ok('re-settling the same instant banks nothing (idempotent)', second.away === null)
  // and nothing new accrues until the next 20-min boundary
  const soon = settleHomecoming(NOW + 60_000)
  ok('no new match before the next boundary', soon.away === null)
  const next = settleHomecoming(NOW + MATCH_INTERVAL)
  ok('the next boundary brings exactly one match', next.away?.matches === 1)
}

// ── the beacon dims past the cap (two days) ─────────────────────────────────
{
  seed(NOW - 200 * HR) // 600 intervals → capped
  const h = settleHomecoming(NOW)
  ok('away matches cap at AWAY_CAP (144)', h.away?.matches === AWAY_CAP)
}

// ── deterministic — a reload can't reroll history ───────────────────────────
{
  seed(NOW - 20 * HR)
  const a = settleHomecoming(NOW).away
  seed(NOW - 20 * HR) // identical inputs, fresh store
  const b = settleHomecoming(NOW).away
  ok('same window → same mana (deterministic seeds)', a?.mana === b?.mana)
  ok('same window → same exp', a?.exp === b?.exp)
  ok('same window → same match count', a?.matches === b?.matches)
}

// ── mana can be spent by vault-losses but never goes negative ───────────────
{
  seed(NOW - 48 * HR) // a long haul → plenty of chances for vault-falls
  const h = settleHomecoming(NOW)
  ok('host mana never goes negative across a long haul', h.host.mana >= 0)
  ok('corelight comes back with the homecoming', h.corelight >= 0)
}

console.log(`\nAWAY homecoming: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
