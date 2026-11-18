// shared/sight-looks.ts: a keeper's per-gun sight cut (canon: look, never power). Malformed saves never reach the lens; re-cutting one
// gun leaves the others; a gun never re-cut shows the plain default for its kind of sight.
//   npx tsx src/app/shimmer/open/shared/sight-looks.test.ts
import { parseLooks, lookFor, withLook } from './sight-looks'
import { defaultLook } from './sight-marks'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('✗', m) } }

ok(JSON.stringify(parseLooks(null)) === '{}' && JSON.stringify(parseLooks('nope{')) === '{}' && JSON.stringify(parseLooks('[1]')) === '{}', 'no save, a broken save or an array: nothing re-cut, no throw')
const mixed = parseLooks(JSON.stringify({ repeater: { mark: 'ring', tint: 'mana' }, roar: { mark: 'laser', tint: 'mana' }, lance: { mark: 'cross', tint: 'neon' }, spitter: 7, backbone: { mark: 'chevron', tint: 'gold', dmg: 99 } }))
ok(mixed.repeater?.mark === 'ring' && mixed.repeater.tint === 'mana', 'a good look survives')
ok(!mixed.roar && !mixed.lance && !mixed.spitter, 'an unknown cut, an unknown tint or a non-look is dropped')
ok(JSON.stringify(mixed.backbone) === JSON.stringify({ mark: 'chevron', tint: 'gold' }), 'stray fields are stripped: a look carries ONLY its cut and tint (never a number that fires)')

ok(JSON.stringify(lookFor({}, 'lance', true)) === JSON.stringify(defaultLook(true)), 'never re-cut, scoped: the plain scope default')
ok(JSON.stringify(lookFor({}, 'roar', false)) === JSON.stringify(defaultLook(false)), 'never re-cut, 1x: the plain sight default')
ok(lookFor(mixed, 'repeater', false).mark === 'ring', "a re-cut gun shows its owner's cut")

const a = withLook(mixed, 'roar', { mark: 'dot', tint: 'leaf' })
ok(a.roar?.tint === 'leaf' && a.repeater?.mark === 'ring', 're-cutting one gun leaves the others')
ok(!mixed.roar, 're-cutting returns a new record (the old one is untouched)')
ok(JSON.stringify(withLook({}, 'roar', { mark: 'dot', tint: 'leaf', dmg: 5 } as never).roar) === JSON.stringify({ mark: 'dot', tint: 'leaf' }), 'a write keeps only cut + tint')

console.log(`sight-looks: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
