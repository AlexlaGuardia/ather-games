// DOWNBARROW, AND WHAT WAS DONE TO IT — the burrow-town pool, and the doctrine laid over it.
//
// ★ PURE CORE. No react, no three, no voxels. It knows pieces, extents and doctrine; it does not know
// what a block is. The voxel realization is a separate pass and this file must stay ignorant of it.
//
// ── ★★★ WHY THIS IS ONE GENERATOR AND NOT TWO ─────────────────────────────────────────────────
// Canon ruled 2026-08-29 that the Snagbarrows **were Downbarrow** — a free burrow-town that collarers
// took. *"A Snagbarrow is a barrow they snagged... the clan name was the confession the whole time."*
// So a taken hold is not massed from its own vocabulary. It is a FREE TOWN WITH A DOCTRINE ON TOP:
//   · `free`   → Downbarrow, Gloview, the Warren. Dug, mounded, drab-but-warm.
//   · `sport`  → the Snagbarrows. The same town, greyed and pinned, its green worn into a ring.
//   · `industry` → Hemlock-shaped. Same town, greyed, its green swept into a sorting yard. NOT BUILT.
// One generator, one flag. ⚠ And the guardrail *"never grey a free Moglin's home"* stops being a
// discipline someone has to remember and becomes a value this module cannot express by accident.
//
// ── ★★★ THE TAKING MUST BE REVERSIBLE, AND THAT IS A HARD ARCHITECTURAL REQUIREMENT ───────────
// Beat S6: *"the hold is not left a ruin; the cloud takes its colour back. The burrows underneath were
// always Downbarrow's, and now they are again."* Freeing a hold is the loop's ONLY verb and its visual
// proof. So the doctrine may never be baked into the base geometry — it is a LAYER over an intact free
// town, lifted when the hold falls. ⚠ A generator that mutated the town on taking would have to
// RE-GENERATE it on freeing, and the two would drift; the free town has to be the thing that persists.
//
// ── THE SHAPE, READ OFF THE BEATS (`game/shimmer-wilds-snagbarrows.md`) ───────────────────────
// S1: *"a hill snagged in bramble, gorse on the crown, folded grey cloud pinned and stacked over the
// top of it"* — the taking is a LID, not a rebuild. At dusk *"small lights, moving, in rows."*
// S4: *"the curve of the old common green — the ground a burrow-town used to gather on, scuffed down
// to bare earth"*, the audience *"in tidy rows around the rim."*
// ⚠ **BUILD THE ROWS BEFORE THE RING.** Canon says so twice: *"the captives in the rows are the
// cruelty; the fight in the middle is only the excuse."* The rows are the set piece; the floor is not.
//
// ── ⚠⚠ NAMING — `ring` IS ALREADY TAKEN BY ITS OWN OPPOSITE ───────────────────────────────────
// Canon's word for the collared fighting floor is `ring` (never `arena`, which is the combat system's
// and means the inverse relationship). But this build ALREADY has `plot-ring.ts` / `plot-ring-pass.ts`
// — *"THE HOME PLOT'S RING: your own spirits, about your own fold"* — the FREE version of the same
// image. Same word, consent removed, which is the thesis one level down and a genuine hazard in code.
// **So the identifier here is `holdRing`, never bare `ring`.** Third vocabulary collision in one day
// (`structure` was taken twice and cost a file; `arena` was taken and inverted); the rule that keeps
// falling out is: **grep the tree for a word before you build on it.**
import type { JigsawPiece, JigsawConfig } from './jigsaw'

/**
 * What a hold believes, made buildable. The facet decides the heart — canon, not a build knob
 * (`design-briefs/moglin-holds.md` › *The heart of a hold*).
 *
 * ⚠ `care` / `faith` / `fear` are deliberately ABSENT rather than stubbed. Canon lists them as facets
 * of the collar-lie but has NOT ruled their hearts (*"not yet ruled — author the heart together with
 * the hold"*). A stub here would be an invented canon fact wearing a type, and the day a hold needs
 * one the ruling should arrive before the arm does.
 */
export type Doctrine = 'free' | 'sport' | 'industry'

/** Which part of a burrow-town a piece is. The doctrine layer keys off this, never off the id. */
export type BurrowKind = 'green' | 'homes' | 'dell' | 'lane' | 'mouth' | 'bank'

export interface BurrowPiece extends JigsawPiece {
  kind: BurrowKind
  /**
   * Eligible as the town's START. ⚠ NOT the same as `weight` — the green must exist in every town,
   * because the doctrine's heart is worn INTO it and a town without one has nowhere for the ring.
   *
   * ★ `jigsaw.assemble` ROLLS its start piece from the whole extension pool, deliberately: a fixed
   * start made every one-piece ruin identical, and one-piece is a third of all ruins. That reasoning
   * is right and must not be undone. So a heart POOL (several greens) keeps the roll AND guarantees a
   * green — variety without losing the thing every town needs.
   *
   * ⚠⚠ THE ASSEMBLER CANNOT DO THIS YET. It needs an optional start-pool argument, defaulting to
   * present behaviour. `jigsaw.ts` is an EXTRACTION whose equivalence was proven by hashing `ruinPlan`
   * over 641 sites (`dc703495d76c5250eaf1`) — so that change ships only with the same hash re-proven.
   */
  heart?: boolean
}

/**
 * ── THE FREE TOWN ─────────────────────────────────────────────────────────────────────────────
 * Downbarrow as its diggers made it. Every extent is ODD on both axes — `jigsaw` requires a centre
 * column for its edge-midpoint sockets, and an even piece has no centre to hang one on.
 *
 * ★★ PIECES ARE MASSES, NOT ROOMS, AND THAT IS A PERFORMANCE DECISION AS MUCH AS AN AESTHETIC ONE.
 * `jigsaw` is tuned for ruins at `envelope 22 / maxPieces 9`, and **every column re-derives the whole
 * assembly** (that is what lets any column agree with its neighbours without talking to them). A
 * 150x200 hold at 5x5-room granularity is hundreds of pieces across ~30,000 columns — a cliff on the
 * hardware we profiled this morning. At mass scale it is ~20 pieces, and it is also closer to what
 * canon describes: *"fold crammed against fold"* is not a corridor of rooms.
 * ⚠ Rows, pens, cages and hearths are DRESSING placed inside a mass, never pool members.
 */
export const DOWNBARROW: BurrowPiece[] = [
  // ── hearts. Rolled among themselves so no two towns share a green, but a green is guaranteed.
  { id: 'green_round', kind: 'green', w: 25, d: 25, weight: 3, heart: true },
  { id: 'green_long',  kind: 'green', w: 31, d: 21, weight: 2, heart: true },

  // ── the town. Mounded homes are the bulk; lanes are cheap connective tissue and carry the sprawl.
  { id: 'homes_row',     kind: 'homes', w: 21, d: 13, weight: 5 },
  { id: 'homes_cluster', kind: 'homes', w: 17, d: 17, weight: 4 },
  /** A dug hollow open to the sky — gardens, a well, the town's soft ground. */
  { id: 'dell',          kind: 'dell',  w: 15, d: 15, weight: 3 },
  { id: 'lane',          kind: 'lane',  w: 13, d: 9,  weight: 6 },

  // ── terminators. A branch ends at the hill's edge, or at a mouth into it.
  /**
   * ★ A MOUTH IS CANON'S OWN WORD AND ALREADY A SHIPPED SYSTEM. *"A burrow is a mouth; the hold is
   * the hand behind it"* (ruled 07-30) — and `engine/burrows.ts` is built on it: collared Moglins
   * press out through burrows while the hold stands, and freeing the hold stops the tunnelling. So a
   * mouth terminates a branch AND is where the taken town's spawners belong. Under `free` it is a
   * front door and nothing hostile ever comes out of it.
   */
  { id: 'mouth', kind: 'mouth', w: 9,  d: 9,  weight: 4, terminal: true },
  { id: 'bank',  kind: 'bank',  w: 13, d: 13, weight: 3, terminal: true },
]

/**
 * Sized for Alex's ≥150x200, which canon granted at stronghold scale.
 *
 * ⚠⚠ EVERY NUMBER HERE IS AN UNSWEPT STARTING POINT AND MUST NOT BE READ AS TUNED. `ruins.ts` records
 * the rule for this file's own machinery — *"Tune by sweep, never by eye"* — and its figures came off
 * `scripts/ruin-sweep.mts` over 681 structures. Nothing equivalent has been run here. A sweep is owed
 * before a Snagbarrow ships, and the thing it must measure is **span** (does a town actually reach
 * 150x200, or saturate small) and **green placement** (is the heart reachable, or walled in).
 *
 * ★ `sizeBias` BELOW 1 BIASES LARGE, which is the opposite of the ruins tuning and deliberate: a ruin
 * should usually be a stump, a stronghold should usually be a country. Ruins measured 37%→98% of
 * structures hitting the cap across sprawl 0.4–0.75, so expect this pool to saturate and expect the
 * budget roll — not `sprawl` — to be the lever that stops it.
 */
export const DOWNBARROW_CFG: JigsawConfig = {
  envelope: 100,   // ~200 across; the correctness bound the caller's cell scan must match
  maxPieces: 24,
  maxDepth: 5,
  tries: 6,
  sprawl: 0.75,
  sizeBias: 0.5,
}

/**
 * What a doctrine lays over a piece. **Data, not geometry** — the voxel pass reads this; nothing here
 * knows a block from a hole.
 *
 * ★ EVERY FIELD IS ADDITIVE OR A GRADIENT, NEVER A REPLACEMENT, because the taking must lift cleanly
 * (see the header). `grey` is how far this mass has been drained, 0..1; the free town is always 0.
 */
export interface Overlay {
  /** 0 = the town's own colour, 1 = dead grey. Deepest at the heart — *"greyest where the count is thickest."* */
  grey: number
  /** Folded cloud pinned and stacked OVER this mass — S1's lid. Courses above the mass's own top. */
  lid: number
  /** The audience sits here, in tidy rows around the rim. ⚠ The rows are the set piece — build them first. */
  rows: boolean
  /** The fighting floor is worn into this mass. Canon's `ring`; never bare `ring` as an identifier here. */
  holdRing: boolean
  /** Cages, tethers, stakes, lead-lines, hooks — *the only forged metal in the world*, and the tell. */
  irons: boolean
}

const NONE: Overlay = { grey: 0, lid: 0, rows: false, holdRing: false, irons: false }

/**
 * The doctrine, applied to one mass of the free town.
 *
 * ⚠ IT KEYS ON `kind`, NEVER ON `id`. A new green variant joins by being a green; an id list would go
 * stale the day somebody adds `green_wide` and would do it silently — the hand-kept-list failure this
 * codebase has paid for repeatedly.
 *
 * ★ `free` RETURNS THE ZERO OVERLAY FOR EVERY KIND, AND THAT IS THE GUARDRAIL MADE STRUCTURAL. Canon:
 * *"never grey a free Moglin's home."* Gloview and the Warren run this same generator; with `free`
 * there is no expressible way for one to come out greyed.
 */
export function overlayFor(kind: BurrowKind, doctrine: Doctrine): Overlay {
  if (doctrine === 'free') return { ...NONE }
  // Shared by every taken doctrine: the lid, the drain, and the irons where stock is kept.
  const taken: Overlay = {
    ...NONE,
    grey: kind === 'green' ? 0.9 : kind === 'homes' ? 0.6 : 0.35,
    lid: kind === 'bank' || kind === 'mouth' ? 0 : 3,
    irons: kind === 'homes' || kind === 'green',
  }
  if (doctrine === 'industry') {
    // The sorting yard: swept, graded, the tally at its edge. NOT a ring — Hemlock has no spectacle.
    return { ...taken, rows: false, holdRing: false }
  }
  // sport/status — Burdock. The green becomes the ring, and the rim becomes the audience.
  return { ...taken, rows: kind === 'green', holdRing: kind === 'green' }
}
