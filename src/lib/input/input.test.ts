// ── The input layer's oracle ──────────────────────────────────────────────────────────────────
// Run: npx tsx src/lib/input/input.test.ts

import { DEFAULTS, ALL_ACTIONS, LABEL, PAD, HELD, OWNER_ONLY, STICK_DRIVEN, GROUPS, type ActionId } from './actions'
import { merge, rebind, conflicts, orphans, padGaps, resetAll, BINDINGS_KEY, type BindingMap } from './bindings'
import { deadzone, kindOf } from './gamepad'
import { hintFor, hintsFor, keyName, padName } from './hints'
import { matches, actionsFor, heldActions, padPressed, stickMove, chordOf } from './resolve'
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
  // ⚠ BOTH SHIFTS. `VoxelWorld` read `k.ShiftLeft || k.ShiftRight` directly until 2026-08-28; when
  // that moved behind the bindings, a ShiftLeft-only default would have silently retired the right
  // shift for anyone who slides with it. Pinned here so the second key cannot be tidied away.
  ['move.slide', 'ShiftRight'],
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

// ── ★ LB CARRIES BOTH ROTATE AND CAST TACTICAL, AND THAT IS THE RULING ────────────────────────
// Alex, 2026-08-23: "LB's build.rotate context-shares with build mode — a mode the player can SEE,
// which is the only kind that is safe to overload." Asserted here for the same reason the KeyQ
// overlap above is: an unexplained entry in a conflict report is something a future reader deletes.
ok(conflicts(base).some(x => x.input === 'LB' && x.actions.includes('build.rotate') && x.actions.includes('cast.tactical')),
   'the intentional LB rotate/cast overlap stopped being reported')

// ── ★★★ THE SIGNATURE GAP CLOSED, AND THE EXPIRING EXEMPTION IS WHY ──────────────────────────
// What stood here asserted the PREMISE of a gap rather than the gap: *"RB is still item.cycle"*,
// with a failure message telling the next person to finish the job. On 2026-08-28 it went red on
// its own, unprompted, the moment `item.cycle` left RB — and named the work. **That is the whole
// argument for writing an exemption so it expires**, and it is the only reason this section is
// being rewritten by someone who was not looking for it. The replacement asserts the RULING.
//
// Alex, 2026-08-28: *"RB should be hold to charge the shield .. the signature on controller can be
// lb+rb .. on keyboard we can just give it its own hotkey."*
ok(base['cast.focus'].pad.includes('RB') && !base['cast.focus'].pad.includes('LB'),
   'the shield charge is on RB — the ruling moved it off LB')
ok(!base['item.cycle'].pad.includes('RB'),
   'item.cycle is back on RB, which double-books the shield charge')
ok(base['item.cycle'].pad.includes('Y') && base['item.draw'].pad.includes('Y'),
   'cycle and draw share Y, resolved by the drawn state the same way KeyQ resolves drop/cycle')

// ── ★★ THE CHORD, AND THE ORDER INSIDE IT ────────────────────────────────────────────────────
// `[modifier, …, trigger]`. ⚠ The order is not cosmetic and reversing it produces a chord that can
// only fire AFTER the action it replaces: LB is an edge (the tactical fires the instant it goes
// down), RB is a hold (the shield charge has no edge to race). Assert the ORDER, not the set —
// a `.includes()` pair here would pass on the broken arrangement.
const chord = chordOf(base['cast.signature'])
ok(chord.length === 2 && chord[0] === 'RB' && chord[1] === 'LB',
   `the signature chord must be [RB, LB] — modifier first, trigger last (got ${chord.join('+') || 'none'})`)
ok(base['cast.signature'].keys.includes('KeyB'),
   'the keyboard signature keeps its own hotkey')
ok(ALL_ACTIONS.filter(id => base[id].keys.includes('KeyB')).length === 1,
   'KeyB drives more than one action — the signature no longer has its own hotkey')

// ── ★★★ THE CHORD SUPPRESSES ITS TRIGGER'S OWN ACTION, AND NOTHING ELSE ──────────────────────
// The bug this exists to catch is one press casting BOTH — the naive reason a chord on top of an
// edge-triggered binding does not work. ⚠ And the over-correction is just as real: suppressing the
// whole frame would make a chord silently eat an unrelated simultaneous press.
const padOf = (down: string[], pressed: string[]) =>
  ({ down: new Set(down), pressed: new Set(pressed), lx: 0, ly: 0, rx: 0, ry: 0 }) as never
{
  // RB already held, LB taps: signature fires, tactical is eaten.
  const both = padPressed(base, padOf(['RB', 'LB'], ['LB']))
  ok(both.has('cast.signature'), 'the chord did not fire with RB held and LB pressed')
  ok(!both.has('cast.tactical'), '★ ONE PRESS CAST BOTH — the chord did not suppress its trigger')

  // LB alone: the ordinary tactical, no chord, no latency.
  const solo = padPressed(base, padOf(['LB'], ['LB']))
  ok(solo.has('cast.tactical'), 'LB alone stopped casting the tactical')
  ok(!solo.has('cast.signature'), 'the signature fired without its modifier')

  // ⚠ REVERSED: LB held, RB taps. The chord must NOT fire — RB is the modifier, and firing here
  // would mean the signature goes off every time a keeper raises their shield mid-tactical.
  const rev = padPressed(base, padOf(['LB', 'RB'], ['RB']))
  ok(!rev.has('cast.signature'), 'the chord fired on the reversed order — the trigger is LB, not RB')

  // Both held, neither newly pressed: nothing re-fires. A chord is an edge, not a state.
  const held = padPressed(base, padOf(['RB', 'LB'], []))
  ok(!held.has('cast.signature'), 'the chord re-fired every frame both buttons were held')

  // ⚠ AND AN UNRELATED PRESS ON THE SAME FRAME SURVIVES — the over-correction check.
  const alongside = padPressed(base, padOf(['RB', 'LB', 'A'], ['LB', 'A']))
  ok(alongside.has('cast.signature') && alongside.has('move.jump'),
     'the chord ate an unrelated simultaneous press')
}

// ── ⚠ A STORED MAP FROM BEFORE CHORDS EXISTED MUST STILL GET THE CHORD ───────────────────────
// Every returning keeper has a BindingMap in localStorage with `keys` and `pad` and no `padChord`.
// `merge` accepts it — so without a default fallback the signature is unreachable on a pad for
// exactly the players who have played before, silently, with the source looking correct.
{
  const legacy = merge({ 'cast.signature': { keys: ['KeyB'], pad: [] } } as never)
  ok(chordOf(legacy['cast.signature']).join('+') === 'RB+LB',
     '★ a pre-chord stored binding lost the chord — returning players cannot cast the signature')
  // But a player who deliberately CLEARED it keeps it cleared. `Array.isArray` is what tells the
  // two apart, which is why merge reads the field rather than testing it for truthiness.
  const cleared = merge({ 'cast.signature': { keys: ['KeyB'], pad: [], padChord: [] } } as never)
  ok(chordOf(cleared['cast.signature']).length === 0, 'a deliberately cleared chord was resurrected')
}

// ── ★★ THE HINT CAN SEE A CHORD ──────────────────────────────────────────────────────────────
// `hintFor` returns null when an action has no binding on the device, and callers OMIT a null
// hint. Before the chord was rendered, the signature answered null on a pad — so the one screen
// whose job is to say what a button does told a controller player the signature has none.
ok(hintFor(base, 'cast.signature', 'pad') !== null,
   '★ the signature reads as unbound on a controller — a chord is a binding')
ok(hintFor(base, 'cast.signature', 'pad', 'xbox') === 'RB + LB',
   `the chord hint must read in performance order, modifier first (got ${hintFor(base, 'cast.signature', 'pad', 'xbox')})`)
ok(hintFor(base, 'ui.chat', 'pad') === null,
   'a genuinely unbound action stopped answering null — every hint would now print something')

// ── ★★★ THE CONSUMER ACTUALLY READS THE EDGE HALF ────────────────────────────────────────────
// **This is the assert that would have caught the bug that started all of this, and it did not
// exist.** `padPressed` shipped with the input layer, was unit-tested here, and was imported by
// NOTHING in the app for weeks. Every assert in this file was green over a world where a
// controller could move, look and charge a shield and do nothing else — because a resolver is
// only a claim about what the game COULD read, and this file tested the resolver.
//
// ⚠ Same family as the 08-22 bridge and the break-fx wiring guard: a module and its consumer,
// each internally consistent about different things. Asking `does padPressed behave correctly`
// cannot see `does anyone call it`.
{
  const world = readFileSync(join(process.cwd(), 'src/app/shimmer/voxel3d/VoxelWorld.tsx'), 'utf8')
  ok(world.length > 10_000, `VoxelWorld.tsx read (${world.length} bytes)`)
  // ⚠ THE IMPORT IS NOT ENOUGH — an unused import type-checks and lints away to nothing. The
  // CALL is the claim. Both, because they fail differently: no import is a build error someone
  // notices, an import with no call is exactly the silence this catches.
  ok(/import \{[^}]*\bpadPressed\b[^}]*\} from '@\/lib\/input\/resolve'/.test(world),
     'VoxelWorld does not import padPressed — the pad has no edge path into the world')
  ok(/padPressed\(bindings\.current, pad\.current\)/.test(world),
     '★ padPressed is imported but never called — every edge-triggered pad action is dead')
  // And the casts specifically reach it, which is the verb Alex asked about.
  ok(/padNow\.has\(CAST_ACTIONS\[i\]\)/.test(world),
     'the cast bar is not driven from the pad edge set')
  // ⚠ The triggers must mirror the mouse at its SOURCE, not OR into its read sites: those
  // booleans are latched and CONSUMABLE (twenty-odd `= false` writes meaning "I handled this"),
  // so a per-frame re-arm turns one trigger pull into a firehose.
  ok(/padMinePrev\.current = padMine; mouse\.current\.left = padMine/.test(world),
     'world.mine no longer mirrors the mouse button on the trigger EDGE')
  ok(!/mouse\.current\.left \|\| heldNow\.has\('world\.mine'\)/.test(world),
     'the trigger was OR-ed into a read site — that re-arms a consumed click every frame')
}

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
// ⚠ DERIVED, NOT NAMED. This assert used the literal `'KeyZ'`, which was unbound on the day it was
// written and stopped being unbound the day the cast bar moved onto this layer — so a CORRECT
// change to actions.ts turned a good assert red for a reason that had nothing to do with what it
// tests. A fixture that names a specific free resource is a standing claim about the whole binding
// table, and nothing keeps it true. Ask the table instead.
const BOUND_KEYS = new Set(ALL_ACTIONS.flatMap((id) => base[id].keys))
const spare = ['KeyJ', 'KeyK', 'KeyL', 'KeyN', 'KeyP', 'KeyU', 'KeyY', 'KeyH', 'KeyZ', 'KeyX']
  .find((k) => !BOUND_KEYS.has(k))
// ★ and the premise is asserted rather than assumed: if every candidate ever gets bound, this must
// go RED and be given a new one, not quietly skip and report coverage it no longer has.
ok(spare !== undefined, 'fixture: no unbound key left to test actionsFor against — add one')
ok(actionsFor(base, spare ?? '').length === 0, 'actionsFor invented an action for an unbound key')

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
