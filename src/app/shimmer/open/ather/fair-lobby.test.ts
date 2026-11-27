// BETA M233 s4: the Fair's event lobby (fair-lobby.ts) + a chord's Clash field (clash-bracket.ts newField).
// Run: npx tsx src/app/shimmer/open/ather/fair-lobby.test.ts
import { decodeLobby, present, lobbyHost, isLobby, allReady, takers, clashField, smashField, smashWinner, smashDone, newRun, LOBBY_STALE_MS, SMASH_WAIT_MS, FIELD_SIZE, type LobbyHere, type LobbySpirit } from './fair-lobby'
import { newField, nextBout, recordBout, champion, fieldOver, runOver, hasSeat } from './clash-bracket'
import { fightRunner } from './clash-bout'
import { evenSpirit } from './fair-clash'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const fox: LobbySpirit = { name: 'Fox', species: 'fox', element: 'base' }
const owl: LobbySpirit = { name: 'Owl', species: 'owl', element: 'base', bonded: { id: 'gust', twist: 2 }, known: ['gust'], lessons: ['caught'] }
const here = (who: string, spirit: LobbySpirit | null, ready: boolean, tent = 'clash:1'): LobbyHere => ({ t: 'here', tent, who, spirit, ready })

// ── the wire: a peer can send anything ──
ok(decodeLobby(here('Ann', owl, true))?.t === 'here', 'a here decodes')
const dOwl = decodeLobby(here('Ann', owl, true)) as LobbyHere
ok(dOwl.spirit?.bonded?.id === 'gust' && dOwl.spirit.lessons?.[0] === 'caught', 'her favourite + lessons ride along (every ring builds her the same)')
ok(decodeLobby({ t: 'here', tent: 'clash:1', who: '', spirit: null, ready: true }) === null, 'no name = dropped')
ok(decodeLobby({ t: 'here', who: 'A', ready: true }) === null, 'no tent = dropped')
ok((decodeLobby({ t: 'here', tent: 'x', who: 'A', ready: 'yes' }) as LobbyHere).ready === false, 'ready is true only when it says true')
ok(decodeLobby({ t: 'start', tent: 'x', run: 'r', seed: 0, seats: ['a', 'b'], spirits: [fox, fox] }) === null, 'a start needs a real seed')
ok(decodeLobby({ t: 'start', tent: 'x', run: 'r', seed: 5, seats: ['a'], spirits: [fox] }) === null, 'a start needs two seats')
ok(decodeLobby({ t: 'start', tent: 'x', run: 'r', seed: 5, seats: ['a', 'b'], spirits: [fox] }) === null, 'seats and spirits line up')
ok(decodeLobby({ t: 'start', tent: 'x', run: 'r', seed: 5, seats: ['a', null], spirits: [fox, owl], names: ['Ann'] })?.t === 'start', 'a start with a troupe seat decodes')
ok(decodeLobby({ t: 'hit', tent: 'smash', run: 'r', hit: -1, spirit: 'Fox', who: 'A' }) === null, 'a negative hit is dropped')
ok(decodeLobby({ t: 'hit', tent: 'smash', run: 'r', hit: 41, spirit: 'Fox', who: 'A' })?.t === 'hit', 'a hit decodes')
ok(decodeLobby(null) === null && decodeLobby('x') === null, 'junk = null')

// ── who is at the panel ──
const chord = ['s-host', 's-b', 's-c']
const heard = new Map<string, { m: LobbyHere; at: number }>([
  ['s-host', { m: here('Hana', owl, false), at: 1000 }],
  ['s-c', { m: here('Cy', fox, true, 'clash:2'), at: 1000 }],      // another tent
  ['s-x', { m: here('Stranger', fox, true), at: 1000 }],         // not in the chord
  ['s-old', { m: here('Gone', fox, true), at: 1000 - LOBBY_STALE_MS - 1 }],
])
const me = { id: 's-b', who: 'Bo', spirit: fox, ready: true }
const L = present('clash:1', me, heard, chord, 1000)
ok(L.length === 2 && L.map(p => p.id).join() === 's-host,s-b', `only chordmates at THIS tent, heard lately, in the chord's order (${L.map(p => p.id)})`)
ok(L[1].you && !L[0].you, 'I am marked as me')
ok(lobbyHost(L, chord) === 's-host', 'the chord\'s starter hosts while at the panel')
const L2 = present('clash:1', { ...me, id: 's-c' }, new Map([['s-b', { m: here('Bo', fox, true), at: 1000 }]]), chord, 1000)
ok(lobbyHost(L2, chord) === 's-b', 'the starter away: the next longest-standing keeper at the panel hosts')
// every keeper's list names the same host
const fromHost = present('clash:1', { id: 's-host', who: 'Hana', spirit: owl, ready: false }, new Map([['s-b', { m: here('Bo', fox, true), at: 1000 }]]), chord, 1000)
ok(lobbyHost(fromHost, chord) === lobbyHost(L, chord), 'both sides agree who hosts')
ok(!isLobby([L[1]]) && isLobby(L), 'one keeper alone = solo; two = a lobby')
ok(!allReady(L), 'the host is not ready yet: no start')
const LR = L.map(p => ({ ...p, ready: true }))
ok(allReady(LR), 'everyone ready = go')
ok(!allReady(LR.map((p, i) => (i ? p : { ...p, spirit: null }))), 'a keeper without a spirit is never ready')
ok(takers(L).map(p => p.id).join() === 's-b', 'an early start takes only the ready')

// ── the Clash field ──
const line: LobbySpirit[] = [{ name: 'T1', species: 'frog', element: 'base' }, { name: 'T2', species: 'bat', element: 'base' }, { name: 'T3', species: 'turtle', element: 'base' }]
const F = clashField(LR, line)
ok(F.seats.length === FIELD_SIZE && F.seats[0] === 's-host' && F.seats[1] === 's-b' && F.seats[2] === null && F.seats[3] === null, `two keepers + two of the line-up (${F.seats})`)
ok(F.spirits[2]?.name === 'T1' && F.spirits[3]?.name === 'T2' && F.names[0] === 'Hana', 'the line-up fills in its order; names travel')
const four = ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({ id, who: id, spirit: fox, ready: true, you: i === 0 }))
ok(clashField(four, line).seats.join() === 'a,b,c,d', 'a field holds four keepers at most, no troupe then')
const S = smashField(LR)
ok(S.seats.join() === 's-host,s-b' && S.spirits.every(Boolean), 'Smash seats = the takers, no troupe at the bell')

// ── the field's tree: paired in order, runs to the final ──
const b0 = newField(4)
ok(b0.bouts[0].a === 0 && b0.bouts[0].b === 1 && b0.bouts[1].a === 2 && b0.bouts[1].b === 3, 'chordmates face each other first (0 v 1)')
let b = recordBout(b0, nextBout(b0, true)!, 1)
ok(runOver(b) && !fieldOver(b), 'seat 0 is out, which ends a SOLO run; the field goes on')
ok(nextBout(b, true) === 1 && nextBout(b) === null, 'full = the next bout still comes')
b = recordBout(b, 1, 2); b = recordBout(b, nextBout(b, true)!, 2)
ok(fieldOver(b) && champion(b) === 2 && nextBout(b, true) === null, 'the final decides the champion')
ok(hasSeat(b.bouts[2], 1) && hasSeat(b.bouts[2], 2), 'hasSeat reads any seat')
let threw = false; try { newField(3) } catch { threw = true }
ok(threw, 'a field must be a power of two')

// ── same seed, same fights: every keeper's ring agrees ──
const ringOf = (seed: number, sp: LobbySpirit[] = [owl, fox, line[0], line[1]]) => {
  let t = newField(4), i: number | null
  while ((i = nextBout(t, true)) !== null) {
    const bt = t.bouts[i], A = sp[bt.a!], B = sp[bt.b!]
    const play = fightRunner.run({ spirit: evenSpirit(A.species, A.element, 'easy', A.name), bonded: A.bonded }, { spirit: evenSpirit(B.species, B.element, 'easy', B.name), bonded: B.bonded }, { tier: 'easy', seed: seed * 1000 + i })
    let s = 0; while (!play.over(s) && s < 400) { s += 0.5; play.at(s) }   // the ring steps the engine by asking for frames
    t = recordBout(t, i, play.winner() === 'a' ? bt.a! : bt.b!)
  }
  return t.bouts.map(x => x.winner).join()
}
ok(ringOf(777) === ringOf(777), `two rings, one seed, one tree (${ringOf(777)})`)
const seen = new Set(Array.from({ length: 8 }, (_, k) => ringOf(100 + k, [fox, fox, fox, fox])))   // a mirror field: only the seed decides
ok(seen.size > 1, `different seeds give different trees (${[...seen].join(' | ')})`)

// ── Smash's contest ──
ok(smashWinner([{ id: 'b', hit: 40 }, { id: 'a', hit: 55 }], ['a', 'b']) === 'a', 'the highest hit wins')
ok(smashWinner([{ id: 'b', hit: 55 }, { id: 'a', hit: 55 }], ['a', 'b']) === 'a', 'a tie goes to the seat listed first')
ok(smashWinner([{ id: 'x', hit: 999 }, { id: 'b', hit: 1 }], ['a', 'b']) === 'b', 'a hit from outside the seats never wins')
ok(!smashDone([{ id: 'a' }], ['a', 'b'], 0, 1000) && smashDone([{ id: 'a' }, { id: 'b' }], ['a', 'b'], 0, 1000), 'over when every seat has swung')
ok(smashDone([{ id: 'a' }], ['a', 'b'], 0, SMASH_WAIT_MS), 'or when the wait runs out')
const r1 = newRun(5, () => 0), r2 = newRun(5, () => 0.999)
ok(r1.seed >= 1 && r2.seed > r1.seed && r1.run !== r2.run, 'a run has a real seed and its own id')

console.log(`fair-lobby: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗', f)
process.exit(fails.length ? 1 : 0)
