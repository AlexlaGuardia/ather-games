// Key rebinding, by numbers. Run: npx tsx src/app/shimmer/open/shared/keymap.test.ts
import { bind, translate, keyFor, actionOf, ACTIONS, RESERVED, keyName, type Keymap } from './keymap'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const none: Keymap = { v: 1, bound: {} }
// untouched map: every key is itself
ok(ACTIONS.every(a => translate(none, a.code) === a.code) && translate(none, 'KeyQ') === 'KeyQ', 'an empty map changed a key')
// move jump to F: F jumps, and get-in (F's old job) swaps onto Space; Space now gets you in
const j = bind(none, 'Space', 'KeyF')
ok(keyFor(j, 'Space') === 'KeyF' && translate(j, 'KeyF') === 'Space', 'F did not become jump')
ok(keyFor(j, 'KeyF') === 'Space' && translate(j, 'Space') === 'KeyF', 'the swap did not put get-in on Space')
// move use (E) to a free key Q: Q uses, E now does nothing (swallowed, not its old job)
const q = bind(none, 'KeyE', 'KeyQ')
ok(translate(q, 'KeyQ') === 'KeyE' && translate(q, 'KeyE') === null, `E was not silenced after moving use to Q (E → ${translate(q, 'KeyE')})`)
// moving it back to E clears the rebind entirely
ok(Object.keys(bind(q, 'KeyE', 'KeyE').bound).length === 0, 'binding a key back to its default left a record')
// reserved keys cannot be bound
ok([...RESERVED].every(r => bind(none, 'KeyE', r) === none), 'a reserved key (Esc, Tab, arrows) was bindable')
// an unknown action is refused
ok(bind(none, 'KeyZ', 'KeyQ') === none, 'an unknown action was bound')
// every physical key drives at most one action, after any sequence of binds
{
  let k = none; const keys = ['KeyQ', 'KeyF', 'Space', 'KeyE', 'KeyX', 'KeyW', 'KeyI', 'ShiftLeft']
  for (let i = 0; i < 60; i++) k = bind(k, ACTIONS[(i * 7) % ACTIONS.length].code, keys[(i * 5) % keys.length])
  const phys = ACTIONS.map(a => keyFor(k, a.code))
  ok(new Set(phys).size === phys.length, `two actions share a key after a run of rebinds: ${phys.join(',')}`)
  ok(ACTIONS.every(a => actionOf(k, keyFor(k, a.code)) === a.code), 'actionOf and keyFor disagree')
}
ok(keyName('KeyF') === 'F' && keyName('ShiftLeft') === 'L Shift' && keyName('Space') === 'Space', 'key names read wrong')
console.log(`keymap: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
