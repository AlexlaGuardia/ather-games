// ── The UI verb chain: ONE priority order, walked by both devices ──────────────────────────────
//
// WHY THIS EXISTS. The seven UI verbs (craft, build, map, satchel, draw, drop, close) lived inside
// `VoxelWorld`'s keydown listener, and their priority rules — the cursor-surface gate, the draw
// lock, "the doors run before the world verbs" — were encoded as early `return`s in that handler's
// body. A `KeyboardEvent` was the only way in. So when the pad's edge half was finally plugged in
// (2026-08-28), it could reach the cast and world verbs and NOT these: the rules that decide
// whether `ui.craft` may run were unreachable from anywhere but a keystroke.
//
// ⚠⚠ AND THE OBVIOUS FIX IS THE WRONG ONE. Re-testing `cursorUIOpen`/`drawn` in the frame loop
// duplicates the chain, and a duplicated priority order does not stay duplicated — it drifts, one
// branch at a time, until the two devices disagree about what E does and nothing is red. The
// previous session refused to do that half-refactor and said so in place; this is the other half.
//
// ★ THE SEAM IS ORDER-AND-GATING, NOT BEHAVIOUR. Each step's BODY stays in the component, as one
// named thunk closing over the state it already had — moving those out would be a large, silent
// transcription of twenty React setters for no gain. What moves here is the part the two devices
// have to agree on: which steps exist, in what order, behind which gates, and which of them stop
// the walk. That is the thing a test can hold, and `ui-chain.test.ts` holds it by walking the SAME
// chain twice — once as a keyboard, once as a pad — and asserting the two agree step for step.
//
// ★ REBUILT EVERY RENDER, ON PURPOSE. `when`/`blocked` are plain booleans rather than thunks, so a
// step cannot read a different frame's state than the one the chain was built from, and a test
// needs no fake clock to pin a gate open. The chain is ~16 entries; building it is free beside the
// work any one of its bodies does.

import type { ActionId } from '@/lib/input/actions'

/**
 * A step is either a BARRIER or an ACTION.
 *
 * ⚠ Gates are named because a walk that stops has to be able to SAY where — `runChain`'s caller
 * decides whether the keyboard-only branches below the barrier still run, and "it stopped" is not
 * enough to debug when the answer is wrong. A nameless barrier is the `scopeAt` mistake again:
 * a question answered by a proxy nobody can read back.
 */
export type Step =
  | { kind: 'gate'; name: string; blocked: boolean }
  | { kind: 'action'; id: ActionId; when: boolean; run: (ev: ChainEvent) => void; stop: boolean }

/**
 * What the DEVICE knows about this particular press that the chain cannot.
 *
 * ★ IT EXISTS FOR ONE REAL CASE AND IS NOT SPECULATIVE PLUMBING. `/` opens the console
 * PRE-SLASHED, and it is the same step as `ui.chat` at the same position behind the same surface
 * gate — only the seed differs. Modelling it as a separate branch above the chain would put one
 * step of the order back in the adapter, which is the duplication this file exists to end.
 */
export interface ChainEvent {
  /** Text the console opens with. `'/'` for the slash door, `''` for the chat key. */
  consoleSeed: string
}

export interface ChainResult {
  /** Every action that actually ran, in the order it ran. */
  ran: ActionId[]
  /** True if a gate blocked or a `stop` action fired — i.e. the original handler would have returned. */
  stopped: boolean
  /** The gate that blocked, if one did. Null when the walk ended any other way. */
  blockedBy: string | null
}

/**
 * Walk the chain, firing every step whose action the device reports.
 *
 * ⚠ `fires` IS A PREDICATE PER STEP, NOT A RESOLVED ACTION, and that is what preserves the
 * original semantics exactly. A key bound to two actions ran BOTH branches of the old `if` chain,
 * in order; resolving a code to one action id first would silently drop the second. The keyboard
 * passes `id => matches(map, code, id)`; the pad passes `id => padNow.has(id)`.
 */
export function runChain(chain: readonly Step[], fires: (id: ActionId) => boolean, ev: ChainEvent): ChainResult {
  const ran: ActionId[] = []
  for (const s of chain) {
    if (s.kind === 'gate') {
      if (s.blocked) return { ran, stopped: true, blockedBy: s.name }
      continue
    }
    if (!s.when) continue
    if (!fires(s.id)) continue
    s.run(ev)
    ran.push(s.id)
    if (s.stop) return { ran, stopped: true, blockedBy: null }
  }
  return { ran, stopped: false, blockedBy: null }
}

/**
 * The gate states the chain reads. Every field is a live boolean off the component's render.
 *
 * ⚠ ONLY THE FIELDS THE ORDER DEPENDS ON. `nearGreg`/`nearTable`/`nearMist` decide what
 * `world.interact` DOES, not whether it may run, so they stay inside that thunk. Widening this
 * interface to "the state the handler touches" would make the chain a second copy of the
 * component, which is the thing it exists to prevent.
 */
export interface UiChainState {
  consoleOpen: boolean
  dialogueOpen: boolean
  craftOpen: boolean
  bagOpen: boolean
  showSettings: boolean
  cursorUIOpen: boolean
  drawn: boolean
  build: boolean
}

/** One thunk per branch body. Named for the verb, not the setter it happens to call. */
export interface UiChainActions {
  openConsole(seed: string): void
  closeSurfaces(): void
  toggleSettings(): void
  toggleCraft(): void
  toggleMap(): void
  toggleBag(): void
  interact(): void
  toggleDrawn(): void
  cycleWeapon(): void
  toggleBuild(): void
  rotatePiece(): void
  materialNext(): void
  materialPrev(): void
}

/**
 * Keyboard defaults a browser would otherwise act on, suppressed only when the action REALLY RAN.
 *
 * ⚠ `Tab` is the one that matters: unsuppressed it moves focus out of the canvas, so a build-mode
 * toggle would also hand the player's next keystroke to the browser chrome. It is conditional on
 * the step firing because the old handler's `preventDefault` sat INSIDE the branch — with a weapon
 * drawn the chain stops above `ui.build`, and Tab there has always been the browser's.
 */
export const SUPPRESS_DEFAULT: ReadonlySet<ActionId> = new Set<ActionId>(['ui.chat', 'ui.build'])

/** The name of the barrier past which nothing may touch the world. Exported so the guard can cite it. */
export const GATE_CURSOR_UI = 'cursor-surface-open'
/** The draw lock's barrier: with a weapon out, neither hand is free. */
export const GATE_DRAWN = 'weapon-drawn'

/**
 * The chain, in the order the shipped keydown handler ran it.
 *
 * ★ THE ORDER IS THE ARTEFACT — every line below was read off that handler rather than redesigned,
 * and the comments that explained each rule stayed with their bodies in the component. Three
 * properties are load-bearing and each has an assert in `ui-chain.test.ts`:
 *
 *   1. **The doors run before the world verbs, and they run with a surface up.** They are how you
 *      get OUT. A world verb under an open menu is a key whose effect the player cannot see, which
 *      is how you flip into build mode from inside the bag and only find out when you close it.
 *   2. **`ui.close` is ungated.** It sits above the draw lock and above the cursor gate, because a
 *      close key that only works when nothing is open is not a close key.
 *   3. **Everything past `GATE_DRAWN` is locked while a weapon is out** — the mode Alex ruled on
 *      2026-08-07, blocking the verbs rather than hiding the row.
 */
export function uiChain(s: UiChainState, a: UiChainActions): Step[] {
  const act = (id: ActionId, when: boolean, run: (ev: ChainEvent) => void, stop = true): Step =>
    ({ kind: 'action', id, when, run, stop })
  return [
    // Chat first: a console you cannot open while your weapon is out is a console you cannot use
    // to debug the weapon. Its gate is the surfaces, not the draw lock.
    act('ui.chat', !s.consoleOpen && !s.dialogueOpen && !s.craftOpen && !s.bagOpen && !s.showSettings, ev => a.openConsole(ev.consoleSeed)),
    act('ui.close', true, () => a.closeSurfaces()),
    act('ui.settings', !s.drawn, () => a.toggleSettings()),
    act('ui.craft', !s.drawn, () => a.toggleCraft()),
    act('ui.map', !s.drawn, () => a.toggleMap()),
    act('ui.inventory', !s.drawn, () => a.toggleBag()),
    act('world.interact', !s.drawn, () => a.interact()),
    { kind: 'gate', name: GATE_CURSOR_UI, blocked: s.cursorUIOpen },
    /**
     * ⚠⚠ DRAW BEATS CYCLE AND THAT IS DELIBERATE, AGAINST WHAT `actions.ts` USED TO CLAIM.
     * On a pad both are `Y`. Its old comment said they resolve "drawn = cycle, stowed = draw",
     * which would need `item.cycle` ABOVE this step — and the shipped order has never done that,
     * so pad-Y has always drawn and stowed and never cycled. Reordering to match the comment is
     * the trap: cycle would then eat every drawn press and a controller could DRAW A WEAPON AND
     * NEVER STOW IT. Stow is the verb you cannot lose. The comment is now corrected to describe
     * this; making cycle reachable on a pad needs a second button, which is Alex's call.
     */
    act('item.draw', true, () => a.toggleDrawn()),
    act('item.cycle', s.drawn, () => a.cycleWeapon()),
    { kind: 'gate', name: GATE_DRAWN, blocked: s.drawn },
    // ── past here the walk does NOT stop: these were the trailing `if`s with no `return` ────────
    act('ui.build', true, () => a.toggleBuild(), false),
    act('build.rotate', true, () => a.rotatePiece(), false),
    act('build.materialNext', s.build, () => a.materialNext(), false),
    act('build.materialPrev', s.build, () => a.materialPrev(), false),
  ]
}
