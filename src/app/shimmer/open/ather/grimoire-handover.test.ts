// Run: npx tsx src/app/shimmer/open/ather/grimoire-handover.test.ts
// M123 s1: a keeper with NO grimoire pedestal (a legacy keeper: no live tutorial, every gift marked given, so Beat 1 never
// ran and never handed it) gets it from Greg's ordinary talk ('Spirits?', the signed choice), and Greg's bubble is the
// signed grimoire line word for word (read from the canon file). Once owned, the answer is gone. A live keeper before
// Spirits? gets it in Beat 1 instead, so his ordinary talk never doubles it.
import { readFileSync } from 'fs'
import { pedestalOwed } from './glade-greg-talk'
import { freshTut, legacyTut, heardSpirits } from './glade-tutorial'
import { line } from './glade-tutorial-lines'
import { gregTalk, ANSWERS } from './greg-talk'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }

ok(pedestalOwed(legacyTut(), false) === true, 'legacy keeper, no pedestal: owed')
ok(pedestalOwed(legacyTut(), true) === false, 'legacy keeper who owns one: not owed')
ok(pedestalOwed(null, false) === true, 'no tutorial save at all: owed')
ok(pedestalOwed(freshTut(), false) === false, 'live keeper before Spirits?: Beat 1 hands it, not this')
ok(pedestalOwed(heardSpirits(freshTut()), false) === true, 'live keeper past Spirits? who has none (bag was full): owed')
ok(pedestalOwed(heardSpirits(freshTut()), true) === false, 'live keeper past Spirits? who owns one: not owed')

const errand = { stage: 'done' as const, seatName: '', where: '', citadel: false, onTake: () => {} }
let picked = 0
const n0 = gregTalk(errand, 0, { bye: () => {}, goto: () => {}, grimoire: { label: line('greg.b1.choice.b'), pick: () => { picked++ } } })
const g = n0.options.find(o => o.label === 'Spirits?')
ok(!!g, 'the grimoire answer is offered as the signed "Spirits?"')
ok(n0.options[n0.options.length - 1].label === ANSWERS.bye, 'goodbye stays last')
g?.pick(); ok(picked === 1, 'picking it hands it over')
const n1 = gregTalk(errand, 0, { bye: () => {}, goto: () => {}, said: line('greg.b1.spirits.3') })
ok(!n1.options.some(o => o.label === 'Spirits?'), 'without the act (owned now) no grimoire answer')
// a keeper still on the first errand (stage greg: the send-off) gets it on the first screen too
const eg = { ...errand, stage: 'greg' as const, seatName: 'X', where: 'Y' }
ok(gregTalk(eg, 0, { bye: () => {}, goto: () => {}, grimoire: { label: 'Spirits?', pick: () => {} } }).options.some(o => o.label === 'Spirits?'), 'stage greg: offered on the first screen')
ok(gregTalk(eg, 0, { bye: () => {}, goto: () => {}, said: 'S' }).line === 'S', 'stage greg: his said line shows on the first screen')
// the bubble is the signed canon line, word for word
const canon = (() => { try { return readFileSync('/root/athernyx/CANON/game/shimmer-quest-glade-tutorial.md', 'utf8') } catch { return null } })()
ok(n1.line === 'This is a grimoire. I keep trying to grow what we know of them with it.', 'his bubble after the hand-over is greg.b1.spirits.3')
if (canon !== null) ok(canon.includes(n1.line), 'the line is in the signed canon file')
else console.log('(canon file not readable here: canon assert skipped)')
// M123 s2: the spirits gate is open for every keeper (no owner cookie, no ?spirits=3d) — read from the source
const sm = readFileSync(new URL('./spirit-model.tsx', import.meta.url), 'utf8')
const hook = sm.slice(sm.indexOf('export function useSpiritsDev'), sm.indexOf('export function useSpiritsDev') + 200)
ok(/\{\s*return true\s*\}/.test(hook), 's2: useSpiritsDev() is true for every keeper')
ok(!/api\/owner/.test(hook) && !/spirits/.test(hook.replace('useSpiritsDev', '')), 's2: no owner check, no ?spirits flag in the hook')
console.log(`grimoire-handover: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
