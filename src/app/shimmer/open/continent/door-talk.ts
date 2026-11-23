// ── THE CONTINENT'S COUNTERS AS TALK (BETA M13 part 3, Alex 11-18 pin) ───────────────────────────────────────────────────────
// E at a runesmith's door or the Enchant Temple starts a conversation (shared/npc-talk.tsx) instead of a panel: the counter's
// line in a bubble over the door, the keeper answers, each answer opens ONE thing (the counter's panel, or goodbye). Idony's
// imbue beat (errand-lines.ts idonyBeat, signed 11-16) plays in the same bubble, one step per answer.
// ★ Every NPC line here is a SIGNED line from errand-lines.ts, never edited. The answer labels (DOOR_ASK) are @lark's
//   drafts, awaiting Alex sign-off. The Co. clerk talks too, from its own signed script: business/co-lines.ts.
import type { TalkNode } from '../shared/npc-talk'
import { RUNESMITH_CUT, IDONY_HUSH, IDONY_AFTER, type Beat } from '../business/errand-lines'

// @lark draft 11-18, awaiting Alex sign-off. Idony has just hushed the keeper, so her answers defer instead of pester.
export const DOOR_ASK = { cut: 'Here. A letter to cut.', inscribe: 'When you are free.', letters: 'The runesmith, please.', bye: 'Goodbye.', byeTemple: "I'll let you work.",
  /** SIGNED (Alex, athernyx 491f462): shimmer-lines-idris-and-goodbyes.md Part 3, door.idris.ask (Main). */
  idris: 'Is Idris in?' }
/** SIGNED (Alex, athernyx 491f462): Part 3, door.idris.reply (Main). Idony's one bubble between the knock and Idris's panel. */
export const DOOR_REPLY = { idris: "Across the room. He talks. I'm working." }

export interface DoorTalkActs { open: (deed: string) => void; bye: () => void }
/** The Temple adds one step: asking for Idris shows Idony's reply first (`ask('idris')`), then the panel. */
export interface TempleActs extends DoorTalkActs { ask: (who: 'idris' | null) => void }

/** A runesmith's counter: "Set it down. I'll cut it." Then the cut list, or goodbye. `key` = `smith:<seat>`. */
export const smithTalk = (key: string, a: DoorTalkActs): TalkNode => ({
  line: RUNESMITH_CUT,
  options: [{ label: DOOR_ASK.cut, pick: () => a.open(key) }, { label: DOOR_ASK.bye, pick: a.bye }],
})

/** The Enchant Temple: Idony at her bench (hushed while the bracelet is unwritten, her after-line once it is). Her twin
 *  Idris (Magii 6a20625) cuts letters into a gun's sigil (M93 s3, business/idris-panel.tsx). */
export const templeTalk = (bracelet: boolean, a: TempleActs, asked: 'idris' | null = null): TalkNode => asked === 'idris'
  // her reply, then on (the beat's own pause label '…', no new line)
  ? { line: DOOR_REPLY.idris, options: [{ label: '…', pick: () => a.open('idris') }] }
  : {
    line: bracelet ? IDONY_AFTER : IDONY_HUSH,
    options: [
      { label: DOOR_ASK.inscribe, pick: () => a.open('idony') },
      { label: DOOR_ASK.letters, pick: () => a.open('smith:enchant') },
      { label: DOOR_ASK.idris, pick: () => a.ask('idris') },
      { label: DOOR_ASK.byeTemple, pick: a.bye },
    ],
  }

/** One step of Idony's beat. The keeper's answer is the step's own action: saying the word (which writes it), the
 *  last step's 'Take the bracelet', or a pause ('…') to let her work. Same labels the panel's beat used. */
export const beatTalk = (steps: Beat[], at: number, next: () => void): TalkNode & { scene?: string } => {
  const cur = steps[at]
  return {
    scene: cur.scene, line: cur.idony ?? '',
    options: [{ label: cur.keeper ? `Say it: “${cur.keeper}”` : at + 1 >= steps.length ? 'Take the bracelet' : '…', pick: next }],
  }
}
