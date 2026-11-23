// P1 (Alex 11-23: 'i asked a few moglins to join my garden but im not seeing them here'): a recruit was DRAWN only while it
// works a raised room (workshop.tsx › MoglinsAtWork) or, an alchemist, stands at its Desk; one with no room was drawn nowhere.
// The rest of the village now waits in the garden: a loose arc in front of the planning table, facing it (where the keeper
// will give them a room). Pure: who is idle, and where each idle one stands.
import { TABLE, raised, type Works } from './rooms'
import { standAt } from './alchemist-boon'
import type { MoglinRecord } from './moglins'
import type { TalkNode } from '../shared/npc-talk'

/** Drawn at work (the same test MoglinsAtWork draws by): an alchemist at its Desk, or anyone keeping a raised room. */
export function atWork(m: MoglinRecord, w: Works, now = Date.now()): boolean {
  if (m.profession === 'alchemist' && standAt(w, m)) return true
  const r = m.room ? w.rooms.find(x => x.id === m.room) : undefined
  return !!r && raised(r, now)
}
export const idleOf = (ms: readonly MoglinRecord[], w: Works, now = Date.now()) => ms.filter(m => !atWork(m, w, now))

/** How far out the arc stands from the table, and the spread between two Moglins along it (radians). */
export const IDLE_R = 3.4, IDLE_STEP = 0.55
/** The k-th of n idle Moglins: on an arc round the table's front (+z), centred, each turned to face the table. */
export function idleSpot(k: number, n: number, at: { x: number; z: number } = TABLE): { x: number; z: number; yaw: number } {   // M96: at = where the table stands now (rooms.ts tableAt)
  const a = (k - (n - 1) / 2) * IDLE_STEP
  const x = at.x + Math.sin(a) * IDLE_R, z = at.z + Math.cos(a) * IDLE_R
  return { x, z, yaw: Math.atan2(at.x - x, at.z - z) }
}

// ── E on an idle Moglin: say hello, or ask it home (RULED-AFK Magii 559213d; hub: no cost, no mood, ONE confirm step) ───────
// IDLE_LINES = SIGNED (Alex, athernyx ef704e7: shimmer-lines-placeholders-2026-11-23.md item 1). Guard: a parting on good terms.
export const IDLE_LINES = {
  hello: (name: string) => `${name} waits by the table for a room to keep.`,
  askHome: 'Would you rather be home with your kin?',
  confirm: "Home to my kin, then? It's been a good stay. You're sure?",
  yes: 'Yes. Go well.',
  no: 'No, stay.',
  bye: 'See you soon.',
  gone: (name: string) => `${name} waves a paw and sets off home, glad of the time.`,
}
export type IdleScreen = 'hello' | 'confirm'
export interface IdleActs { go: (s: IdleScreen | null) => void; part: () => void }
export function idleTalk(m: Pick<MoglinRecord, 'name' | 'dream'>, screen: IdleScreen, act: IdleActs): TalkNode {
  if (screen === 'confirm') return { line: IDLE_LINES.confirm, options: [{ label: IDLE_LINES.no, pick: () => act.go('hello') }, { label: IDLE_LINES.yes, pick: () => { act.part(); act.go(null) } }] }
  return { line: m.dream ? `${IDLE_LINES.hello(m.name)} "${m.dream}"` : IDLE_LINES.hello(m.name), options: [{ label: IDLE_LINES.bye, pick: () => act.go(null) }, { label: IDLE_LINES.askHome, pick: () => act.go('confirm') }] }
}
