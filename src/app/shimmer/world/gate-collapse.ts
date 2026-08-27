// REGROUPING PAINTED TILES BACK INTO DOORS — the write half of `expandGate`.
//
// ★ WHY THIS IS A MODULE AND NOT TWENTY LINES INSIDE THE SAVE ROUTE. It used to be the latter, and
// that is how it went wrong: a rule that lives in a route handler is a rule no oracle can reach, so
// nothing ever asserted that a door painted in the editor survives the trip back to `zones.ts`.
// `expandGate` (gate -> tiles) has been exercised by every zone on every module load since it was
// written; its inverse (tiles -> gate) had no test at all. The bug below sat in it for three days.
//
// ── ★★★ THE BUG THIS EXISTS TO HAVE CAUGHT: "A GATE IS SQUARE BY DEFINITION" ─────────────────
// `Gate` was widened with `w`/`h` on 2026-08-24 for one named reason — Alex asked for a 1x2 landing
// in the Rune Hold square and it could not be expressed. The READ path moved with it (`gateFootprint`
// is the one answer, and its comment names the four places that used to re-derive `size ?? 2`). Two
// WRITE-path consumers did not: the map editor's stamp only ever laid a square, and this collapse
// refused a non-square group outright and pushed its tiles to the loose pile.
//
// ⚠⚠ AND THE REFUSAL WAS SILENT AND LOSSY, WHICH IS THE PART THAT MATTERS. A loose warp serializes
// with NO `gate` field, so the demotion does not merely lose the footprint, **it destroys the
// label** — and the label is the only thing `landingGate()` looks for. Painting THE LANDING, saving,
// and getting HTTP 200 would have left `crossingReady()` false with nothing on screen to say why.
// Same family as the map editor answering 200 and writing nothing: the operation reported success
// because the operation it performed did succeed. It was not the operation anyone asked for.
//
// ★ THE WIDENED-UNION SHAPE, FOR THE NEXT ONE: widening a type leaves its consumers stale AND
// QUIET. Grep the writers when you widen a reader, and vice versa; agreement between the halves is
// not something the compiler can check when the extra field is optional.

/** One painted tile as the editor hands it over. Loose warps and gate tiles have the same shape. */
export interface PaintedWarp {
  fromX: number
  fromY: number
  toZone: string
  toX: number
  toY: number
  direction?: string
  requiredFlag?: string
  /** The door's nametag. Its presence is what makes this tile part of a gate rather than a warp. */
  gate?: string
  ownerOnly?: boolean
}

/**
 * A door recovered from its tiles. `w`/`h` are always explicit here — deciding whether they are
 * DEFAULTABLE (2x2 needs neither, a square needs `size`, a rectangle needs both) is a serialization
 * question, and this module deliberately does not answer it. Returning data instead of source text
 * is what lets the round-trip test compare a gate to a gate rather than a string to a string.
 */
export interface CollapsedGate {
  x: number
  y: number
  w: number
  h: number
  toZone: string
  toX: number
  toY: number
  direction?: string
  label: string
  requiredFlag?: string
  ownerOnly?: boolean
}

/**
 * Tiles that share a label AND a destination are one door. Everything in the key has to match,
 * because two doors on one map may legitimately carry the same nametag (`RUNE HOLD` is on three
 * different maps) and merging them by label alone would invent a gate spanning both.
 */
const groupKey = (w: PaintedWarp): string =>
  `${w.gate}|${w.toZone}|${w.toX}|${w.toY}|${w.direction ?? ''}|${w.requiredFlag ?? ''}|${w.ownerOnly === true}`

/**
 * Painted tiles in, doors and loose warps out.
 *
 * ── ★★ THE ACCEPTANCE TEST IS "DO THE TILES FILL THEIR OWN BOUNDING BOX", AND IT IS CHECKED BY
 * MEMBERSHIP, NOT BY COUNT. The cheap version — `tiles.length === w * h` — is satisfied by a
 * payload holding the same tile twice, which would write a gate whose footprint claims cells that
 * do not warp. That is the failure this refusal exists to prevent, so counting cannot be how it
 * decides. Every cell of the box has to be present.
 *
 * ⚠ A GROUP THAT FAILS STAYS WHOLE AND GOES LOOSE. Its tiles still warp — a keeper standing on one
 * still gets where they were going — they just lose the nametag and the 3D door. That is the honest
 * outcome for a ragged shape (an erased corner, two doors named alike at opposite ends of a map):
 * a `Gate` cannot describe it, and writing one that lies about which tiles warp is worse than
 * writing none. What is NOT acceptable is doing that to a shape a `Gate` can describe perfectly.
 *
 * ★★ AND A DEMOTION IS NAMED, BECAUSE THE ORIGINAL BUG'S REAL DAMAGE WAS THAT IT WAS QUIET. The
 * refusal is legitimate; performing it without saying so is not. `demoted` carries the labels that
 * lost their door so the caller can put them in front of whoever just pressed save — the difference
 * between "the editor did nothing" and "your landing is two tiles that do not touch."
 */
export function collapseGates(
  warps: PaintedWarp[],
): { gates: CollapsedGate[]; loose: PaintedWarp[]; demoted: string[] } {
  const groups = new Map<string, PaintedWarp[]>()
  const loose: PaintedWarp[] = []
  const demoted: string[] = []

  for (const w of warps) {
    if (!w.gate) { loose.push(w); continue }
    const key = groupKey(w)
    const g = groups.get(key)
    if (g) g.push(w); else groups.set(key, [w])
  }

  const gates: CollapsedGate[] = []
  for (const tiles of groups.values()) {
    const x = Math.min(...tiles.map(t => t.fromX))
    const y = Math.min(...tiles.map(t => t.fromY))
    const w = Math.max(...tiles.map(t => t.fromX)) - x + 1
    const h = Math.max(...tiles.map(t => t.fromY)) - y + 1

    // ★ DISTINCT cells, counted against the box area — and that IS the membership test, exactly.
    // Every painted tile lies inside its own bounding box by construction, and the Set makes them
    // unique, so `size === w * h` can only hold when all w*h cells are present. A per-cell loop was
    // here first; mutation testing showed the two were the same check written twice, and the pair
    // hid which one was load-bearing. `tiles.length` is the wrong one — see the DUPES case.
    const cells = new Set(tiles.map(t => `${t.fromX},${t.fromY}`))
    const filled = cells.size === w * h
    if (!filled) {
      loose.push(...tiles)
      demoted.push(`${tiles[0].gate as string} (${tiles.length} tile${tiles.length === 1 ? '' : 's'}, not a filled ${w}x${h})`)
      continue
    }

    const t = tiles[0]
    gates.push({
      x, y, w, h,
      toZone: t.toZone, toX: t.toX, toY: t.toY,
      ...(t.direction ? { direction: t.direction } : {}),
      label: t.gate as string,
      ...(t.requiredFlag ? { requiredFlag: t.requiredFlag } : {}),
      ...(t.ownerOnly === true ? { ownerOnly: true } : {}),
    })
  }

  return { gates, loose, demoted }
}

/**
 * How this gate's footprint should be written into `zones.ts`.
 *
 * ★ THE THREE FORMS ARE THE TYPE'S OWN DEFAULTS READ BACKWARDS, and keeping them that way is what
 * stops a save churning the fourteen doors already painted: a 2x2 writes nothing because 2 is what
 * `gateFootprint` assumes, a square writes `size`, and only a rectangle needs both axes. Anything
 * that widens `Gate`'s defaults has to change HERE and in `gateFootprint` together — they are one
 * statement written twice, in opposite directions.
 */
export function footprintFields(g: { w: number; h: number }): string[] {
  if (g.w === g.h) return g.w === 2 ? [] : [`size: ${g.w}`]
  return [`w: ${g.w}`, `h: ${g.h}`]
}
