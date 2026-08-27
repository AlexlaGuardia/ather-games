// creature-size.ts — how big each spirit actually is, in metres, sourced from canon's own prose.
//
// ── ★★ WHY THIS FILE EXISTS ──────────────────────────────────────────────────────────────────────
// Until today every wild spirit in the world was drawn at `mist-pass.ts`'s `PRESENCE_TALL = 2.1`,
// which is the HALO's lathe-profile height and was never a creature's. 1 block = 1 metre here
// (`locomotion.ts` EYE_STAND 1.62 is a human eye height), so a Luminara — canon's *"mote of living
// green light"* — stood eye-to-eye with the keeper, and so did a thumb-sized Hovari. Alex ruled it
// 2026-08-27: *"size the creatures — firefly shouldn't be human-scale."*
//
// ── ★★★ THESE NUMBERS ARE READ OFF CANON, NOT CHOSEN ─────────────────────────────────────────────
// Every entry carries the quote it came from. That is not decoration: the boundary
// (`SHIMMER-CANON-BOUNDARY.md`) gives Magii a creature's anatomy and gives Jin rendering, and SIZE
// is named in neither column — so this table is Jin building against what canon has already said,
// not Jin deciding. `CANON_GAPS.md` › *"How big is a spirit?"* is `[OPEN]` and asks Magii for a
// `Size:` line per lock card, mirroring Momo's *"Size: Cat-sized at rest"* (`spirit-tales-bible.md:63`).
//
// ⚠ SO WHY SHIP BEFORE THE RULING? Because the build is ALREADY shipping an answer and it is 2.1 for
// everything. Waiting is not the neutral option — it is the option that keeps a thumb standing at
// head height. A number quoted from the books is strictly closer to canon than the halo constant,
// and when the ruling lands it is one edit per row here rather than a hunt through three files.
//
// ── ★ THE ONE COMPARISON CANON MAKES ITSELF, AND IT IS THE GUARD WORTH HAVING ─────────────────────
// Three spirits are measured against the SAME human body in the books — a Dewbear *"bumped against
// her shins"*, a Vulnyx *"hit her at the knees"*, a Manalotl pressed *"a cool damp head under her
// chin"* while she knelt. Shins < knees < kneeling-chin is canon's own ordering, stated in one
// measuring stick, and `creature-size.test.ts` asserts THAT rather than my three numbers. A future
// re-ruling may move every value; the relation has to survive it or the ruling contradicts the prose.
//
// ⚠ WHAT THIS FILE IS NOT. It is not an aim volume and not a halo height. A firefly drawn honestly at
// 4cm is a firefly you cannot click, and the fix for that is a floor on the INTERACTION box, kept
// next to the raycast that uses it — never folded back in here. The drawn size must stay honest or
// this table quietly becomes a gameplay dial and stops being a canon reading.

import { SPECIES_IDS } from './registry'

/** One species' drawn size, and the reason it is that number. */
export interface CreatureSize {
  /** Drawn tallness in metres. 1 block = 1 metre. */
  readonly height: number
  /** The canon quote this was read off, with its source — or, when pending, what is missing. */
  readonly source: string
  /**
   * `true` = canon has NOT settled this one and the number is a placeholder standing in until Magii
   * rules. Two entries are pending today and both are named in `CANON_GAPS.md`'s open block.
   */
  readonly pending: boolean
}

/**
 * ★ KEYED BY THE BUILD'S SPECIES ID (the analog name), which is what `registry.ts` and
 * `spirit-portrait-body.ts` already key on. Canon's own name is in the quote so a reader searching
 * for "Hovari" lands here. ⚠ Canon bars the analog word from PROSE (`spirits-species.md` › the
 * Native-World Law) — it is an id in the build and must never reach a player-visible string.
 *
 * ⚠⚠ NULL PROTOTYPE, AND THE REASON IS NARROWER THAN `registry.ts`'s — stated precisely because the
 * first draft of this comment was wrong and the oracle proved it. Species ids arrive from SAVED DATA
 * (the mist ledger and keeper saves are localStorage, which a player can edit), so `SIZES['__proto__']`
 * on a plain literal is `Object.prototype`: truthy, so `?.` steps straight past it. `creatureHeight`
 * survives that anyway — `.height` on it is `undefined` and the `??` catches it — so the prototype is
 * NOT what protects the accessor. It protects every reader that indexes `SIZES` DIRECTLY and then
 * trusts the object it got, which is the normal way to read a table and is what the oracle does twice.
 */
export const SIZES: Readonly<Record<string, CreatureSize>> = Object.freeze(
  Object.assign(Object.create(null) as Record<string, CreatureSize>, {
    // ── measured against one human body, in canon's own words ────────────────────────────────────
    // ⚠ THE ONE READING MOST SENSITIVE TO HOW YOU PICTURE THE POSTURE, and it makes the Manalotl the
    // giant of the roster at twice the mascot — so it is the first number to challenge. A person sat
    // back on their heels has their chin near 1.05m; upright on their knees, nearer 1.2m; leaning
    // down, much lower. The ORDERING it sits in is safe (see the measuring-stick note in the header)
    // and only the magnitude rests on the posture. Named here so the next reader argues with the
    // derivation instead of quietly re-picking the number.
    axolotl: { height: 1.00, pending: false,
      source: 'Manalotl — "pressing a cool damp head under her chin" while kneeling (bk11:71); a kneeling chin is ~1.05m' },
    fox: { height: 0.50, pending: false,
      source: 'Vulnyx — "hit her at the knees ... arms full of warm spirit" (bk11:71); leans its weight on a leg (bk4:229)' },
    'water-bear': { height: 0.35, pending: false,
      source: 'Dewbear — "bumped against her shins" (bk1:607); "in her lap" (bk1:507)' },

    // ── measured against a hand, a wrist, a knuckle ───────────────────────────────────────────────
    owl: { height: 0.30, pending: false,
      source: 'Athowl — "sat on Benji\'s wrist ... up to his shoulder" (bk11:303, benji-1:69); a wrist-perching bird' },
    rabbit: { height: 0.28, pending: false,
      source: 'Lepara — "worked the latches a boy\'s hands were too slow for" (otto-1:439); hand-scale and dexterous' },
    frog: { height: 0.12, pending: false,
      source: 'Croakling — "one cold cheerful kiss on her knuckle" (bk3:435); sits on the well-lip (benji-5:191)' },
    hummingbird: { height: 0.09, pending: false,
      source: 'Hovari — "a jewel-bright thing the size of a thumb" (otto-2:447); default pose is hovering' },
    firefly: { height: 0.04, pending: false,
      source: 'Luminara — "a mote of living green light" (otto-2:303); brightened against one finger (tess-2:45)' },

    // ── ⚠ THE TWO CANON HAS NOT SETTLED ───────────────────────────────────────────────────────────
    // Both are `[OPEN]` in CANON_GAPS.md › "How big is a spirit?". They are placeholders that SAY so,
    // which is the whole difference between this and the 2.1 they replace.
    bat: { height: 0.24, pending: true,
      source: 'Noctyx — "no bigger than Momo" (bk6:215, bk5:327), and Momo is double-booked: "Size: Cat-sized at rest" '
        + '(spirit-tales-bible.md:63, momo-duskpuff.md:17) vs "no bigger than a curled fist" (bk1:255). Taken at the '
        + 'explicit Size: field, tempered by the shoulder-perch (bk11:71, bk10:359). PENDING: which Momo is the anchor.' },
    turtle: { height: 0.35, pending: true,
      source: 'Shellmere — the only size in the books is "broad across as a cart" (bk4:139) and that one is ANCIENT and '
        + 'EVOLVED (bible:203, 207 — Bramble\'s evolved Earth champion), so it is not evidence about a base form. '
        + 'Placeholder read off the analog (turtle) and "tank build" (spirits-species.md). PENDING: a base-form size.' },
  }),
)

/**
 * The tallest a base spirit may be drawn. Canon's own largest reading is the Manalotl at a kneeling
 * chin, and every other quote is smaller — so a base form that reaches a standing human's eye is
 * evidence of a bug, not of a big spirit. ⚠ AWAKENED forms are explicitly vast (Hibernyx, *"an
 * ice-shape the size of a hill"*, benji-1:395); nothing here describes them and nothing here should.
 */
export const BASE_FORM_MAX = 1.2

/** The fallback for a species with no entry. See `creatureHeight` for why it is not 2.1. */
export const UNSIZED_FALLBACK = 0.5

/**
 * How tall to draw this species, in metres.
 *
 * ⚠ AN UNKNOWN SPECIES GETS A SMALL BODY, NOT A TALL ONE, AND THAT DIRECTION IS DELIBERATE. The
 * oracle makes an unregistered id impossible for anything the build ships, so reaching the fallback
 * means saved data named a species that no longer exists. A wrong-but-modest body reads as a spirit;
 * a 2.1m one reads as a keeper standing in the mist, which is the failure that got us here.
 */
export function creatureHeight(species: string | null | undefined): number {
  return (species != null ? SIZES[species]?.height : undefined) ?? UNSIZED_FALLBACK
}

/** Species whose size canon has not settled. Non-empty until Magii rules the open gap. */
export const PENDING_SIZES: readonly string[] = Object.freeze(
  SPECIES_IDS.filter(id => SIZES[id]?.pending === true),
)
