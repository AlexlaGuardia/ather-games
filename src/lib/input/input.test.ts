// ── The input layer's oracle ──────────────────────────────────────────────────────────────────
// Run: npx tsx src/lib/input/input.test.ts

import { DEFAULTS, ALL_ACTIONS, LABEL, PAD, HELD, OWNER_ONLY, STICK_DRIVEN, GROUPS, type ActionId } from './actions'
import { merge, rebind, conflicts, orphans, padGaps, resetAll, BINDINGS_KEY, type BindingMap } from './bindings'
import { deadzone, kindOf } from './gamepad'
import { hintFor, hintsFor, keyName, padName } from './hints'
import { matches, actionsFor, heldActions, padPressed, stickMove } from './resolve'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { c ? pass++ : fails.push(m) }

// ── 1. the vocabulary is ONE list, not several that can drift apart ────────────────────────────
ok(ALL_ACTIONS.length > 0, 'BLIND: no actions registered at all')
for (const id of ALL_ACTIONS) {
  ok(!!LABEL[id], `${id} has no player-facing LABEL — it would appear blank in the rebinding menu`)
}
for (const id of Object.keys(LABEL) as ActionId[]) {
  ok(ALL_ACTIONS.includes(id), `LABEL names "${id}", which is not a registered action — a stale second list`)
}
for (const id of [...HELD, ...OWNER_ONLY]) {
  ok(ALL_ACTIONS.includes(id), `HELD/OWNER_ONLY names "${id}", which is not a registered action`)
}

// ── 1b. the menu's grouping cannot silently drop a row ─────────────────────────────────────────
// A hand-kept grouping omits quietly: the player never sees the row, and nobody reports a menu
// entry they do not know exists.
const grouped = GROUPS.flatMap(g => g.actions)
for (const id of ALL_ACTIONS) {
  ok(grouped.filter(x => x === id).length === 1,
     `${id} appears ${grouped.filter(x => x === id).length} times across GROUPS — must be exactly once, or the menu drops or duplicates it`)
}
for (const id of grouped) ok(ALL_ACTIONS.includes(id), `GROUPS names "${id}", which is not a registered action`)

// ── 2. THE SHIPPED KEYBOARD CONTROLS ARE PINNED ────────────────────────────────────────────────
// ⚠ These are in players' hands TODAY, read off VoxelWorld.tsx. A change here is a silent remap of
// somebody's muscle memory, so it must be a deliberate edit to this list and not a side effect.
const SHIPPED: [ActionId, string][] = [
  ['move.forward', 'KeyW'], ['move.back', 'KeyS'], ['move.left', 'KeyA'], ['move.right', 'KeyD'],
  ['move.jump', 'Space'], ['move.slide', 'ShiftLeft'],
  ['world.interact', 'KeyE'], ['item.draw', 'KeyF'], ['item.drop', 'KeyQ'],
  ['ui.craft', 'KeyC'], ['ui.build', 'Tab'], ['ui.map', 'KeyM'], ['ui.inventory', 'KeyI'],
  ['ui.chat', 'KeyT'], ['ui.close', 'Escape'], ['build.rotate', 'KeyR'], ['owner.fly', 'KeyV'],
  ['ui.settings', 'KeyO'],
]
for (const [id, code] of SHIPPED) {
  ok(DEFAULTS[id].keys.includes(code), `${id} no longer defaults to ${code} — that is a remap of the shipped controls`)
}

// ── 3. nothing is unreachable ──────────────────────────────────────────────────────────────────
ok(orphans(resetAll()).length === 0, `default bindings orphan: ${orphans(resetAll()).join(', ')} — a verb the menu shows and nobody can perform`)

// ── 4. ★ A STORED MAP FROM AN OLDER BUILD MUST NOT ORPHAN A NEW ACTION ─────────────────────────
// The reason `merge` folds stored OVER defaults instead of trusting stored. A player who set their
// controls, then updated into a build with a new verb, must get that verb bound — not dead.
const ancient = { 'move.jump': { keys: ['Space'], pad: [] } } as unknown as Partial<BindingMap>
const merged = merge(ancient)
ok(orphans(merged).length === 0, `a stored map missing new actions orphaned: ${orphans(merged).join(', ')}`)
ok(merged['item.draw'].keys.includes('KeyF'), 'an action absent from stored data did not fall back to its default')
ok(merged['move.jump'].keys.includes('Space'), 'the stored choice was discarded by the merge')

// ── 5. junk in storage yields playable controls, never a dead input layer ──────────────────────
for (const junk of [null, {}, { 'item.draw': null }, { 'item.draw': { keys: 'KeyF' } }, { 'zz.gone': { keys: ['KeyZ'], pad: [] } }]) {
  const m = merge(junk as Partial<BindingMap>)
  ok(orphans(m).length === 0, `junk stored value ${JSON.stringify(junk)} produced orphans`)
  ok(!('zz.gone' in m), 'an unknown action id survived the merge — it could conflict with a live binding forever')
}

// ── 6. rebinding is pure, and a preview cannot half-apply ──────────────────────────────────────
const base = resetAll()
const changed = rebind(base, 'item.draw', 'key', ['KeyG'])
ok(base['item.draw'].keys.includes('KeyF'), 'rebind MUTATED the original map — a cancelled preview would already have applied')
ok(changed['item.draw'].keys.includes('KeyG'), 'rebind did not take')
// ⚠ `item.draw` is NOT the right subject here — it also carries a pad binding, so clearing its keys
// leaves it perfectly reachable. `orphans` requires BOTH devices empty and it was right; the first
// version of this assert was wrong and would have demanded a false positive.
ok(!orphans(rebind(base, 'item.draw', 'key', [])).includes('item.draw'),
   'clearing the keys of an action that still has a pad binding must NOT count as orphaned')
ok(orphans(rebind(base, 'owner.fly', 'key', [])).includes('owner.fly'),
   'unbinding the last input of a keyboard-only action was not reported as an orphan')

// ── 7. conflicts are REPORTED, not refused ─────────────────────────────────────────────────────
// KeyQ genuinely carries drop + cycle, resolved by whether the weapon is drawn. A validator that
// refused this would break the shipped controls.
const c = conflicts(base)
ok(c.some(x => x.input === 'KeyQ' && x.actions.includes('item.drop') && x.actions.includes('item.cycle')),
   'the real KeyQ drop/cycle overlap was not reported')
const clash = rebind(base, 'ui.map', 'key', ['KeyC'])
ok(conflicts(clash).some(x => x.input === 'KeyC' && x.actions.length === 2), 'a newly created clash was not detected')

// ── 8. controller coverage is visible, not silently absent ─────────────────────────────────────
const gaps = padGaps(base)
ok(gaps.length > 0 && gaps.every(id => ALL_ACTIONS.includes(id)), 'padGaps returned nonsense')
ok(!gaps.includes('world.mine') && !gaps.includes('move.jump'), 'a core verb has no controller binding')
// ⚠ the movement verbs are covered by the LEFT STICK. Counting them as gaps reported 8 when 4 were
// real and buried the true ones — a worklist with false entries is one people stop reading.
for (const id of STICK_DRIVEN) {
  ok(!gaps.includes(id), `${id} is stick-driven and must not appear in the controller worklist`)
}

// ── 9. deadzone is RADIAL ──────────────────────────────────────────────────────────────────────
// Per-axis deadzoning leaves a cross-shaped live area, so a light diagonal reads as pure horizontal.
ok(deadzone(0, 0)[0] === 0 && deadzone(0.1, 0.1)[0] === 0, 'inside the deadzone did not read as centred')
const [dx, dy] = deadzone(0.5, 0.5)
ok(Math.abs(dx - dy) < 1e-9 && dx > 0, 'a diagonal push did not survive the deadzone symmetrically')
const [ex, ey] = deadzone(0.2, 0.05)
ok(!(ex !== 0 && ey === 0), '⚠ CROSS-SHAPED DEADZONE: a light diagonal collapsed to one axis')
ok(Math.hypot(...deadzone(1, 0)) <= 1.0000001, 'full deflection exceeded 1 after rescaling')

// ── 10. ★ THE FACE BUTTONS ARE NAMED FOR THE PAD IN THE PLAYER'S HANDS ─────────────────────────
ok(padName('A', 'xbox') === 'A' && padName('A', 'playstation') === '✕',
   'index 0 is Xbox A and PlayStation Cross — printing the wrong family names a real but wrong button')
ok(padName('X', 'xbox') === 'X' && padName('X', 'playstation') === '□',
   'index 2 is Xbox X and PlayStation Square — the worst confusion, they are not even in the same position')
ok(padName('RT', 'playstation') === 'R2' && padName('LB', 'playstation') === 'L1', 'shoulder names not translated')
ok(!!padName('DUP', 'generic'), 'an unnamed button on a generic pad must still print something')
ok(kindOf('Xbox Wireless Controller') === 'xbox', 'xbox pad not recognised')
ok(kindOf('054c-0ce6-DualSense Wireless Controller') === 'playstation', 'DualSense not recognised')
ok(kindOf('Some Unknown Pad') === 'generic', 'unknown pad should be generic, not misidentified')

// ── 11. hints are RESOLVED, never typed ────────────────────────────────────────────────────────
ok(keyName('KeyF') === 'F' && keyName('Space') === 'Space' && keyName('ShiftLeft') === 'Shift', 'key naming wrong')
ok(hintFor(base, 'item.draw', 'key') === 'F', 'keyboard hint did not resolve')
ok(hintFor(rebind(base, 'item.draw', 'key', ['KeyG']), 'item.draw', 'key') === 'G',
   '★ a rebound key did not change its hint — that is the stale-hint bug this layer exists to prevent')
ok(hintFor(base, 'ui.chat', 'pad') === null, 'an action with no pad binding must return null, not an empty hint')
ok(hintFor(base, 'move.jump', 'pad', 'playstation') === '✕', 'pad hint ignored the controller family')
const hs = hintsFor(base, ['move.jump', 'ui.chat', 'world.mine'], 'pad', 'xbox')
ok(hs.length === 2 && !hs.some(h => h.id === 'ui.chat'), 'hintsFor did not drop the action this device cannot perform')
ok(hs.every(h => h.label && h.input), 'a hint came back without a label or an input')

// ── 12. the storage key is registered as DEVICE state ──────────────────────────────────────────
// ⚠ Controls belong to the hardware, not the character — two accounts on one desktop want the same
// keys. `keeper-local.test.ts` fails any shimmer key classifying as neither keeper nor device, so
// this assert is what keeps that decision from being quietly reversed.
const keeperTest = readFileSync(join(process.cwd(), 'src/lib/keeper-local.test.ts'), 'utf8')
ok(keeperTest.includes(BINDINGS_KEY),
   `${BINDINGS_KEY} is not listed in keeper-local.test.ts DEVICE_KEYS — register it or the key guard will call it unclassified`)

// ── 13. the bridge the game will call ─────────────────────────────────────────────────────────
ok(matches(base, 'KeyF', 'item.draw'), 'matches() missed a shipped binding')
ok(!matches(base, 'KeyG', 'item.draw'), 'matches() accepted a key that is not bound')
ok(matches(rebind(base, 'item.draw', 'key', ['KeyG']), 'KeyG', 'item.draw'), 'matches() ignored a rebind')

// KeyQ drives BOTH drop and cycle — the caller disambiguates by whether the weapon is drawn, so
// this must hand back both rather than invent a winner.
const q = actionsFor(base, 'KeyQ')
ok(q.includes('item.drop') && q.includes('item.cycle'), 'actionsFor collapsed the real KeyQ ambiguity')
ok(actionsFor(base, 'KeyZ').length === 0, 'actionsFor invented an action for an unbound key')

// ★ THE DEVICES UNION — a pad in hand must not switch the keyboard off.
const padSample = { down: new Set(['A'] as never[]), pressed: new Set(['A'] as never[]), lx: 0, ly: 0, rx: 0, ry: 0, kind: 'xbox' as const }
const held = heldActions(base, ['KeyW'], padSample as never)
ok(held.has('move.forward'), 'keyboard input was lost while a pad was connected')
ok(held.has('move.jump'), 'pad input was not read')
ok(heldActions(base, [], null).size === 0, 'actions were held with no input at all')
ok(padPressed(base, padSample as never).has('move.jump'), 'pad edge not surfaced')
ok(padPressed(base, null).size === 0, 'padPressed invented edges with no pad')

// ★ THE STICK IS ANALOG AND ITS Y IS NEGATED AT THE BOUNDARY.
ok(stickMove(null).forward === 0, 'no pad should mean no stick wish')
const fwd = stickMove({ ...padSample, ly: -1 } as never)
ok(fwd.forward === 1, '⚠ stick Y not negated — the API reports UP as negative, so the player would walk backwards')
const half = stickMove({ ...padSample, ly: -0.5 } as never)
ok(half.forward === 0.5, '⚠ stick collapsed to a boolean — that throws away walk-vs-run and makes a pad worse than four keys')

// ── report ─────────────────────────────────────────────────────────────────────────────────────
console.log(`\ninput layer — ${ALL_ACTIONS.length} actions · ${Object.keys(PAD).length} pad buttons · ${padGaps(base).length} without a controller binding`)
if (fails.length) { console.log(`\n❌ ${pass} passed, ${fails.length} FAILED\n`); fails.forEach(f => console.log('  · ' + f)); process.exit(1) }
console.log(`✅ ${pass} asserts passed\n`)
