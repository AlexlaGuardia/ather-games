// IDRIS'S LINES (BETA M93 s3). Every word is @lark's, copied from athernyx CANON/game/shimmer-lines-idris-and-goodbyes.md
// SIGNED by Alex (athernyx 7a25a8e), word for word; idris-signed-lines.test.ts diffs every line against the canon file.
// Idris is Idony's twin BROTHER, he/him (canon 5b83a25). The signed lines name no pronoun; any copy that needs one uses he/him.
// An id with no line shows the id itself, so a missing line is loud on screen rather than invented.
export type IdrisLineId =
  | 'idris.greet.first.1' | 'idris.greet.first.2' | 'idris.greet.first.3' | 'idris.greet.repeat'
  | 'idris.offer' | 'idris.noblank' | 'idris.norunes' | 'idris.confirm' | 'idris.done'
  | 'idris.bark.1' | 'idris.bark.2' | 'idris.bark.3'

export const IDRIS_LINES: Partial<Record<IdrisLineId, string>> = {
  'idris.greet.first.1': "Idony's at the other bench. I'm her twin. Idris.",
  'idris.greet.first.2': 'She does vessels. I do guns.',
  'idris.greet.first.3': "Bring me a blank sigil and the runes you want. I'll cut them in.",
  'idris.greet.repeat': 'Back again. What are we cutting?',
  'idris.offer': "That's a blank. Pick your runes and I'll cut them in.",
  'idris.noblank': 'Nothing to cut without a blank. A gun shop will sell you one.',
  'idris.norunes': 'A blank and no runes. A runesmith makes those. Come back with a few.',
  'idris.confirm': "These, in this order? Say so and I'll start.",
  'idris.done': 'Done. Fire a few and see how it sits.',
  'idris.bark.1': 'Your own rune goes first. The gun reloads cheaper for it.',
  'idris.bark.2': "Two runes of one State won't share a sigil. Don't ask me to try.",
  'idris.bark.3': 'Idony wants quiet when she works. I can talk and cut.',
}
export const IDRIS_SCENES = {
  first: 'A second bench across the Temple, crowded with blank crystals. The one at it looks up when you come in.',
  done: 'Idris blows the dust off the last cut and holds the sigil up to the light.',
}
/** choice labels (lark) */
export const IDRIS_CHOICES = { pick: 'Pick runes', notYet: 'Not yet', cut: 'Cut it', wait: 'Wait' }

export const idrisLine = (id: IdrisLineId): string => IDRIS_LINES[id] ?? id
export const IDRIS_BARKS: IdrisLineId[] = ['idris.bark.1', 'idris.bark.2', 'idris.bark.3']
