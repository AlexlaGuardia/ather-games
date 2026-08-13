// The Passage's scroll trade — how a keeper comes to HOLD a move.
//
// ★ PURE. No react, no three, no storage, no clock read of its own. The rack is a function of
// (seed, cycle); a purchase is a function of (book, wallet, move). The host owns time and money.
//
// ── ★ THE MODEL BUG THIS FIXES, AND IT IS THE WHOLE REASON THE PASSAGE HAS ANYTHING TO SELL ─────
// `keeper-moves.knownMoves(owned)` returns every move whose runes you carry. That reads as a
// catalogue lookup and it is really a claim about the fiction: *holding a rune teaches you every
// technique ever written in it.* Canon rules the opposite, and says so in the section title —
// "How a Move Is OBTAINED": a move is an APPLICATION, "someone else's discovered use of runes the
// keeper already carries… worked out, written down, sold, stolen, and learned." A rune is identity;
// a move is somebody's idea about it.
//
// So the rune was never the source of a move — it is the FILTER on one:
//   • rune you do not carry ⇒ the scroll is a beautiful piece of paper (canon's own words)
//   • rune you do carry ⇒ the scroll can teach you, ONCE, and then you know it
// Without the learned set there is no economy at all: every keeper already knows everything the
// rack could offer them, so the Passage would be a room with a table in it.
//
// `knownMoves` keeps its name and its meaning — it answers "what could this keeper read", which is
// exactly what a rack needs to grey out a row. What it stops meaning is "what this keeper can cast".
// That question is now `castable()`, and it is the intersection.
//
// ── WHAT IS CANON HERE AND WHAT IS MINE ─────────────────────────────────────────────────────────
// Canon (`game/moves.md` › How a Move Is Obtained, `world/rune-hold.md` › The Passage, both ruled
// 2026-08-03): a scroll teaches a MOVE never a RUNE · the rune gates the scroll · Passage stock is
// circulated Wonder-class goods out of the Crucible · ULTIMATES ARE NOT FOR SALE (a signature comes
// from a teacher, a bond, a debt — a story beat, not a transaction) · traders rotate and hold no
// permanent claim. The boundary note in moves.md hands me the rest BY NAME: "Price in Marks, rack
// size, rotation cadence, which moves appear when = the build's."
//
// ── ★ THE RACK IS THE SAME FOR EVERYONE. THIS IS NOT A DETAIL ───────────────────────────────────
// The tempting build is a rack filtered to what you can read — tidy, and it destroys the thing
// canon is actually describing: "the same rack means something different to every keeper who walks
// past it… this is what makes the market interesting rather than a vending machine." So `rackFor`
// takes NO runes. It cannot: it does not know who is looking. The filter is applied at the row, by
// the panel, as a visible state — you see the Metalergy scroll you cannot read, and that is the
// market telling you what you are.
//
// ── the returning pool ──────────────────────────────────────────────────────────────────────────
// Canon: traders rotate, nobody holds a permanent claim — and it never says a departed trader
// cannot come back. A rack that dealt without replacement would turn a missed cycle into a
// permanent loss, which is a punishment canon did not ask for and a player cannot see coming.
// So each cycle deals independently from the whole pool: what leaves WILL return. The oracle
// asserts it over a year of cycles rather than trusting the shuffle.

import { KEEPER_MOVES, knownMoves, type KeeperMove } from './keeper-moves'
import { CYCLE_MS } from '../engine/day-cycle'

/** What a keeper has actually learned — move ids, order irrelevant. The new half of the model. */
export interface Book {
  learned: readonly string[]
}

export const EMPTY_BOOK: Book = { learned: [] }

/** How many scrolls stand on the rack at once. A rack, not a warehouse: you should read all of it. */
export const RACK_SIZE = 6

/**
 * How long one rack stands. The traders turn over with the day — one in-game day is 64 real
 * minutes (`CYCLE_MS`), which is long enough that a rack is a thing you came back for and short
 * enough that "come back tomorrow" is a real sentence rather than a week's wait.
 */
export const ROTATION_MS = CYCLE_MS

/** Which rack is standing at this instant. Pure over the clock the caller passes in. */
export function cycleAt(nowMs: number): number {
  return Math.floor(nowMs / ROTATION_MS)
}

/** Real milliseconds until the traders change over — the panel's "the rack turns in…" line. */
export function msUntilRotation(nowMs: number): number {
  return ROTATION_MS - (((nowMs % ROTATION_MS) + ROTATION_MS) % ROTATION_MS)
}

/**
 * ★ CANON, NOT TUNING: the Passage stocks passives and tacticals. An ultimate is earned in the
 * world and the moment it is purchasable it stops meaning anything about who the keeper is.
 * `combo` is out too — a runeword is two mages in sync, which is not a thing a table can hand you.
 */
export function tradeable(m: KeeperMove): boolean {
  return m.tier === 'passive' || m.tier === 'tactical'
}

/** Every scroll that could ever appear down here. Pool, not rack. */
export const TRADE_POOL: readonly KeeperMove[] = KEEPER_MOVES.filter(tradeable)

// ── price ───────────────────────────────────────────────────────────────────────────────────────
// Build-side by canon's own boundary note. The shape says something true rather than being a
// number: a tactical costs more than a passive because it is the thing you throw; each extra rune
// a move is written in makes it rarer paper, since fewer keepers in the tunnel can read it at all;
// and a move canon says needs manatech or a second mage carries a surcharge for the apparatus.
const PRICE_BASE: Record<string, number> = { passive: 40, tactical: 65 }
const PRICE_PER_EXTRA_RUNE = 25
const PRICE_NEEDS_SURCHARGE = 30

export function priceOf(m: KeeperMove): number {
  const base = PRICE_BASE[m.tier] ?? 65
  const extra = Math.max(0, m.runes.length - 1) * PRICE_PER_EXTRA_RUNE
  return base + extra + (m.needs ? PRICE_NEEDS_SURCHARGE : 0)
}

// ── the rack ────────────────────────────────────────────────────────────────────────────────────

/** Deterministic 0..1 from a string. Same shape as the spawn board's `hash01` — a rack is a deal. */
function hash01(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}

/**
 * The scrolls standing on the rack this cycle. A pure function of (seed, cycle) — every keeper in
 * the tunnel sees the same rack in the same hour, the same way the spawn board deals one garden for
 * everybody, and closing the tab does not reroll it.
 *
 * ⚠ Takes NO rune inventory, deliberately. See the header.
 */
export function rackFor(seed: number, cycle: number, size = RACK_SIZE): KeeperMove[] {
  // Sort the whole pool by this cycle's key and take the top `size`. Dealing from the full pool
  // every time is what makes the pool RETURNING: nothing is consumed, so nothing is ever gone.
  return [...TRADE_POOL]
    .map((m) => ({ m, k: hash01(`${seed}|${cycle}|${m.id}`) }))
    .sort((a, b) => a.k - b.k || (a.m.id < b.m.id ? -1 : 1))
    .slice(0, size)
    .map((e) => e.m)
}

// ── what a keeper can read, know and cast ───────────────────────────────────────────────────────

/** Canon's filter: the reader must carry every rune the move is written in. */
export function canRead(m: KeeperMove, ownedRunes: readonly string[]): boolean {
  const have = new Set(ownedRunes)
  return m.runes.length > 0 && m.runes.every((r) => have.has(r))
}

export function hasLearned(book: Book, moveId: string): boolean {
  return book.learned.includes(moveId)
}

/**
 * ★ THE INTERSECTION, and the only question the cast layer should ever ask: a move you have LEARNED
 * and whose runes you still CARRY.
 *
 * Both halves are load-bearing and the second is the surprising one — a keeper can learn a move and
 * later lose the rune it is written in (nothing revokes runes in normal play today, but `/rune`
 * grants and revokes them, and canon's lane law is about a rune inventory that CHANGES). Reading a
 * scroll does not rewrite what you are. So knowledge is kept and the move goes quiet, rather than
 * the book being edited behind the player's back: get the rune again and it is still yours.
 */
export function castable(book: Book, ownedRunes: readonly string[]): KeeperMove[] {
  const readable = new Set(knownMoves(ownedRunes as string[]).map((m) => m.id))
  return KEEPER_MOVES.filter((m) => readable.has(m.id) && hasLearned(book, m.id))
}

export function learn(book: Book, moveId: string): Book {
  return hasLearned(book, moveId) ? book : { learned: [...book.learned, moveId] }
}

// ── the transaction ─────────────────────────────────────────────────────────────────────────────

/**
 * Why a purchase did not happen. Every one of these is a SENTENCE the player must see — the whole
 * `onSay` lesson from 2026-08-12: a refusal nobody can read is the same as a dead click, and a
 * dead click is the least visible bug a game can have.
 */
export type Refusal = 'not-stocked' | 'not-for-sale' | 'already-known' | 'unreadable' | 'too-dear'

export interface Purchase {
  ok: boolean
  book: Book
  marks: number
  /** The move, when one changed hands. */
  got?: KeeperMove
  why?: Refusal
  /** What the trader says. Always set — on a refusal it IS the feedback. */
  say: string
}

/**
 * Buy a scroll off the standing rack.
 *
 * ★ The unreadable case is a REFUSAL, not a sale. Canon's "owns a beautiful piece of paper" is an
 * illustration of the filter, not an instruction to let a player burn marks on nothing — and the
 * trader saying why is how the rule gets taught, which a silent bad purchase never does. If the
 * tragic version is ever wanted, this is the one branch to change.
 */
export function buy(
  book: Book, marks: number, ownedRunes: readonly string[], move: KeeperMove, rack: readonly KeeperMove[],
): Purchase {
  const no = (why: Refusal, say: string): Purchase => ({ ok: false, book, marks, why, say })

  if (!rack.some((m) => m.id === move.id)) return no('not-stocked', 'Nobody down here is holding that today.')
  if (!tradeable(move)) return no('not-for-sale', 'A signature is not bought over a table. Earn it.')
  if (hasLearned(book, move.id)) return no('already-known', 'You already carry that one.')
  if (!canRead(move, ownedRunes)) {
    return no('unreadable', `That is written in runes you do not carry. It would be a beautiful piece of paper.`)
  }
  const price = priceOf(move)
  if (marks < price) return no('too-dear', `${price} marks. Come back when you have them.`)

  return { ok: true, book: learn(book, move.id), marks: marks - price, got: move, say: `${move.name} is yours.` }
}

// ── seeding an existing keeper ──────────────────────────────────────────────────────────────────

/**
 * Gregory's gift, resolved against the keeper's own runes rather than fixed. A single hardcoded
 * starter would be unreadable for most keepers (canon: the rune gates the scroll), so it would be
 * ceremony that hands over a move nobody can cast.
 *
 * ⚠ Returns undefined for a keeper whose runes open NOTHING — 7 of the 17 birthable runes carry
 * their moves on the spirit-kits shelf, which a keeper never learns from. That is a content gap in
 * the registry, not a bug here, and the honest answer is an empty book rather than a fake move.
 */
export function starterFor(ownedRunes: readonly string[]): string | undefined {
  const mine = TRADE_POOL.filter((m) => canRead(m, ownedRunes))
  // A TACTICAL first, deliberately: Z and X are the keys a keeper reaches for, and a starter that
  // only fills the passive slot leaves the two throw keys dead — which is the complaint this whole
  // feature exists to answer. Falls back to a passive when the runes open nothing to throw.
  return (mine.find((m) => m.tier === 'tactical') ?? mine[0])?.id
}

/**
 * ★ THE MIGRATION, and it is a design decision rather than a data one. Every keeper alive today was
 * built under "your runes ARE your moves", so switching to a learned set would strip them silently —
 * the worst possible first contact with a feature that is supposed to GIVE you moves.
 *
 * A keeper keeps what they actually carry: everything BOUND in their loadout, plus the birth grant.
 * Not everything their runes allowed, because that would hand them the whole rack for free and the
 * Passage would open with nothing to sell them — the migration would quietly cancel the feature.
 *
 * ⚠ The birth grant is the honest floor: a keeper with an empty book has four dead cast keys and no
 * way to fix it except walking to a town they may not have found. `starter` should come from
 * Gregory's tutorial gift (he already hands over a grimoire, and canon has him with a back door
 * INTO the Passage) — the host passes what he gave, this file just refuses to leave the book empty.
 */
export function seedBook(bound: readonly (string | null)[], starter?: string): Book {
  const ids = bound.filter((id): id is string => !!id)
  if (starter && !ids.includes(starter)) ids.push(starter)
  return { learned: ids }
}
