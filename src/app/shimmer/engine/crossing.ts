// THE CROSSING HANDOFF — how a keeper survives leaving one world for another.
//
// ── ★★★ THE CONTRACT, AGREED BETWEEN THE HUB AND WORLD LANES 2026-08-24 ──────────────────────
// Rune Hold and the Ather are not two coordinate systems, they are two SAVE RECORDS. The Ather side
// persists `PlayerSave {x,y,z,space}`; the town persists a zone id and tile coordinates. A crossing
// hands a keeper between them, and every way that can go wrong has already gone wrong once here.
//
// ★ 1. NEITHER RECORD IS CLEARED. They are not two copies of one fact — one says where you stand in
// the voxel world, the other where you stand in the town. A keeper has a real position in BOTH and
// should return to the one they left. The 2026-08-15 autopsy is what clearing costs: a region was
// emptied and every latent wrong-coordinate pointing into it became fatal.
//
// ★★ 2. THERE IS NO COMMITTED MIDDLE, AND THIS IS THE WHOLE DESIGN. Either the departure has not
// happened — the keeper reloads exactly where they stood, and the worst case is they walk into the
// gate again — or the arrival is complete. ⚠ The 08-15 bug FED ITSELF: a keeper autosaved in the
// garden reloaded into the Wilds at those numbers, which autosaved that position back, so no amount
// of reloading escaped. A crossing between two ROUTES has the same shape with a bigger radius.
// ⚠⚠ SO THE DEPARTURE MUST NOT MOVE THE KEEPER ON THE ATHER SIDE. That is the tempting symmetry —
// *"put them at the gate so they come back there"* — and it is exactly the committed middle.
//
// ★ 3. A KEEPER WITH NO TILE RECORD ARRIVES AT THE LANDING. Never an error, and never (0,0).
// ⚠ (0,0) is banned BY NAME rather than by accident: it is legal, it is inside the map, and it is
// the plausible-looking wrong answer — it reads as a placement bug rather than a missing record.
// Same family as a console `goto` landing in the fold's hollow: a coordinate that is legal and
// meaningless is worse than one that is obviously wrong.

/** The smallest store this needs. A Map in a test, `localStorage` in a browser. */
export interface Store {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
  removeItem(k: string): void
}

/** Where a keeper stands in the town. */
export interface TilePos { zone: string; x: number; y: number }

const PENDING = 'shimmer:crossing:pending'

/**
 * Stage an arrival. The ONLY write a departure performs.
 *
 * ★ It writes a one-shot and touches nothing else — not the Ather record, not the tile record. If
 * the tab dies now, the next load of the town consumes this and places the keeper; if it dies one
 * instruction earlier, nothing happened at all. Those are the only two states that exist.
 */
export function stageArrival(store: Store, to: TilePos): void {
  store.setItem(PENDING, JSON.stringify(to))
}

/**
 * Take the staged arrival, if there is one.
 *
 * ⚠⚠ READ-AND-CLEAR, AND THE CLEAR HAPPENS BEFORE THE CALLER ACTS ON IT. If the caller acted first
 * and cleared after, a crash between the two would leave the key set and re-place the keeper on the
 * next load — every load, forever. That is the 08-15 self-feeding state rebuilt by hand. Clearing
 * first means the worst case is one lost arrival, and a lost arrival is a keeper standing where
 * they already were.
 */
export function consumeArrival(store: Store): TilePos | null {
  const raw = store.getItem(PENDING)
  if (!raw) return null
  store.removeItem(PENDING)
  try {
    const p = JSON.parse(raw) as TilePos
    // A malformed one-shot is a missing one, not a crash. It has already been cleared.
    return typeof p?.zone === 'string' && Number.isFinite(p?.x) && Number.isFinite(p?.y) ? p : null
  } catch { return null }
}

export type ArrivalReason = 'staged' | 'returning' | 'first-visit'

/**
 * Where does this keeper stand when the town loads?
 *
 * ★ THE REASON IS RETURNED, NOT JUST THE PLACE. "First visit" and "returning" are different facts
 * and a caller may want to say so; more usefully, a test can assert WHY a keeper landed somewhere
 * rather than only that the numbers matched — which is the difference between a working fallback
 * and a coincidence.
 */
export function arrivalFor(
  staged: TilePos | null, saved: TilePos | null, landing: TilePos,
): { at: TilePos; why: ArrivalReason } {
  if (staged) return { at: staged, why: 'staged' }
  if (saved) return { at: saved, why: 'returning' }
  return { at: landing, why: 'first-visit' }
}

// ── ★★ THE OTHER DIRECTION HAS A DESTINATION TOO (Alex, 2026-09-16) ──────────────────────────
// *"the spirit corner should lead to moonwell glade tutorial area.. no?"* Yes — canon has TWO doors
// out of the town and they do not let out in the same place (`world/gates.md` › the crossing table,
// 08-12): the Spirit Corner is Gregory's private door and lets out on Greg's ground in the Glade;
// the square's public LANDING is the town's civic gate and lets out at the gate station's centre
// socket in the keeper's court. Both mortal doors used to navigate to the Ather with no destination
// at all, so the Ather restored the last position stood on — the plot, for anyone who had earned
// one — and Greg's door "led" to the court. Same shape as `stageArrival`: a one-shot, read-and-clear,
// nothing else touched. A malformed or stale value is a missing one: the Ather restores as before.

/** Where a mortal door lets out in the Ather. */
export type AtherEntry = 'glade' | 'court'
const ENTER = 'shimmer:crossing:enter'

export function stageEntry(store: Store, to: AtherEntry): void {
  store.setItem(ENTER, to)
}

/** Take the staged entry, if any. Cleared BEFORE it is returned — see `consumeArrival`. */
export function consumeEntry(store: Store): AtherEntry | null {
  const raw = store.getItem(ENTER)
  if (raw === null) return null
  store.removeItem(ENTER)
  return raw === 'glade' || raw === 'court' ? raw : null
}
