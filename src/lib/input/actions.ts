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
  | 'build.rotate' | 'build.materialNext' | 'build.materialPrev'
  | 'cast.tactical' | 'cast.signature' | 'cast.focus'
  | 'owner.fly'

/** Held actions are sampled per frame; pressed actions fire once on the edge. */
export const HELD: readonly ActionId[] = [
  'move.forward', 'move.back', 'move.left', 'move.right', 'move.jump', 'move.slide',
  'world.mine', 'world.place',
  // ⚠ HELD, not pressed. Focusing is a thing you DO for as long as you hold it — a tap that charged
  // a fixed lump would make it a cooldown ability, which is the opposite of the design: it is meant
  // to cost you standing still.
  'cast.focus',
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
  /**
   * A pad CHORD — every button must be down at once. `[]`/absent means the action has no chord.
   *
   * ── ★★★ AND vs OR, AND WHY THIS COULD NOT REUSE `pad` ────────────────────────────────────
   * `pad` is an OR list: any one of its buttons fires the action. A chord is the other operator,
   * so it needs its own field rather than a flag — there is no way to spell "LB and RB" in a list
   * whose semantics are "LB or RB", and overloading it would silently turn every existing
   * two-button binding into a chord.
   *
   * ── ★★ THE ORDER IS LOAD-BEARING: [modifier, …, trigger] ─────────────────────────────────
   * The LAST button is the TRIGGER — the one whose press fires the chord. Everything before it
   * must already be held. This is not a style choice, it is forced by what the buttons already do:
   * a human never presses two buttons on the same frame, so a chord built out of two EDGE verbs
   * needs a timing window to see whether the second is coming, and that window is latency on a
   * combat verb. `RB` is `cast.focus`, which is a HOLD (charge the shield) and has no edge action
   * to race. So `['RB','LB']` reads "while charging, tap the tactical button" — zero latency, no
   * window, and the only thing that needs suppressing is the tactical's own edge on that press.
   * ⚠ Reversing it to `['LB','RB']` would NOT work: LB's edge fires the tactical the moment it
   * goes down, long before RB arrives, so the chord could only ever fire after the thing it is
   * supposed to replace.
   */
  padChord?: PadButton[]
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
  // ⚠ BOTH SHIFTS. VoxelWorld read `k.ShiftLeft || k.ShiftRight` directly until 2026-08-28; when
  // that read moved behind the bindings, a single-key default would have quietly retired the right
  // shift for anyone who slides with it. The table must copy the shipped controls, not tidy them.
  'move.slide':     { keys: ['ShiftLeft', 'ShiftRight'],   pad: ['L3'] },
  'world.mine':     { keys: [],                            pad: ['RT'] },
  'world.place':    { keys: [],                            pad: ['LT'] },
  'world.interact': { keys: ['KeyE'],                      pad: ['X'] },
  'item.draw':      { keys: ['KeyF'],                      pad: ['Y'] },
  'item.drop':      { keys: ['KeyQ'],                      pad: ['DDOWN'] },
  // ⚠ PAD MOVED RB -> Y (2026-08-28, Alex's ruling put the shield on RB). Y is also `item.draw`.
  //
  // ⚠⚠ CORRECTED 2026-08-28 (the UI-verb tranche). This comment used to say the two "resolve the
  // same way KeyQ's drop/cycle overlap already does: drawn = cycle, stowed = draw." THAT WAS NEVER
  // TRUE OF THE SHIPPED ORDER, and it was written on the day the pad's edge half was plugged in —
  // so it described a resolution nothing implemented and nothing could have implemented. The verb
  // chain runs `item.draw` first, ungated, and stops there, so pad Y has always drawn and stowed
  // and has never cycled. The keyboard never noticed because F and Q are different keys.
  //
  // ★ AND THE ORDER WAS NOT CHANGED TO MATCH THE COMMENT, DELIBERATELY. Putting cycle first would
  // make it eat every drawn press, and a controller could then DRAW A WEAPON AND NEVER STOW IT —
  // stow is the verb you cannot afford to lose. `ui-chain.test.ts` asserts the draw wins, in both
  // states, so this cannot be quietly "fixed" back into the trap. Making cycle reachable on a pad
  // needs a SECOND button, which is a controls call and Alex's; it is logged on GBOARD.
  'item.cycle':     { keys: ['KeyQ'],                      pad: ['Y'] },
  'ui.craft':       { keys: ['KeyC'],                      pad: ['DLEFT'] },
  'ui.build':       { keys: ['Tab'],                       pad: ['DRIGHT'] },
  'ui.map':         { keys: ['KeyM'],                      pad: ['SELECT'] },
  'ui.inventory':   { keys: ['KeyI'],                      pad: ['DUP'] },
  'ui.chat':        { keys: ['KeyT', 'Enter'],             pad: [] },
  'ui.close':       { keys: ['Escape'],                    pad: ['B'] },
  'ui.settings':    { keys: ['KeyO'],                      pad: ['START'] },
  'build.rotate':   { keys: ['KeyR'],                      pad: ['LB'] },
  // ⚠ THESE TWO KEYS USED TO BE 'build.tierUp'/'build.tierDown' AND THEY DID NOTHING. Tool tier
  // came off the equipped tool from 2026-08-08 on, but the bindings stayed — so the settings panel
  // offered "Next tier"/"Previous tier" rows a player could rebind, and rebinding them configured
  // air. They now walk the MATERIAL axis of the build palette, which is the second half of a
  // catalogue that had 84 unreachable variants in it. Same keys, so nobody's hands move; `merge`
  // drops the retired ids from a stored map, so a player who rebound the dead ones lands on these
  // defaults rather than on an unbound verb.
  'build.materialNext': { keys: ['BracketRight'],          pad: ['RB'] },
  'build.materialPrev': { keys: ['BracketLeft'],           pad: [] },
  // ── ★ THE CAST BAR, AND BOTH KEYS ARE DERIVED RATHER THAN CHOSEN ────────────────────────────
  // Alex ruled the castable set is exactly Tactical + Signature (2026-08-23; `moves.md:85` makes
  // Signature the Ultimate band, passives are not cast, combos are pair-casting). This layer is
  // consumed ONLY by voxel3d — VoxelWorld, BindingsPanel and tutorial.ts are its three importers —
  // so the keys come off THAT world's own list rather than being picked fresh:
  // `CAST_KEYS = ['g','z','x','b']` against `['passive','tactical','tactical','ultimate']`, so the
  // tactical was always Z and the ultimate was always B. Both surviving slots keep the key they
  // already had, which is the difference between a collapse and a silent remap of someone's hands.
  // ⚠ Not `c`: that is play3d's list, and `KeyC` is `ui.craft` in the fold. The two worlds
  // disagreeing here is deliberate and documented, not drift.
  'cast.tactical':  { keys: ['KeyZ'],                      pad: ['LB'] },
  // ── ★ ALEX'S CONTROLLER RULING, 2026-08-28 ──────────────────────────────────────────────────
  // *"RB should be hold to charge the shield .. the signature on controller can be lb+rb .. on
  // keyboard we can just give it its own hotkey."* All three land here:
  //   · `cast.focus` moves LB -> RB. The MECHANIC already existed — VoxelWorld reads this action
  //     as HELD and drains mana into the shield for as long as it is down — so this is a rebind,
  //     not new physics. It also un-stacks LB, which was carrying three actions.
  //   · `cast.signature` gets the chord. See `padChord` above for why RB is the modifier.
  //   · the keyboard hotkey was already its own: `KeyB`, and it is the only user of that code.
  'cast.focus':     { keys: ['KeyR'],                      pad: ['RB'] },
  'cast.signature': { keys: ['KeyB'],                      pad: [], padChord: ['RB', 'LB'] },
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
  'build.rotate': 'Rotate piece',
  'build.materialNext': 'Next material', 'build.materialPrev': 'Previous material',
  'cast.tactical': 'Cast tactical', 'cast.signature': 'Cast signature', 'cast.focus': 'Focus (raise shield)',
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
  { title: 'Building', actions: ['ui.build', 'build.rotate', 'build.materialNext', 'build.materialPrev'] },
  { title: 'Casting',  actions: ['cast.tactical', 'cast.signature', 'cast.focus'] },
  { title: 'Menus',    actions: ['ui.craft', 'ui.map', 'ui.inventory', 'ui.chat', 'ui.close', 'ui.settings'] },
  { title: 'Keeper',   actions: ['owner.fly'] },
] as const

export const ALL_ACTIONS = Object.keys(DEFAULTS) as ActionId[]
