// ── YARROW, THE BAIT-MAKER (re-ruled 2026-11-21) ─────────────────────────────────────────────────────────────────
// ⚠ UNSIGNED: lark's draft, athernyx 2e5fc0f (CANON/game/yarrow-baitmaker-lines-script.md, section A), dispatched by the
// Magii seat after the 11-21 re-rule (characters/moonwell-folk.md › Yarrow: bait-maker of the Rinnshop, never casts,
// neither brews nor buys brews). Transcribed VERBATIM. `SIGNED` flips to true only when Alex signs the set.
// These OVERRIDE the generated folk-lines.ts copies of the four core keys (that file is a verbatim copy of the old,
// now-archived apothecary script and is regenerated, so the new words live here, not there). The optional extra barks (B)
// and the teach beat (C: keep as a bait beat, or retire all four teach keys) are Alex's call: not wired.
import type { Beat, Trigger } from './folk-lines'

export const SIGNED = false

export const YARROW_LINES: Partial<Record<Trigger, readonly Beat[]>> = {
  'folk:YARROW:greet': [
    { who: 'YARROW', text: 'Do not touch the jars. Good. You listen. Yarrow. Bait.' },
  ],
  'folk:YARROW:want': [
    { who: 'YARROW', text: 'Scraps, meal, Mast. Anything a rinn would eat and you would not.' },
    { who: 'YARROW', text: 'And whatever you land. I ready it for the pot or the shop.' },
  ],
  'folk:YARROW:give': [
    { who: 'YARROW', text: 'Bait, made from your makings. One jar, one cast, then it is gone.' },
    { who: 'YARROW', text: 'I do not cast. Fennel gets you casting. I keep you baited.' },
  ],
  'folk:YARROW:bark': [
    { who: 'YARROW', text: 'Here. Hold this. No, that one is wrong. Now you know a wrong bait.' },
  ],
}
