// BETA M92 (Alex 11-22): the sounds page declutter. PENDING (proposed, unvoted) is the working list at the top; NAY rows carry
// Remove / Try again; APPROVED (yay) folds into a collapsed list at the bottom. Pure, so the page and the route share it.
type Voted = { id: string; status: string }   // string, not the union: the route reads raw JSON rows

export function sections<T extends Voted>(rows: T[]) {
  return { pending: rows.filter(r => r.status === 'proposed'), nay: rows.filter(r => r.status === 'nay'), approved: rows.filter(r => r.status === 'yay') }
}

/** REMOVE drops a NAY'd row from sounds.json (the game falls back to silent: play() only sounds a yay row). Only a nay row:
 *  a yay or pending row is one tap from a vote, never one tap from deletion. Returns the same array when it refuses. */
export function removeNay<T extends Voted>(rows: T[], id: string): { ok: boolean; rows: T[]; why?: string } {
  const row = rows.find(r => r.id === id)
  if (!row) return { ok: false, rows, why: `unknown sound id: ${id.slice(0, 60)}` }
  if (row.status !== 'nay') return { ok: false, rows, why: `only a nay sound can be removed (${id} is ${row.status})` }
  return { ok: true, rows: rows.filter(r => r.id !== id) }
}
