// GATHERING BY CHANNEL (Alex 11-17: "more like a cast so the player gets within range with weapons stowed and interacts
// with the node, the correct tool auto selects and spawns on the node chipping at it until the node is depleted"). Pure.
//
// Canon (game/shimmer-skilling.md › gathering tools): tools are CHANNELING FOCUSES, not implements: "you hold one toward the
// node and channel through it, the mana still does the cutting ... nothing is ever swung", and a focus "lights along its
// own material's structure while channeling". So the focus that appears at the node HOVERS and is lit, and each chip is a
// pulse of mana knocking pieces loose (channel-fx.tsx), never a swing. Which focus = the node's skill (blade → a tree,
// spike → a crystal): the keeper never picks it.
//
// ★ THE ECONOMY STAYS WHERE IT WAS. A node's whole yield is the SAME roll as one prune / one fracture before this
//   (forestry.prunePlan / prospecting.minePlan); the channel only deals it out over a few chips and COMMITS on the last one
//   (XP + the regrow timer, pruneCommit / mineCommit). Mana is the same total, paid a share per chip.
// ★ STOPPING IS SAFE BOTH WAYS. Walk off, draw a weapon or press E and the chips you got stay yours; the node is not spent,
//   and its progress is KEPT (this session) so coming back finishes the same roll. Re-rolling by walking away gains nothing.
//   (Progress lives in memory: a reload forgets a half-worked node, which then rolls fresh. Small and rare; noted.)
export type NodeKind = 'tree' | 'crystal'
export interface Stack { id: string; n: number }

/** Chips per node by its tier (1..4): a better node takes longer to work, never longer than a few seconds. */
export const CHIPS_BY_TIER = [3, 3, 4, 5] as const
export const chipsFor = (tier: number) => CHIPS_BY_TIER[Math.max(0, Math.min(3, tier - 1))]
/** The beat between one chip landing and the next starting (the fx's own channel is ~1 s). A better focus is quicker
 *  (engine TOOL_DEFS speedBonus: 0.9 / 0.85 / 0.8). */
export const CHIP_GAP_MS = 350
export const chipGapMs = (speedBonus = 1) => Math.round(CHIP_GAP_MS * speedBonus)
/** Stay this close (m) to the node or the channel lets go. A little past the reach that started it. */
export const HOLD_RANGE = 13

/** Deal a plan out over n chips: the main item (first stack) a unit at a time round-robin, so every chip drops something;
 *  any extra items (a sapling, mast, a found Keepstone) come with the LAST chip, the moment the node gives way. */
export function splitDrops(plan: readonly Stack[], n: number): Stack[][] {
  const chips: Stack[][] = Array.from({ length: n }, () => [])
  const [main, ...rest] = plan
  if (main) for (let u = 0; u < main.n; u++) {
    const c = chips[u % n], s = c.find(x => x.id === main.id)
    if (s) s.n++; else c.push({ id: main.id, n: 1 })
  }
  for (const r of rest) chips[n - 1].push({ ...r })
  return chips
}

/** A node's channel: its dealt-out chips and how many have landed. Kept per node id while the session lasts. */
export interface Work { node: NodeKind; id: string; chips: Stack[][]; done: number; manaPerChip: number; extra?: unknown }
const kept = new Map<string, Work>()
export const workOf = (id: string) => kept.get(id)
export function beginWork(node: NodeKind, id: string, plan: () => { drops: Stack[]; extra?: unknown }, tier: number, manaCost: number): Work {
  const had = kept.get(id)
  if (had && had.done < had.chips.length) return had
  const p = plan(), n = chipsFor(tier)
  const w: Work = { node, id, chips: splitDrops(p.drops, n), done: 0, manaPerChip: manaCost / n, extra: p.extra }
  kept.set(id, w)
  return w
}
/** Take the next chip's drops (and count it). `last` = this chip finishes the node: commit it, then forget it. */
export function takeChip(w: Work): { drops: Stack[]; last: boolean } {
  const drops = w.chips[w.done] ?? []
  w.done++
  const last = w.done >= w.chips.length
  if (last) kept.delete(w.id)
  return { drops, last }
}
export const _resetWork = () => kept.clear()
