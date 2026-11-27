// BETA M246: SMASH REDO, the bell's score (smash-score.ts), the show's timeline + lobby order (smash-bell.ts).
// Run: npx tsx src/app/shimmer/open/ather/smash-score.test.ts
import { readFileSync } from 'fs'
import { join } from 'path'
import { smashSwing, smashMoveOf, scoreOf, rollOf, theoreticalMax, cracks, gaugeOf, cleanCraftedScore, CRACK_AT, SMASH_SCALE } from './smash-score'
import { beatsFor, beatAt, showMs, bellMs, lobbyShow, showWinner, BELL_UI, BELL_FLOOR_MS } from './smash-bell'
import { smashWinner, type LobbySpirit } from './fair-lobby'
import { KIND, clashMoveOf, knownMoves, KNOWN_ALL_LEVEL } from './clash-fight'
import { cleanHit, MAX_HIT } from './fair-smash-rules'
import type { Species } from '../../spirits/spirit'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const SPECIES = Object.keys(KIND) as Species[]
const mid = () => 0.5

// ── the scale: a normal spirit lands in the hundreds ──
const fresh = SPECIES.map(sp => smashSwing(sp, undefined, 'base', {}, mid).score)
ok(fresh.every(s => s >= 100 && s < 1000), `every fresh spirit scores in the hundreds (${fresh.join(' ')})`)
const lowRoll = SPECIES.map(sp => smashSwing(sp, undefined, 'base', {}, () => 0).score), highRoll = SPECIES.map(sp => smashSwing(sp, undefined, 'base', {}, () => 0.999).score)
ok(lowRoll.every(s => s >= 100) && highRoll.every(s => s < 1000), `fresh stays in the hundreds at both ends of the roll (${Math.min(...lowRoll)}..${Math.max(...highRoll)})`)
const grown = (n: number, pwr = 0) => ({ form: 'base' as const, g: { pwr }, plays: 0, xp: 0, grown: n })
ok(smashSwing('fox', grown(12, 10), 'base', {}, mid).score > smashSwing('fox', undefined, 'base', {}, mid).score, 'growth + training swing harder')
ok(smashSwing('fox', grown(12, 10), 'base', {}, mid).score < 2000, 'a few dozen growths stay under 2000')
ok(smashSwing('frog', grown(1000, 20), 'base', {}, () => 0.999).score < CRACK_AT, `a thousand growths, full PWR, top roll still under 9000 (${smashSwing('frog', grown(1000, 20), 'base', {}, () => 0.999).score})`)

// ── the ceiling today: just over 9000 (OVER 9000 is possible and all but never) ──
const top = theoreticalMax()
console.log(`theoretical max today: ${top.score} (${top.species} ${top.element}, ${top.move}, atk ${top.atk.toFixed(1)}, power ${top.power})`)
ok(top.score > CRACK_AT && top.score < 10_000, `the theoretical max sits in 9000..10000 (${top.score})`)
ok(top.score < MAX_HIT && cleanHit(top.score) === top.score, 'the server takes the ceiling (under its sanity cap)')
ok(scoreOf(top.atk, top.power, 1 - SMASH_SCALE.ROLL) < CRACK_AT, 'even the ceiling build needs a high roll to crack the bell')

// ── the formula ──
ok(scoreOf(22, 50, 1) === SMASH_SCALE.SCALE, 'the reference spirit + move = SCALE')
ok(scoreOf(44, 50) > 2 * scoreOf(22, 50), 'super-linear in her attack (EXP > 1: growth tells)')
ok(scoreOf(22, 100) === 2 * scoreOf(22, 50), 'linear in the move power')
ok(Math.abs(rollOf(0) - 0.9) < 1e-9 && Math.abs(rollOf(1) - 1.1) < 1e-9 && rollOf(0.5) === 1, 'the roll spans 0.9..1.1')
ok(scoreOf(0, 0) === 1, 'a score is never below 1 (the server refuses 0)')

// ── which move: her favourite if it hits, else her strongest known damaging move (Clash power) ──
const foxK = knownMoves('fox', 'base', KNOWN_ALL_LEVEL), foxBest = Math.max(...foxK.map(m => clashMoveOf(m).power))
ok(smashMoveOf('fox', 'base').power === foxBest && foxBest > 0, `no favourite = her strongest move (${smashMoveOf('fox', 'base').name} ${foxBest})`)
const weak = foxK.filter(m => clashMoveOf(m).power > 0).sort((a, b) => clashMoveOf(a).power - clashMoveOf(b).power)[0]
ok(smashMoveOf('fox', 'base', { id: weak.id, twist: 3 }).id === weak.id, `her favourite is the move she swings (${weak.name})`)
const ward = foxK.find(m => clashMoveOf(m).power === 0)
ok(!ward || smashMoveOf('fox', 'base', { id: ward.id, twist: 0 }).power === foxBest, 'a favourite that does not hit falls back to her strongest')
ok(smashSwing('fox', undefined, 'base', { bonded: { id: weak.id, twist: 0 } }, mid).score === smashSwing('fox', undefined, 'base', { bonded: { id: weak.id, twist: 3 } }, mid).score, 'the twist never adds damage (canon)')
ok(smashMoveOf('fox', 'base', null, [weak.id]).id === weak.id, 'only the moves she knows')

// ── the crack ──
ok(!cracks(CRACK_AT) && cracks(CRACK_AT + 1) && !cracks(8999), 'the bell cracks OVER 9000 (9000 itself holds)')
ok(beatsFor(9001).includes('crack') && !beatsFor(9000).includes('crack') && !beatsFor(null).includes('crack'), 'the crack beat plays over 9000 only')
ok(gaugeOf(CRACK_AT) === 1 && gaugeOf(20000) === 1 && gaugeOf(0) === 0 && gaugeOf(300) > 0.5 && gaugeOf(300) < gaugeOf(1000), 'the gauge: a fair climb in the hundreds, the top notch at 9000, pinned past it')
ok(cleanCraftedScore('9001') === 9001 && cleanCraftedScore('') === null && cleanCraftedScore('abc') === null && cleanCraftedScore(0) === null && cleanCraftedScore(1e6) === null, 'the test hook takes a whole score 1..99999, else off')

// ── the show's timeline ──
ok(beatAt(0, 300).beat === 'intro' && beatAt(bellMs('intro') + 1, 300).beat === 'walk', 'intro, then the walk')
ok(beatAt(showMs(300) - 1, 300).beat === 'score' && beatAt(showMs(300), 300).done, 'it ends on the score')
ok(beatAt(bellMs('intro') + bellMs('walk') + bellMs('strike') + bellMs('gauge') + 1, 9001).beat === 'crack', 'over 9000 the crack follows the gauge')
ok(bellMs('intro', 100) === BELL_FLOOR_MS && showMs(300, 4) < showMs(300), 'a speed dial shortens the beats, never under the floor')

// ── the lobby: the same order + winner for every keeper ──
const fox: LobbySpirit = { name: 'Fox', species: 'fox', element: 'base' }, owl: LobbySpirit = { name: 'Owl', species: 'owl', element: 'storm' }
const run = { seats: ['a', null, 'b'], spirits: [fox, null, owl], names: ['Ann', null, 'Bo'] }
const heardA = [{ id: 'b', hit: 410, spirit: 'Owl', who: 'Bo' }, { id: 'a', hit: 380, spirit: 'Fox', who: 'Ann' }]
const heardB = [heardA[1], heardA[0]]
const showA = lobbyShow(run, heardA, 'a'), showB = lobbyShow(run, heardB, 'b')
ok(showA.map(c => c.keeper).join() === 'Ann,Bo' && showB.map(c => c.keeper).join() === 'Ann,Bo', 'both keepers see the seats in seat order (empty seats left out)')
ok(showA.map(c => c.score).join() === showB.map(c => c.score).join(), 'both keepers see the same scores, whatever order they heard them')
ok(showA[0].you && !showA[1].you && showB[1].you, 'each keeper is marked on their own screen only')
ok(showWinner(showA) === 1 && showWinner(showB) === 1, 'both read the same winner (the highest)')
ok(showA[showWinner(showA)!].key.startsWith(smashWinner(heardA, run.seats)!), 'the show winner is the lobby rule\'s winner')
ok(showWinner(lobbyShow(run, [{ id: 'a', hit: 410, spirit: 'Fox', who: 'Ann' }, { id: 'b', hit: 410, spirit: 'Owl', who: 'Bo' }], 'a')) === 0, 'a tie goes to the seat listed first')
ok(lobbyShow(run, [heardA[1]], 'a')[1].score === null, 'a seat not heard yet waits (score null)')

// ── words: placeholders, never the meme verbatim ──
ok(!/over\s*nine\s*thousand|it'?s over/i.test(BELL_UI.judgeLine), 'the judge line is not the famous meme')
const src = readFileSync(join(__dirname, 'smash-panel.tsx'), 'utf8')
ok(!/SmashPole|strikerRise|data-smash-pole/.test(src) && /SmashBellView/.test(src), 'the old pole is retired; the panel plays the bell show')

console.log(`smash-score: ${pass} pass, ${fails.length} fail`)
if (fails.length) { for (const f of fails) console.log('  ✗', f); process.exit(1) }
