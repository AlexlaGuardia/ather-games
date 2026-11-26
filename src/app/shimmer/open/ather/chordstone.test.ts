// BETA M188 s2: the Chordstone's pure half (chordstone.ts). Run: npx tsx src/app/shimmer/open/ather/chordstone.test.ts
import { chordLights, lightSpot, CHORDSTONE, CHORDSTONE_OFF, MAX_LIGHTS, clusterSeats, CLUSTER_SEATS } from './chordstone'
import { chordColour } from '../shared/chord'
import { GATE, THRESHOLD } from './plot'
import type { LobbyMember } from '@/lib/party-lobby'
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const mem = (look: string, name = look): LobbyMember => ({ id: `u_${look}`, name, zone: 'open:ather', ready: false, trusted: false, look })

// placement: beside the gate, off its face (not between the gate and the start ground)
const d = Math.hypot(CHORDSTONE.x - GATE.x, CHORDSTONE.z - GATE.z)
ok(Math.abs(d - CHORDSTONE_OFF) < 1e-9, `stands ${CHORDSTONE_OFF} m from the gate's centre (${d.toFixed(3)})`)
const face = { x: THRESHOLD.x - GATE.x, z: THRESHOLD.z - GATE.z }, side = { x: CHORDSTONE.x - GATE.x, z: CHORDSTONE.z - GATE.z }
ok(Math.abs(face.x * side.x + face.z * side.z) / Math.hypot(face.x, face.z) < 1e-6, 'off to the SIDE of the gate (square to the way the gate faces)')

// lights
ok(chordLights([mem('me'), mem('b')], 'me', false).length === 0, 'not in a chord: a dark stone')
const two = chordLights([mem('b', 'Bo'), mem('me', 'Ana')], 'me', true)
ok(two.length === 2 && two[0].id === 'me' && two[0].me && two[1].id === 'b' && !two[1].me, 'me first, then the others in ring-in order')
ok(two[0].colour === chordColour('me') && two[1].colour === chordColour('b'), 'each light is that keeper\'s own chord colour (the bars\' and the tab\'s)')
ok(two[1].name === 'Bo', 'a light carries the keeper\'s name')
ok(chordLights([mem('me')], 'me', true).length === 1, 'alone in a chord: one light, mine')
ok(chordLights([mem('b'), mem('b'), mem(''), mem('me')], 'me', true).length === 2, 'a doubled row or an id-less row is one light / none')
ok(chordLights('abcdefghij'.split('').map(x => mem(x)), 'me', true).length === MAX_LIGHTS, `at most ${MAX_LIGHTS} lights`)
ok(chordLights([mem('b')], 'me', true)[0].me === false, 'my socket not in the roster yet: the others still burn')

// spots: one = centre; several = distinct, on the top (within the stone's radius)
ok(lightSpot(0, 1).x === 0 && lightSpot(0, 1).z === 0, 'one light sits in the centre')
const s = Array.from({ length: 6 }, (_, k) => lightSpot(k, 6))
ok(s.every((p, i) => s.every((q, j) => i === j || Math.hypot(p.x - q.x, p.z - q.z) > 0.2)), 'six lights never overlap')
ok(s.every(p => Math.hypot(p.x, p.z) < 0.5), 'every light is on the top')

// M188 s3: the cluster card's four seats
{
  const v = (members: [string, string][], offers: [string, string, string[]][] = []) => ({ cluster_id: 'c', folded_by: 'x', name: null,
    members: members.map(([id, n], i) => ({ user_id: id, username: n, quarter: (['ne', 'nw', 'sw', 'se'] as const)[i], seed: 0, tier: 0 })),
    offers: offers.map(([q, id, c]) => ({ quarter: q as 'nw', invitee_id: id, invitee: id.toUpperCase(), consented: c })) })
  const none = clusterSeats(null, 'a')
  ok(none.length === CLUSTER_SEATS && none.every(x => x.kind === 'open'), 'no cluster: four open seats')
  const s2 = clusterSeats(v([['b', 'Bo'], ['a', 'Ana']], [['sw', 'c', ['b']]]), 'a')
  ok(s2[0].kind === 'member' && s2[0].me && s2[0].name === 'Ana' && s2[1].kind === 'member' && s2[1].name === 'Bo', 'me first, then the others')
  ok(s2[2].kind === 'asked' && s2[2].waiting === 1 && !s2[2].youSaidYes && s2[3].kind === 'open', 'an asked friend: one yes still to come (mine), then an open seat')
  const full = clusterSeats(v([['a', 'A'], ['b', 'B'], ['c', 'C'], ['d', 'D']]), 'a')
  ok(full.length === 4 && full.every(x => x.kind === 'member'), 'four keepers fill the card: never a fifth seat')
}

console.log(fails ? `\n${fails} FAILED` : '\nall ok'); process.exit(fails ? 1 : 0)
