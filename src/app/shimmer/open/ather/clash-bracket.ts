// BETA M233 v2a: CLASH's LINE-UP TREE (Alex 11-27: "a tournament panel shows the line-up tree, bouts run one by one until the
// keeper's turn"). PURE; no React. A single-elimination bracket of the keeper's spirit + the tent's pregenerated line-up
// (fair-clash.ts clashLineup). Entrant 0 is always HER spirit; 1..n are the line-up in order. Round one pairs the line-up off
// and puts her in the LAST pair, so the troupe's bouts run first and hers comes when the tree reaches her. Each later round
// pairs the winners. Her run ends when she is beaten or wins the last bout (= the tent is won).
// A field must be a power of two (the line-up = 2^k - 1: LINEUP_SIZE 3 -> 4 entrants, 3 bouts, 2 of them hers).

export const YOU = 0
export interface Bout { round: number; a: number | null; b: number | null; winner: number | null }
export interface Bracket { size: number; bouts: Bout[] }

const isPow2 = (n: number) => n >= 2 && (n & (n - 1)) === 0

/** the tree for her + `foes` line-up spirits (bouts listed in the order they are fought: round by round) */
export function newBracket(foes: number): Bracket {
  const size = foes + 1
  if (!isPow2(size)) throw new Error(`clash bracket: ${foes} foes + her is not a power of two`)
  const seats = [...Array.from({ length: foes }, (_, i) => i + 1), YOU], bouts: Bout[] = []
  for (let i = 0; i < size; i += 2) bouts.push({ round: 0, a: seats[i], b: seats[i + 1], winner: null })
  for (let r = 1, n = size / 4; n >= 1; r++, n /= 2) for (let i = 0; i < n; i++) bouts.push({ round: r, a: null, b: null, winner: null })
  return { size, bouts }
}

export const rounds = (b: Bracket) => Math.log2(b.size)
/** bout `i`'s two feeder bouts (round > 0), by position */
function feeders(b: Bracket, i: number): [number, number] | null {
  const bt = b.bouts[i]; if (bt.round === 0) return null
  let start = 0, n = b.size / 2
  for (let r = 0; r < bt.round - 1; r++) { start += n; n /= 2 }
  const here = start + n, k = i - here
  return [start + 2 * k, start + 2 * k + 1]
}
export const hasYou = (bt: Bout) => bt.a === YOU || bt.b === YOU
/** her run is over: she lost a bout, or the last bout is decided */
export const keeperOut = (b: Bracket) => b.bouts.some(bt => hasYou(bt) && bt.winner !== null && bt.winner !== YOU)
export const keeperWon = (b: Bracket) => b.bouts[b.bouts.length - 1].winner === YOU
export const runOver = (b: Bracket) => keeperOut(b) || b.bouts[b.bouts.length - 1].winner !== null

// ── BETA M233 s4 EVENT LOBBY: a CHORD's field. Every seat is a spirit in its own right (a chord member's or a troupe filler),
// seats paired in order (0 v 1, 2 v 3, ...), and the tree runs to its final whoever falls: every keeper in the chord watches
// the whole tournament. `full` on the helpers below = this rule (the solo tree stops when HER run is over).
/** a field of `size` seats paired in order (a power of two) */
export function newField(size: number): Bracket {
  if (!isPow2(size)) throw new Error(`clash field: ${size} is not a power of two`)
  const bouts: Bout[] = []
  for (let i = 0; i < size; i += 2) bouts.push({ round: 0, a: i, b: i + 1, winner: null })
  for (let r = 1, n = size / 4; n >= 1; r++, n /= 2) for (let i = 0; i < n; i++) bouts.push({ round: r, a: null, b: null, winner: null })
  return { size, bouts }
}
/** the final's winner (a seat), or null while it is undecided */
export const champion = (b: Bracket): number | null => b.bouts[b.bouts.length - 1].winner
export const fieldOver = (b: Bracket) => champion(b) !== null
export const hasSeat = (bt: Bout, seat: number) => bt.a === seat || bt.b === seat

/** the next bout to fight (both seats known, no winner), or null when her run is over (`full`: when the final is decided) */
export function nextBout(b: Bracket, full = false): number | null {
  if (full ? fieldOver(b) : runOver(b)) return null
  const i = b.bouts.findIndex(bt => bt.winner === null && bt.a !== null && bt.b !== null)
  return i < 0 ? null : i
}

/** record bout `i`'s winner (one of its two seats) and fill the later round's seat */
export function recordBout(b: Bracket, i: number, winner: number): Bracket {
  const bt = b.bouts[i]
  if (!bt || bt.winner !== null || (winner !== bt.a && winner !== bt.b)) throw new Error(`clash bracket: bad result ${winner} for bout ${i}`)
  const bouts = b.bouts.map(x => ({ ...x }))
  bouts[i].winner = winner
  for (let j = 0; j < bouts.length; j++) {
    const f = feeders({ size: b.size, bouts }, j); if (!f) continue
    if (bouts[j].a === null && bouts[f[0]].winner !== null) bouts[j].a = bouts[f[0]].winner
    if (bouts[j].b === null && bouts[f[1]].winner !== null) bouts[j].b = bouts[f[1]].winner
  }
  return { size: b.size, bouts }
}
