// node test: npx tsx src/app/shimmer/open/ather/guest-wilds.test.ts (BETA M156 s2)
import { encodeLedger, decodeLedger, guestInfection, guestMap, quietFor, MAX_LOST, RELAY_MAX, type HostLedger } from './guest-wilds'
import { pickHost } from '../shared/party-host'
import { areaState, freshMap } from './spread-map'
import type { WildsNode } from './nodes'
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const ids = Array.from({ length: 963 }, (_, k) => `tile-${k % 40}:${k}`).sort()
const L: HostLedger = { clean: ids.filter((_, k) => k % 3 === 0), grey: ids.filter((_, k) => k % 7 === 1), season: 4, held: 's4-2', lost: ['s4-1', 's4-9'] }
const w = encodeLedger(ids, L), back = decodeLedger(ids, JSON.parse(JSON.stringify(w)))
ok(JSON.stringify(back) === JSON.stringify(L), 'the ledger survives the wire, whole')
const worst = encodeLedger(ids, { ...L, clean: ids, grey: ids, lost: Array.from({ length: 99 }, (_, k) => `s12-${100 + k}`) })
ok(JSON.stringify(worst).length < RELAY_MAX && worst.l.length === MAX_LOST, `the worst ledger fits a relay (${JSON.stringify(worst).length} of ${RELAY_MAX})`)
ok(decodeLedger(ids.slice(1), w) === null && decodeLedger(ids.map((k, i) => i === 5 ? 'other' : k).sort(), w) === null, "another build's nodes: refused")
for (const bad of [null, 3, {}, { ...w, c: 'AA' }, { ...w, g: '%%%' }, { ...w, l: 'x' }, { ...w, l: [1] }, { ...w, i: 5 }, { ...w, s: 'a' }]) ok(decodeLedger(ids, bad) === null, `junk refused: ${JSON.stringify(bad)?.slice(0, 30)}`)
const inf = guestInfection(L, 4)
ok(inf.active?.id === 's4-2' && inf.lost.length === 2 && inf.told === 0 && inf.assigned === 0 && inf.active.clue === 0, "held + lost are the host's, no clue travels")
ok(guestInfection(L, 5).active === null && !guestInfection(L, 5).lost.length, "another season's infection is not drawn")
const own = { ...freshMap(), seen: { a: 5, b: 6 }, grey: { b: 9 } }, frozen = JSON.stringify(own)
const m = guestMap(own, { ...L, grey: ['a'] }, ['c'])
ok(areaState(m, 'a', true) === 'hollow' && areaState(m, 'b', true) === 'charted' && areaState(m, 'c', false) === 'clear' && areaState(m, 'd', true) === 'unseen', "host's grey over the guest's own charting")
ok(JSON.stringify(own) === frozen, "the guest's own map is not touched")
const N = (id: string) => ({ id }) as WildsNode
ok(quietFor([N('x'), N('y')], new Set(['y'])).map(n => !!n.quiet).join() === 'false,true', 'a champion rises for a guest only where their own ground is grey too')
// who hosts
const all = ['p_z', 'p_m', 'p_a']   // p_z started the party
for (const me of all) ok(pickHost(me, all.filter(k => k !== me), all, null) === 'p_z', `${me}: the starter hosts, not the lowest id`)
ok(pickHost('p_a', ['p_m'], all, null) === 'p_m' && pickHost('p_m', ['p_a'], all, null) === 'p_m', 'the starter elsewhere: the next in line who is here, both agree')
ok(pickHost('p_q', ['p_z', 'p_m'], [], 'p_z') === 'p_z', 'no seat: whoever sends as host')
ok(pickHost('p_q', ['p_r'], [], 'p_z') === 'p_q' && pickHost('p_q', ['p_c'], [], null) === 'p_c', 'nobody known: the lowest id')
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
