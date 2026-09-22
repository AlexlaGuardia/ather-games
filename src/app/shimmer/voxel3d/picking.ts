// Picking a wild fruit bush — the berries come off, the plant stays, and it fruits again tomorrow.
//
// ★ PURE. No three, no DOM, no React — a rule about a plant is not a rendering concern, the same
// split `watering.ts` and `break-fx-spec.ts` draw. The renderer asks `isFruited`; nothing here
// knows an InstancedMesh exists.
//
// ── ★★★ WHY THIS EXISTS: THE WORLD'S FRUIT SUPPLY WAS STRICTLY DECREASING ─────────────────────
// Alex, 2026-09-22: *"what if the berries were pickable.. and grow back over time."* It is a good
// feature and it also closes a live defect nobody had hit yet. Before this, the ONLY way to get
// fruit was to break the bush (`registry.ts` › `drops: [{ sunfruit, count: 2 }]`). Wild flora is a
// pure function of position, removing one is an ordinary stored edit, and **edits never expire** —
// so every harvest permanently deleted a bush from the world and nothing ever put one back. The
// only appearances of the word "regrow" in this tree are BUGS where something came back by mistake.
//
// That is not cosmetic. Sunfruit and moonberry feed three brews (`shimmer_salve` ×2,
// `bond_philter` ×3, `holding_philter` ×2) and are the favourite food of six of the ten spirits.
// A keeper who worked the thickets hard enough would have quietly deleted an alchemy line, months
// before anyone noticed, with no error and nothing in a log.
//
// ── ★ CANON ALREADY HANDED US THIS, BY NAME ──────────────────────────────────────────────────
// `voxel/flora.ts` quotes the ruling: canon fixed the GROUND and left *"rarity, patch density,
// yield per pick, respawn"* to Jin. Respawn has been ours since the herbs landed; it simply was
// never built. So nothing here needs a Magii gate — the numbers are build, and they are dials.
//
// ── ★★ THE STORE IS SELF-LIMITING, WHICH IS THE WHOLE REASON IT IS SAFE ──────────────────────
// Per-cell state on WILD cells is the one thing that could go wrong here: the beds' `WateredBeds`
// is safe because a plot is bounded, and a keeper could pick thousands of bushes across a world.
// The way out is that **a fully regrown bush is indistinguishable from one nobody ever touched**,
// so its record carries no information and is deleted (`pruneRegrown`). The map therefore only
// ever holds bushes picked inside the last `REGROW_MS`, which is bounded by how fast a person can
// walk, not by how long they have played.
//
// ── ★ AND IT LIVES IN THE PLAYER SIDECAR, NOT IN `ColumnSave` ────────────────────────────────
// `save.ts`'s own rule, verbatim: *a thing that HOLDS GOODS must arrive and leave with its block,
// in one transaction* — that is why chests and station jobs are per-column. **A picked bush holds
// nothing; all it stores is a timestamp**, which that file names as the pot clock's case, not the
// chest's. Losing one costs a day of regrow, not a satchel.

import { MAT } from '../voxel/depth'

/**
 * How long a picked bush takes to fruit again. Alex's call, 2026-09-22: *"next day regrow"*.
 *
 * ⚠ ITS OWN CONSTANT, NOT `WATER_HOLD_MS`, THOUGH BOTH ARE 24h TODAY. They are the same number for
 * different reasons — a bed dries on a daily cycle, a bush fruits on one — and sharing the symbol
 * would mean re-tuning how long soil stays damp silently re-tunes the world's fruit economy.
 * A shared value that nothing requires to be shared is the mirror bug this tree keeps paying for.
 */
export const REGROW_MS = 24 * 60 * 60 * 1000

/** Every fruit bush that has been picked and has not yet fruited again, by `bushKey` → when it was picked. */
export type PickedBushes = Map<string, number>

/**
 * ⚠ NAMESPACED BY SPACE, AND THAT IS NOT DEFENSIVE — `save.ts` records the corruption it prevents:
 * plot (0,0) and Wilds (0,0) are different places wearing one name, and a save that forgot which
 * space a position belonged to put a keeper inside the fold's shell where nothing is generated.
 * Wild bushes only grow in the Wilds today, so this costs nothing today; the plot grows its own
 * bushes next, and then it is the only thing keeping one plot bush from marking a wild one picked.
 */
export const bushKey = (space: string, x: number, y: number, z: number): string => `${space}:${x},${y},${z}`

/** Is this material a bush that carries pickable fruit? Asked of the MATERIAL, never of a name. */
export const isFruitBush = (mat: number): boolean =>
  mat === MAT.SUNFRUIT_BUSH || mat === MAT.MOONBERRY_BUSH

/**
 * Does this bush have its fruit right now?
 *
 * ★ ABSENT MEANS FRUITED, and that is the load-bearing default: the overwhelming majority of
 * bushes in the world have never been touched and must cost ZERO bytes. Only a picked one is
 * written down, and only until it regrows.
 */
export function isFruited(picked: PickedBushes, space: string, x: number, y: number, z: number, now: number): boolean {
  const at = picked.get(bushKey(space, x, y, z))
  return at === undefined || now - at >= REGROW_MS
}

/** Milliseconds until this bush fruits again; 0 when it already has. */
export function regrowLeft(picked: PickedBushes, space: string, x: number, y: number, z: number, now: number): number {
  const at = picked.get(bushKey(space, x, y, z))
  if (at === undefined) return 0
  return Math.max(0, at + REGROW_MS - now)
}

/** Why the pick will not happen, or `'ok'`. Typed like every blocker in this tree. */
export type PickRefusal = 'ok' | 'not-a-bush' | 'already-picked'

export function pickBlocker(
  picked: PickedBushes, mat: number, space: string, x: number, y: number, z: number, now: number,
): PickRefusal {
  if (!isFruitBush(mat)) return 'not-a-bush'
  if (!isFruited(picked, space, x, y, z, now)) return 'already-picked'
  return 'ok'
}

/**
 * Take the fruit. Returns what the bush gave, or null when it had nothing to give.
 *
 * ★ THE BUSH IS NOT REMOVED — that is the entire point, and it is why this is a separate verb from
 * breaking it. Breaking still works and still deletes the plant for good: that is how a keeper
 * CLEARS ground, and leaving both verbs in means the player chooses between a harvest they can
 * come back to and a patch of land they want empty.
 */
export function pickBush(
  picked: PickedBushes, mat: number, space: string, x: number, y: number, z: number, now: number,
): { itemId: string; count: number } | null {
  if (pickBlocker(picked, mat, space, x, y, z, now) !== 'ok') return null
  picked.set(bushKey(space, x, y, z), now)
  return { itemId: FRUIT_OF_BUSH[mat], count: PICK_YIELD }
}

/**
 * What one picking yields.
 *
 * ⚠ THE SAME AS THE BREAK DROP (`registry.ts`), ON PURPOSE. If picking paid LESS, the optimal play
 * would be to destroy every bush you meet — which is precisely the behaviour this file exists to
 * stop, and a number that quietly rewards it would undo the feature while looking like balance.
 * Canon handed us *"yield per pick"*; this is the dial, and it is deliberately not a clever one.
 */
export const PICK_YIELD = 2

/** The fruit each bush carries. Keyed on MATERIAL, so a renamed item cannot silently unhook it. */
export const FRUIT_OF_BUSH: Readonly<Record<number, string>> = {
  [MAT.SUNFRUIT_BUSH]: 'sunfruit',
  [MAT.MOONBERRY_BUSH]: 'moonberry',
}

/**
 * Drop every record that has regrown — see this file's header. Returns how many were dropped.
 *
 * ⚠ CALL IT, AND NOT ONLY AT SAVE TIME. A record that has regrown is not merely stale, it is
 * ACTIVELY WRONG to keep: `isFruited` already answers true for it, so the map is carrying a row
 * that changes no answer. Left to grow, the one structure in this feature that could become
 * unbounded is the one nobody is watching.
 */
export function pruneRegrown(picked: PickedBushes, now: number): number {
  let n = 0
  for (const [k, at] of picked) if (now - at >= REGROW_MS) { picked.delete(k); n++ }
  return n
}

/** One line per refusal, kept beside it so a new refusal cannot ship silent (watering.ts's rule). */
export function pickRefusalLine(
  why: PickRefusal, picked: PickedBushes, space: string, x: number, y: number, z: number, now: number,
): string {
  switch (why) {
    case 'not-a-bush': return 'nothing to pick here'
    case 'already-picked': {
      const left = regrowLeft(picked, space, x, y, z, now)
      const h = Math.ceil(left / 3_600_000)
      // A bare "already picked" leaves a keeper standing there guessing whether to wait or walk on.
      return h <= 1 ? 'picked bare — it will fruit again within the hour' : `picked bare — it fruits again in ${h}h`
    }
    default: return ''
  }
}

/** What a keeper is told when the fruit comes off. */
export const pickLine = (mat: number, count: number): string =>
  `picked ${count} ${FRUIT_OF_BUSH[mat] === 'moonberry' ? 'moonberries' : 'sunfruit'} — the bush will fruit again tomorrow`

// ── persistence: the player sidecar, as records rather than a Map (JSON has no Map) ────────────
export interface PickedSave { k: string; at: number }

/** ⚠ PRUNES AS IT WRITES. A regrown record is not worth a byte in the save file either. */
export function pickedToSave(picked: PickedBushes, now: number): PickedSave[] {
  pruneRegrown(picked, now)
  return [...picked].map(([k, at]) => ({ k, at }))
}

export function pickedFromSave(raw: unknown, now: number): PickedBushes {
  const out: PickedBushes = new Map()
  if (!Array.isArray(raw)) return out
  for (const r of raw as PickedSave[]) {
    if (!r || typeof r.k !== 'string' || typeof r.at !== 'number') continue
    out.set(r.k, r.at)
  }
  // A save written before a long absence is mostly regrown by the time it loads back.
  pruneRegrown(out, now)
  return out
}
