// creature-size.ts — how big each spirit actually is, in metres, sourced from canon's own prose.
//
// ── ★★ WHY THIS FILE EXISTS ──────────────────────────────────────────────────────────────────────
// Until today every wild spirit in the world was drawn at `mist-pass.ts`'s `PRESENCE_TALL = 2.1`,
// which is the HALO's lathe-profile height and was never a creature's. 1 block = 1 metre here
// (`locomotion.ts` EYE_STAND 1.62 is a human eye height), so a Luminara — canon's *"mote of living
// green light"* — stood eye-to-eye with the keeper, and so did a thumb-sized Hovari. Alex ruled it
// 2026-08-27: *"size the creatures — firefly shouldn't be human-scale."*
//
// ── ★★★ RULED CANON AS OF 2026-08-27 — THIS TABLE IS A TRANSCRIPTION, NOT A DERIVATION ───────────
// It began as the build reading the books itself, because the build was already shipping an answer
// (2.1 for all ten) and waiting is not the neutral option. Magii + Alex RULED it the same day, and
// the authority is now:
//     CANON/world/spirits-species.md   › `Spirit Scale`  (the ruling, the table, the boundary)
//     CANON/design-briefs/base-forms.md › `Size (young base form)` on each of the ten cards
// ⚠ DO NOT RE-DERIVE A ROW FROM THE BOOKS HERE. Canon owns the comparison; a quote in a `source`
// below shows which line canon read, it does not license a fresh reading. If a number looks wrong,
// the fix is a ruling, not an edit.
//
// ★★ AND IT IS CHECKED, WHICH IS THE WHOLE DIFFERENCE FROM A HAND-KEPT MIRROR. `npm run canon` reads
// the `Size (young base form)` lines straight out of `base-forms.md` and diffs them against `SIZES`.
// A mirror agrees with its original right up until it silently stops; this one goes red the day the
// two disagree, and reports BLIND rather than CLEAN if it cannot read either side.
//
// ── ★★ THE RULING, IN ONE PARAGRAPH, because it decides what these numbers MEAN ──────────────────
// Size runs on TWO axes. AGE within a form: a base form is a YOUNG spirit — the lock library already
// said "read a base render as a YOUNG first-evolution kit, not a full adult", and already named Blue
// the MATURED ELDER Dewbear against the "childlike" meadow swarm. TIER across evolutions: every
// evolution grows a spirit, so an awakened form's vastness is accumulation, not a final magic step.
// ⚠ THEREFORE EVERY NUMBER BELOW IS A YOUNG, STAGE-ONE SPIRIT — exactly what this build draws (wild
// spirits in the mist, a keeper's starting roster). A second form or an elder is BIGGER, and nothing
// here models either yet. Do not reuse these for an evolved body.
//
// ── ★ THE ONE COMPARISON CANON MAKES ITSELF, AND IT IS THE GUARD WORTH HAVING ─────────────────────
// Three of Bonn's spirits are measured against HER OWN BODY, at three unambiguous contact points: a
// Manalotl *"flowed quiet at Bonn's heel"*, a Dewbear *"bumped against her shins"*, a Vulnyx *"hit
// her at the knees"*. Heel < shins < knees is canon's own ordering, stated with one measuring stick,
// and `creature-size.test.ts` asserts THAT rather than my three numbers. A future re-ruling may move
// every value; the relation has to survive it or the ruling contradicts the prose.
//
// ⚠⚠ AND THE FIRST VERSION OF THIS PARAGRAPH GOT THE MANALOTL BACKWARDS — worth keeping, because the
// failure is instructive and it was MINE. I read *"pressing a cool damp head under her chin"* as a
// standing height and derived 1.00m from a kneeling chin, which made the Manalotl the giant of the
// roster at twice the mascot. The sentence continues: Bonn had already *"went down into the grass"*
// and Brook was *"flowing UP ALONG Bonn's other side"* — that is a low creature climbing a person who
// is lying in the grass, and it says nothing about how tall it stands. One page over, the same book
// gives the plain reading: *"Brook flowed quiet at Bonn's heel."* ⚠ THE QUOTE WAS ACCURATE AND THE
// INFERENCE WAS NOT, which is the failure a citation cannot catch — only a SECOND quote of a
// different shape can. Every row below now carries two where the books offer two.
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
    fox: { height: 0.50, pending: false,
      source: 'Vulnyx — "hit her at the knees ... arms full of warm spirit" (bk11:71); leans its weight on a leg (bk4:229)' },
    // ⚠ A WILD DEWBEAR, DELIBERATELY. Gregory\'s bonded Blue has a "broad head" an old man leans on to
    // rise (bk1) — far bigger, and Gregory is a lifelong keeper, so Blue is very likely a grown or
    // second form. That is Q2 of the open gap, not evidence about a base. The meadow Dewbears are.
    'water-bear': { height: 0.35, pending: false,
      source: 'Dewbear — wild ones "bumped against her shins" (bk1:607, bk2:157); "in her lap" (bk1:507)' },
    // ★ THE ROW THAT WAS WRONG, AND THE ONE THE SECOND QUOTE FIXED. See the header note.
    axolotl: { height: 0.15, pending: false,
      source: 'Manalotl — "Brook flowed quiet at Bonn\'s heel" (bk11:121); "went and lay along the dry ground" to damp '
        + 'it (bk11:183); "flowed warm against her side" (bk8:159). ⚠ NOT the chin (bk11:71) — Bonn had "went down '
        + 'into the grass" and Brook was "flowing up along" her, which is a climb, not a standing height.' },

    // ── measured against a hand, a wrist, a knuckle ───────────────────────────────────────────────
    owl: { height: 0.30, pending: false,
      source: 'Athowl — "sat on Benji\'s wrist ... up to his shoulder" (bk11:303, benji-1:69); Strixen "slipping ahead '
        + 'through the arrow-slits" (benji-1:313), which is a narrow slot and bounds it from the other side' },
    rabbit: { height: 0.28, pending: false,
      source: 'Lepara — "Ember bumped his shins" (benji-1); "climbed halfway into his arms"; "worked the latches a '
        + 'boy\'s hands were too slow for" (otto-1:439)' },
    frog: { height: 0.12, pending: false,
      source: 'Croakling — "one cold cheerful kiss on her knuckle" (bk3:435); sits on the well-lip (benji-5:191)' },
    hummingbird: { height: 0.09, pending: false,
      source: 'Hovari — "a jewel-bright thing the size of a thumb" (otto-2:447); Flint "rode his shoulder ... wings '
        + 'folded close" and holds a chip of stone "under one claw" (benji-1)' },
    firefly: { height: 0.04, pending: false,
      source: 'Luminara — "a mote of living green light" (otto-2:303); brightened against one finger (tess-2:45)' },

    // ── ★ THE TWO THAT WERE PENDING, AND WHAT SETTLED THEM (ruled 2026-08-27) ─────────────────────
    // Neither needed a new fact. Both fell out of the young-base-form frame the ruling supplied.
    bat: { height: 0.24, pending: false,
      source: 'Noctyx — "folded herself small against Bonn\'s neck", "light as a held breath" (bk11:71, bk11:121). '
        + '★ MOMO IS NOT DOUBLE-BOOKED, HE GREW: "no bigger than a curled fist" is FIRST SIGHT (bk1:255), "a warm '
        + 'round weight in the crook of her arm" is bk1:559, "Cat-sized at rest" is the settled card (bible:63). '
        + 'So "no bigger than Momo" (bk6:215) DATES ITSELF and is read at the moment it is said.' },
    turtle: { height: 0.30, pending: false,
      source: 'Shellmere — "a shell you could carry in both arms" (spirits-species.md, Spirit Scale). No base-form '
        + 'line exists in the books; ruled off the young-kit rule. The "broad across as a cart" Shellmere (bk4:139) '
        + 'is ANCIENT AND EVOLVED (bible:203, 207) — the top of the ladder, not the bottom.' },
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
