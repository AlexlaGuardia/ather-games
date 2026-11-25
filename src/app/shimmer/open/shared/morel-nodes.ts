// ── MOREL AT A NODE (BETA M155 s2): when the gem warns a newborn who TRIES a node ─────────────────────────────────────────
// Canon (RULED 6a31c34): a newborn hears Morel from the start; it warns, it never commands; trying a node is never a step. Through First
// Steps only: after it, and for every older save, a node answers exactly as it did. Lines: morel-lines.ts (SIGNED). Pure.
// Cooldown = the errand hints' own (morel.ts): the same kind is quiet for COOL s and said MAX_HINTS times at most; and never over
// another Morel line still on the screen, whatever said it.
import { COOL, MAX_HINTS } from './morel'

export type NodeHint = 'tool_missing' | 'too_tough' | 'regrowing'
export interface NodeTry { firstSteps: boolean; /** one of the Glade's own nodes (keeper-nodes.ts) */ tutorial: boolean; tool: boolean; regrowMs: number; need: number; rung: number }
/** Which hint this try earns. The order is the game's own: no tool, not grown back, then the work that would drain you. */
export function nodeHint(t: NodeTry): NodeHint | null {
  if (!t.firstSteps) return null
  if (!t.tool) return t.tutorial ? 'tool_missing' : null
  if (t.regrowMs > 0) return t.tutorial ? 'regrowing' : null
  return t.need > t.rung ? 'too_tough' : null
}
export interface NodeHintWatch { at: Partial<Record<NodeHint, number>>; n: Partial<Record<NodeHint, number>> }
export const newNodeHintWatch = (): NodeHintWatch => ({ at: {}, n: {} })
/** May `k` be said now (s)? Records it when yes. `speaking` = a Morel line is still up. */
export function nodeHintDue(w: NodeHintWatch, k: NodeHint, now: number, speaking: boolean, speed = 1): boolean {
  if (speaking || (w.n[k] ?? 0) >= MAX_HINTS || now - (w.at[k] ?? -1e9) < COOL / speed) return false
  w.at[k] = now; w.n[k] = (w.n[k] ?? 0) + 1
  return true
}
/** {REGROW}: the time left in plain words, never a typed number (the batch's own two are 'a day' and 'a few hours'). */
export function regrowWords(ms: number): string {
  const m = ms / 60_000
  return m < 2 ? 'a moment' : m < 20 ? 'a few minutes' : m < 45 ? 'half an hour' : m < 90 ? 'an hour' : m < 10 * 60 ? 'a few hours' : m < 18 * 60 ? 'half a day' : m < 36 * 60 ? 'a day' : m < 60 * 60 ? 'a couple of days' : 'a few days'
}
