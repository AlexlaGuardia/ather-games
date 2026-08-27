/**
 * WHAT TO PRESS WHEN A COLLARED MOGLIN IS ON YOU.
 *
 * ★★★ ALEX, PLAYING (2026-08-27): *"the moglin enemies chased me down with no way to interact."*
 * The system was already there — casting is wired, `answerCollar` is the canon half and is
 * oracle-tested, and every refusal already speaks its own reason. What was missing is the sentence
 * BEFORE the mistake: nothing on screen names the verb. The rule was only ever explained by getting
 * it wrong, and a rule you can only learn by failing reads as a game with no verb for this.
 *
 * ⚠⚠ AND THE HARD CASE IS NOT "TELL HIM THE KEY" — IT IS THE KEEPER WHO HAS NOTHING THAT WORKS.
 * A prompt that says "press B" to a keeper whose Signature slot is empty, or is seated with a move
 * canon REFUSES, is worse than silence: it sends them to press a key that will not work and blames
 * the game for the outcome. So the three answers are genuinely different and one of them is not a
 * key at all. Same fail-closed reasoning as `answerCollar` refusing an unclassified move.
 *
 * ★ NOTHING HERE RESTATES THE CANON. Which moves open a collar is authored on the move itself
 * (`keeper-moves.ts` › `collar`), so a move that is reclassified tomorrow changes this prompt with
 * no edit here, and a move nobody has classified can never become the thing the HUD recommends.
 */

/** One cast slot as the world knows it: the key that fires it, and the move seated in it. */
export interface PromptSlot {
  /** The player's actual bound key for this slot — never a literal typed into the HUD. */
  key: string
  /** The move seated here, or null for an empty slot. */
  moveId: string | null
}

export type CollarPrompt =
  /** They can do it right now. Name the key and the move. */
  | { kind: 'ready'; key: string; moveName: string }
  /** Slots are seated, but canon refuses everything in them. Name what they would need. */
  | { kind: 'wrong-runes'; seated: string[] }
  /** Nothing is seated at all. The fix is the grimoire, not the fight. */
  | { kind: 'none-seated' }

/**
 * Which slot to recommend, given the player's live loadout.
 *
 * `opensCollar` and `moveName` are passed in rather than imported so this module stays a pure
 * decision — the caller already holds the move table, and a second import of it here would be a
 * second place that could go stale against the first.
 *
 * ⚠ FIRST SEATED OPENER WINS, IN SLOT ORDER, AND THAT IS DELIBERATE RATHER THAN CLEVER. Ranking by
 * damage or cooldown would make the prompt disagree with itself between two frames as cooldowns
 * turn over, and a prompt that moves while you read it teaches nothing. Slot order is stable.
 */
export function collarPrompt(
  slots: readonly PromptSlot[],
  opensCollar: (moveId: string) => boolean,
  moveName: (moveId: string) => string,
): CollarPrompt {
  const seated = slots.filter(s => s.moveId !== null) as { key: string; moveId: string }[]
  if (seated.length === 0) return { kind: 'none-seated' }

  const opener = seated.find(s => opensCollar(s.moveId))
  if (opener) return { kind: 'ready', key: opener.key, moveName: moveName(opener.moveId) }

  return { kind: 'wrong-runes', seated: seated.map(s => moveName(s.moveId)) }
}

/**
 * The line the HUD shows. Kept beside the decision so the two cannot drift, and written in the
 * keeper's second person because this is the world talking, not a tooltip.
 *
 * ⚠ THE REFUSED CASE MUST NOT NAME A KEY. That is the whole reason the three cases exist.
 */
export function collarPromptText(p: CollarPrompt): string {
  switch (p.kind) {
    case 'ready':
      // Names the verb canon uses — the collar is out-contested, not shot and not befriended.
      return `${p.key.toUpperCase()} — ${p.moveName} strikes the collar`
    case 'wrong-runes':
      // Says what is wrong with what they HAVE, so the next move is legible: go seat a rune that
      // reaches an object rather than a body.
      return `${p.seated.join(' and ')} will not open a collar — seat a rune that strikes it`
    case 'none-seated':
      return 'no rune is seated — a collar is opened by a rune, not by a bullet'
  }
}
