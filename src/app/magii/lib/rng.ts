// ── Seeded randomness for the card table ──────────────────────────────────────
//
// The card game is a pure reducer: every action is (state, player, args) -> new state. That
// means a whole game is reproducible from two things — the opening deal and the list of
// moves. The deal is the only piece that was not reproducible, because the shuffle read
// Math.random.
//
// With a seed, two players on two machines build the SAME deck from the same string, and
// netplay becomes "relay the moves" instead of "relay the game state". It also makes the
// engine testable, which is why this landed before any of the multiplayer work.
//
// mulberry32: 32-bit, tiny, well-distributed enough for dealing cards. This is not for
// anything security-bearing — a shuffle a player could predict only matters if the seed is
// secret, and the server hands out seeds, so it never is on the client's side to guess
// before the deal.

export type Rng = () => number

/** FNV-1a — turns a readable seed ("table-7F3K") into the 32-bit state mulberry32 wants. */
function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  // A zero state makes mulberry32 degenerate; nudge it off.
  return h === 0 ? 0x9e3779b9 : h
}

/** Same seed in, same sequence out, on every machine and every run. */
export function makeRng(seed: string | number): Rng {
  let a = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed)
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A fresh seed for a local game. Readable on purpose: it ends up in logs, in a bug report,
 * and eventually on the wire, and "table-8F3K2Q" is a thing a person can repeat back.
 */
export function newSeed(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1 — misread out loud
  let s = ''
  for (let i = 0; i < 8; i++) s += A[Math.floor(Math.random() * A.length)]
  return s
}
