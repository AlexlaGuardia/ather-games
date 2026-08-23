// ── What the player can ask the game to do, and what says it by default ───────────────────────
//
// WHY THIS EXISTS. Shimmer had NO input abstraction: `e.code === 'KeyF'` appeared raw across three
// separate keydown listeners inside an 8540-line component, movement read `k.KeyW` directly out of
// a held-keys map, and the touch controls were a second hardcoded path beside it. Two input
// dialects, no vocabulary joining them.
//
// ★ THREE REQUESTS, ONE PIECE OF ARCHITECTURE — that is the whole reason this file exists rather
// than a gamepad patch bolted onto the keydown handler:
//   · **controller support** needs something other than a `KeyboardEvent` to be able to drive the game
//   · **a rebinding menu** cannot rebind a key that is hardcoded in thirty places
//   · **tutorial hints that are CORRECT** cannot say "press F" when the player is holding a pad, or
//     after they have rebound it — a hint is a CLAIM ABOUT A BINDING, and today it is a string
//     literal sitting in a div, which is the same lying-doc shape this repo keeps filing bugs about
// All three are the same missing layer. Build it once.
//
// ⚠ THE VOCABULARY BELOW IS EXTRACTED, NOT INVENTED. Every action was read off the live handlers in
// `VoxelWorld.tsx` (the `e.code` chain at ~2004-2100, the held map at ~4090/6691, `Number(e.key)`
// for the hotbar at 2007). Nothing here is aspirational: if it is in this list, the game already
// does it. Inventing an action the game cannot perform would put a lie in the rebinding menu.

/** A thing the player can do. The game asks for these; it never asks for a key. */
export type ActionId =
  // held — sampled every frame
  | 'move.forward' | 'move.back' | 'move.left' | 'move.right'
  | 'move.jump' | 'move.slide'
  // pressed — edge-triggered
  | 'world.mine' | 'world.place' | 'world.interact'
  | 'item.draw' | 'item.drop' | 'item.cycle'
  | 'ui.craft' | 'ui.build' | 'ui.map' | 'ui.inventory' | 'ui.chat' | 'ui.close' | 'ui.settings'
  | 'build.rotate' | 'build.tierUp' | 'build.tierDown'
  | 'owner.fly'

/** Held actions are sampled per frame; pressed actions fire once on the edge. */
export const HELD: readonly ActionId[] = [
  'move.forward', 'move.back', 'move.left', 'move.right', 'move.jump', 'move.slide',
  'world.mine', 'world.place',
] as const

/**
 * Standard-mapping gamepad buttons, by name.
 *
 * ⚠ NAMED BECAUSE THE INDICES ARE MEANINGLESS ON SIGHT. `buttons[7]` in a binding table is a magic
 * number that nobody can review; `RT` is a claim a reader can check against their own controller.
 * Indices are the W3C "standard" mapping — a pad reporting `mapping !== 'standard'` is refused
 * rather than guessed at (see gamepad.ts), because a wrong guess here rebinds the player's hands.
 */
export const PAD = {
  A: 0, B: 1, X: 2, Y: 3,
  LB: 4, RB: 5, LT: 6, RT: 7,
  SELECT: 8, START: 9, L3: 10, R3: 11,
  DUP: 12, DDOWN: 13, DLEFT: 14, DRIGHT: 15,
} as const
export type PadButton = keyof typeof PAD

export interface Binding {
  /** `KeyboardEvent.code` values. Several may drive one action (Enter and KeyT both open chat). */
  keys: string[]
  /** Standard-mapping buttons. Empty means "no pad binding yet", which the guard treats as a gap. */
  pad: PadButton[]
}

/**
 * The defaults.
 *
 * ⚠ THE KEYBOARD HALF IS THE SHIPPED BEHAVIOUR, COPIED EXACTLY — this table must not be an
 * opportunity to quietly redesign the controls. Anyone who has played the build has these in their
 * hands, and a "tidy-up" here is a silent remap of a stranger's muscle memory. `input.test.ts`
 * pins the ones the on-screen hints promise.
 *
 * ★ THE PAD HALF IS THE ONLY NEW DESIGN, and it follows the console conventions players arrive
 * with rather than mirroring the keyboard: triggers mine and place (the two continuous verbs), the
 * face buttons carry jump and interact, and the shoulders cycle the hotbar. Sticks are handled in
 * gamepad.ts, not here — an axis is not a button and pretending otherwise is how deadzone bugs get
 * written.
 */
export const DEFAULTS: Record<ActionId, Binding> = {
  'move.forward':   { keys: ['KeyW'],                      pad: [] },
  'move.back':      { keys: ['KeyS'],                      pad: [] },
  'move.left':      { keys: ['KeyA'],                      pad: [] },
  'move.right':     { keys: ['KeyD'],                      pad: [] },
  'move.jump':      { keys: ['Space'],                     pad: ['A'] },
  'move.slide':     { keys: ['ShiftLeft'],                 pad: ['L3'] },
  'world.mine':     { keys: [],                            pad: ['RT'] },
  'world.place':    { keys: [],                            pad: ['LT'] },
  'world.interact': { keys: ['KeyE'],                      pad: ['X'] },
  'item.draw':      { keys: ['KeyF'],                      pad: ['Y'] },
  'item.drop':      { keys: ['KeyQ'],                      pad: ['DDOWN'] },
  'item.cycle':     { keys: ['KeyQ'],                      pad: ['RB'] },
  'ui.craft':       { keys: ['KeyC'],                      pad: ['DLEFT'] },
  'ui.build':       { keys: ['Tab'],                       pad: ['DRIGHT'] },
  'ui.map':         { keys: ['KeyM'],                      pad: ['SELECT'] },
  'ui.inventory':   { keys: ['KeyI'],                      pad: ['DUP'] },
  'ui.chat':        { keys: ['KeyT', 'Enter'],             pad: [] },
  'ui.close':       { keys: ['Escape'],                    pad: ['B'] },
  'ui.settings':    { keys: ['KeyO'],                      pad: ['START'] },
  'build.rotate':   { keys: ['KeyR'],                      pad: ['LB'] },
  'build.tierUp':   { keys: ['BracketRight'],              pad: [] },
  'build.tierDown': { keys: ['BracketLeft'],               pad: [] },
  'owner.fly':      { keys: ['KeyV'],                      pad: [] },
}

/**
 * Player-facing names. These are what a rebinding menu lists and what a tutorial hint says, so they
 * are sentence-case verbs rather than ids — "Mine", not "world.mine".
 */
export const LABEL: Record<ActionId, string> = {
  'move.forward': 'Forward', 'move.back': 'Back', 'move.left': 'Left', 'move.right': 'Right',
  'move.jump': 'Jump', 'move.slide': 'Slide',
  'world.mine': 'Mine', 'world.place': 'Place', 'world.interact': 'Interact',
  'item.draw': 'Draw / stow', 'item.drop': 'Drop', 'item.cycle': 'Cycle weapon',
  'ui.craft': 'Craft', 'ui.build': 'Build mode', 'ui.map': 'Map', 'ui.inventory': 'Inventory',
  'ui.chat': 'Chat', 'ui.close': 'Close', 'ui.settings': 'Settings',
  'build.rotate': 'Rotate piece', 'build.tierUp': 'Next tier', 'build.tierDown': 'Previous tier',
  'owner.fly': 'Fly (keeper only)',
}

/** Actions a non-owner can never perform — hidden from the rebinding menu rather than shown greyed. */
export const OWNER_ONLY: readonly ActionId[] = ['owner.fly'] as const

/**
 * Actions a controller drives with an ANALOG STICK rather than a button.
 *
 * ⚠ THIS EXISTS BECAUSE `padGaps()` WAS LYING. It reports actions with no pad binding as the
 * controller-coverage worklist, and it counted the four movement verbs — which the left stick
 * covers perfectly — as unbound. A worklist that names four items nobody needs to do is a worklist
 * people stop reading, and it would have hidden the four REAL gaps among them.
 *
 * ★ AND THE UNDERLYING LIMITATION IS NAMED RATHER THAN PAPERED OVER: `Binding` models keys and
 * buttons, not axes, so a stick cannot currently be REBOUND the way a button can. That is a
 * deliberate first-pass scope call — players expect to remap buttons and do not expect to remap
 * which stick walks — but it is a real edge of this layer, and the day someone asks for
 * southpaw/inverted sticks this is the file that has to grow an axis concept.
 */
export const STICK_DRIVEN: readonly ActionId[] = [
  'move.forward', 'move.back', 'move.left', 'move.right',
] as const

/**
 * How the rebinding menu groups the list.
 *
 * ⚠ EVERY ACTION MUST BE IN EXACTLY ONE GROUP, and `input.test.ts` asserts it. A menu built from a
 * hand-kept grouping silently DROPS whatever it forgets — the player would simply never see that
 * row, and "the menu does not list Craft" is a bug nobody reports because nobody knows to look for
 * it. Same failure as an unclassified file in a guard's PENDING list: absence reads as nothing.
 */
export const GROUPS: readonly { title: string; actions: readonly ActionId[] }[] = [
  { title: 'Movement', actions: ['move.forward', 'move.back', 'move.left', 'move.right', 'move.jump', 'move.slide'] },
  { title: 'World',    actions: ['world.mine', 'world.place', 'world.interact'] },
  { title: 'Items',    actions: ['item.draw', 'item.drop', 'item.cycle'] },
  { title: 'Building', actions: ['ui.build', 'build.rotate', 'build.tierUp', 'build.tierDown'] },
  { title: 'Menus',    actions: ['ui.craft', 'ui.map', 'ui.inventory', 'ui.chat', 'ui.close', 'ui.settings'] },
  { title: 'Keeper',   actions: ['owner.fly'] },
] as const

export const ALL_ACTIONS = Object.keys(DEFAULTS) as ActionId[]
