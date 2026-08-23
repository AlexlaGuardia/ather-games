// ── The binding map: what the player has actually chosen, and how it survives a build ──────────
//
// ★ THE DECISIONS IN HERE ARE PURE AND STORAGE IS A THIN WRAPPER, deliberately. A rule that lives
// inside a `localStorage` call is a rule nothing can test — the same reasoning that put the
// IndexedDB adoption rules outside their transaction on 2026-08-23. `merge`, `rebind`, `conflicts`
// and `orphans` are all data-in/data-out, so `input.test.ts` runs the REAL ones headless.

import { DEFAULTS, ALL_ACTIONS, type ActionId, type Binding, type PadButton } from './actions'

/**
 * ⚠ DEVICE-SCOPED, NOT KEEPER-SCOPED, AND THAT IS A DELIBERATE CALL AGAINST THE HOUSE HABIT.
 *
 * Nearly every other `ather:` key was moved per-account over 2026-08-22/23 (#682, #692, the keeper
 * rune) because a saved WORLD belongs to a character. Controls do not: they belong to the hands and
 * the hardware in front of them. Two accounts on one desktop want the same keys, and the same
 * account on a phone and a desktop does not. Scoping these per keeper would hand a returning player
 * default controls for no reason they could name.
 *
 * It is registered in `DEVICE_KEYS` in `keeper-local.test.ts`, beside `shimmer.voxel.settings.v1`,
 * which is the same call for the same reason. That guard fails on any shimmer key that classifies
 * as neither keeper nor device, so this decision is recorded somewhere that can go red — not just
 * in this comment.
 */
export const BINDINGS_KEY = 'shimmer.voxel.bindings.v1'

export type BindingMap = Record<ActionId, Binding>

/**
 * Fold stored bindings over the defaults.
 *
 * ⚠⚠ THE MERGE DIRECTION IS THE WHOLE POINT AND IT IS NOT COSMETIC. A stored map is a snapshot of
 * the actions that existed the DAY IT WAS SAVED. Read it as the truth and every action added since
 * arrives UNBOUND — a player who set their controls once, then updated, would find the new verb
 * dead and nothing on screen explaining why. Defaults first, stored on top, means a new action can
 * only ever arrive bound. Same shape as the save-epoch argument: never let old state silently
 * subtract from what the build can do.
 *
 * Unknown ids in stored data are DROPPED rather than kept, so a binding for an action that was
 * removed cannot sit in the map forever conflicting with a live one.
 */
export function merge(stored: Partial<BindingMap> | null): BindingMap {
  const out = {} as BindingMap
  for (const id of ALL_ACTIONS) {
    const s = stored?.[id]
    out[id] = s && Array.isArray(s.keys) && Array.isArray(s.pad)
      ? { keys: [...s.keys], pad: [...s.pad] }
      : { keys: [...DEFAULTS[id].keys], pad: [...DEFAULTS[id].pad] }
  }
  return out
}

/**
 * Actions left with no way to trigger them on EITHER device.
 *
 * ⚠ An action bound to nothing is a verb the player can see in the menu and can never perform.
 * `world.mine` has no keyboard default because mining is the mouse button — so "no keys" is not by
 * itself a fault, and a naive check would report every mouse verb as broken. The fault is no keys
 * AND no pad. (`ui.chat` and the tier keys have no pad binding on purpose; that is a GAP, reported
 * separately, not an orphan.)
 */
export function orphans(map: BindingMap): ActionId[] {
  return ALL_ACTIONS.filter(id => map[id].keys.length === 0 && map[id].pad.length === 0)
}

/** Actions with a keyboard binding but no controller one — the controller-coverage worklist. */
export function padGaps(map: BindingMap): ActionId[] {
  return ALL_ACTIONS.filter(id => map[id].pad.length === 0)
}

export interface Conflict { input: string; device: 'key' | 'pad'; actions: ActionId[] }

/**
 * Two actions listening to one input.
 *
 * ⚠ NOT ALL OF THESE ARE BUGS, WHICH IS WHY THIS REPORTS RATHER THAN REFUSES. `item.drop` and
 * `item.cycle` both ship on KeyQ — the shipped handler picks between them by whether the weapon is
 * drawn, so it is a real, working, context-dependent binding. A rebinding UI should SHOW a clash
 * and let the player decide; a validator that silently refused one would break the live controls.
 */
export function conflicts(map: BindingMap): Conflict[] {
  const out: Conflict[] = []
  for (const dev of ['key', 'pad'] as const) {
    const seen = new Map<string, ActionId[]>()
    for (const id of ALL_ACTIONS) {
      for (const input of (dev === 'key' ? map[id].keys : map[id].pad) as string[]) {
        seen.set(input, [...(seen.get(input) ?? []), id])
      }
    }
    for (const [input, actions] of seen) if (actions.length > 1) out.push({ input, device: dev, actions })
  }
  return out
}

/**
 * Rebind one action on one device.
 *
 * Returns a NEW map — never mutates — so a menu can preview a change, show the conflicts it would
 * create, and let the player back out without having already applied it.
 */
export function rebind(map: BindingMap, id: ActionId, device: 'key' | 'pad', inputs: string[]): BindingMap {
  const next: BindingMap = { ...map, [id]: { ...map[id] } }
  if (device === 'key') next[id].keys = [...inputs]
  else next[id].pad = inputs as PadButton[]
  return next
}

export function resetAll(): BindingMap { return merge(null) }

// ── storage: the thin part ────────────────────────────────────────────────────────────────────

export function load(): BindingMap {
  if (typeof localStorage === 'undefined') return merge(null)
  try { return merge(JSON.parse(localStorage.getItem(BINDINGS_KEY) ?? 'null')) }
  catch { return merge(null) }   // corrupt JSON must give playable controls, never a dead input layer
}

export function save(map: BindingMap): void {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(BINDINGS_KEY, JSON.stringify(map)) } catch { /* private mode: keep playing */ }
}
