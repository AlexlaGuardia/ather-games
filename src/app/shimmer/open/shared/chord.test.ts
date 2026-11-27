// BETA M188 s1: the chord's pure half (chord.ts). Run: npx tsx src/app/shimmer/open/shared/chord.test.ts
import { chordMates, mateBars, chordColour, hpFrac, decodeHp, CHORD_COLOURS, HP_STALE_S, MAX_BARS, CHORD_SEATS, CHORD_FULL_LINE, visitRefusal } from './chord'
import type { LobbyMember } from '@/lib/party-lobby'
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const mem = (look: string, name = look): LobbyMember => ({ id: `u_${look}`, name, zone: 'open:wilds', ready: false, trusted: false, look })
const all = [mem('me', 'Ana'), mem('b', 'Bo'), mem('c', 'Cy')]
ok(JSON.stringify(chordMates(all, 'me').map(m => m.look)) === '["b","c"]', 'mates = everyone but me, in ring-in order')
ok(chordMates([mem('me')], 'me').length === 0, 'alone in a chord: no bars')
ok(chordMates([mem('b'), mem('b'), mem(''), mem('me')], 'me').length === 1, 'a doubled row or an id-less row is one bar / none')
ok(chordMates('abcdefg'.split('').map(x => mem(x)), 'me').length === MAX_BARS, `at most ${MAX_BARS} bars`)
const heard = new Map([['b', { hp: 0.4, at: 100 }], ['c', { hp: 0.9, at: 100 - HP_STALE_S - 1 }]])
const bars = mateBars(all, 'me', heard, 100)
ok(bars[0].hp === 0.4 && bars[0].name === 'Bo', 'a fresh word = that bar')
ok(bars[1].hp === null, 'a stale word = a dim bar (null), never a made-up number')
ok(bars[0].colour === chordColour('b') && CHORD_COLOURS.includes(bars[0].colour as typeof CHORD_COLOURS[number]), 'each bar wears the keeper\'s chord colour')
ok(chordColour('p_abc') === chordColour('p_abc'), 'a keeper\'s colour is stable')
ok(new Set(['p_1', 'p_2', 'p_3', 'p_4', 'p_5', 'p_6', 'p_7', 'p_8'].map(chordColour)).size >= 3, 'colours spread over the palette')
ok(mateBars([mem('me'), { ...mem('d'), name: '' }], 'me', new Map(), 0)[0].name === 'keeper', 'a nameless mate still has a nametag')
ok(hpFrac(73, 100) === 0.75 && hpFrac(100, 100) === 1 && hpFrac(-5, 100) === 0 && hpFrac(150, 100) === 1, 'my health in 5% steps, clamped')
ok(hpFrac(50, 0) === 0 && hpFrac(NaN, 100) === 0, 'no max / junk = 0, never NaN on the wire')
ok(decodeHp({ h: 0.5 }) === 0.5 && decodeHp({ h: 0 }) === 0 && decodeHp({ h: 1 }) === 1, 'reads a fraction')
ok(decodeHp({ h: 2 }) === undefined && decodeHp({ h: -0.1 }) === undefined && decodeHp({ h: '0.5' }) === undefined && decodeHp(null) === undefined, 'junk is refused (undefined, never 0)')
// M217: a chord holds four (canon glossary › Chord, amended 11-26; shimmer-server lobby.py SEATS = 4)
ok(CHORD_SEATS === 4, 'a chord holds four')
ok(MAX_BARS >= CHORD_SEATS - 1, `a full chord's three mates all get a bar (MAX_BARS ${MAX_BARS})`)
ok(chordMates(['me', 'b', 'c', 'd'].map(x => mem(x)), 'me').length === 3, 'a chord of four = three mates on screen')
{ const r = visitRefusal('ash', true); ok(r.log === 'refused:chord-full' && r.line === CHORD_FULL_LINE && r.line === 'The chord is full.', 'a fifth keeper hears the chord is full') }
{ const r = visitRefusal('ash', false); ok(r.log === 'refused:not-home' && /Could not reach ash's plot/.test(r.line), 'a seated keeper whose host left hears the old line') }
ok(visitRefusal('', false).line.includes("a friend's"), 'no name = a friend')
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
