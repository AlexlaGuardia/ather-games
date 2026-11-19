// node test: npx tsx src/app/shimmer/open/shared/held-gun.test.ts (BETA M27 slice 4)
import { heldDue, newHeldSend, decodeHeld, HELD_KEEPALIVE } from './held-gun'
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const s = newHeldSend()
ok(!heldDue(s, 'repeater', [], 0), 'alone: says nothing')
ok(heldDue(s, 'repeater', ['p_b'], 1), 'a peer appears: says it at once (a joiner sees my gun)')
ok(!heldDue(s, 'repeater', ['p_b'], 2) && !heldDue(s, 'repeater', ['p_b'], 5), 'nothing changed: quiet (no per-frame chatter)')
ok(heldDue(s, 'charred-rifle', ['p_b'], 6), 'a swap: says it')
ok(heldDue(s, null, ['p_b'], 7), 'stowed: says hands empty')
ok(heldDue(s, null, ['p_b', 'p_c'], 8), 'a NEW peer: says it again for them')
ok(!heldDue(s, null, ['p_b', 'p_c'], 8 + HELD_KEEPALIVE - 0.5), 'quiet until the keepalive')
ok(heldDue(s, null, ['p_b', 'p_c'], 8 + HELD_KEEPALIVE + 0.1), `the ${HELD_KEEPALIVE} s keepalive heals a lost message`)
ok(!heldDue(s, null, ['p_c'], 8 + HELD_KEEPALIVE + 1), 'someone LEFT (no newcomer), inside the keepalive: quiet')
ok(decodeHeld({ g: 'repeater' }) === 'repeater' && decodeHeld({ g: null }) === null, 'reads a gun id, and empty hands')
ok(decodeHeld({ g: '<img>' }) === undefined && decodeHeld({ g: 5 }) === undefined && decodeHeld('x') === undefined, 'junk is refused (never null: junk must not clear a gun)')
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
