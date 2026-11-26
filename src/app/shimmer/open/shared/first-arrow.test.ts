// Run: npx tsx src/app/shimmer/open/shared/first-arrow.test.ts
// BETA M145: the first-time arrow's rules (pure half of shared/first-arrow.ts) + the wiring that makes them true in the game.
import { readFileSync } from 'fs'
import { arm, retire, current, slotOf, arrowShows, parseArrows, NO_ARROWS, ARROWS, ARROWS_KEY } from './first-arrow'
import { KEEPER_KEY_SPECS } from '../../../../lib/keeper-key-specs'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }

// a veteran was never armed: nothing shows
ok(current(NO_ARROWS) === null, 'never armed (a veteran): no arrow')
const a = arm(NO_ARROWS, 'grimoire')
ok(current(a) === 'grimoire', 'armed: the grimoire arrow shows')
ok(arm(a, 'grimoire') === a, 'arming twice changes nothing')
const d = retire(a, 'grimoire')
ok(current(d) === null, 'used / dismissed: gone')
ok(d.done.includes('grimoire') && !d.armed.includes('grimoire'), 'retired = done, not armed')
ok(current(arm(d, 'grimoire')) === null, '★ never twice: a done arrow cannot be armed again')
ok(arm(d, 'grimoire') === d, '★ never twice: arming a done arrow leaves the save untouched')
ok(current({ armed: ['grimoire'], done: ['grimoire'] }) === null, 'a save holding both armed + done shows nothing')
// survives a reload (round-trip through the saved JSON)
ok(current(parseArrows(JSON.parse(JSON.stringify(a)))) === 'grimoire', 'armed survives a reload')
ok(current(parseArrows(JSON.parse(JSON.stringify(d)))) === null, 'done survives a reload')
ok(current(parseArrows(null)) === null && current(parseArrows({ armed: 'x' })) === null, 'junk save = nothing armed')
// one at a time: the oldest armed, and an id the game no longer knows is skipped
ok(current({ armed: ['gone', 'grimoire'], done: [] }) === 'grimoire', 'an unknown id is skipped')
// the target: the slot holding the item, live
const bar = [{ itemId: 'repeater' }, null, { itemId: 'grimoire_pedestal' }]
ok(slotOf(ARROWS.grimoire, bar) === 2, 'points at the slot the grimoire landed in')
ok(slotOf(ARROWS.grimoire, [{ itemId: 'repeater' }]) === null, 'not on the bar: no arrow (never a wrong one)')
// never over a talk box / panel / fight
ok(arrowShows({ input: true }) === true, 'free screen: shows')
ok(arrowShows({ input: false }) === false, 'a talk box / panel (input off): hidden')
ok(arrowShows({ input: true, fight: true }) === false, 'a fight: hidden')
// saved per keeper: the key is registered
ok(KEEPER_KEY_SPECS.some(s => s.base === ARROWS_KEY), 'ARROWS_KEY is in KEEPER_KEY_SPECS (per keeper)')
// wiring: the Ather page arms it at Beat 1's hand-over only (the legacy M123 hand-over must not), and the HUD template draws it
const page = readFileSync(new URL('../ather/page.tsx', import.meta.url), 'utf8')
ok((page.match(/armArrow\('grimoire'\)/g) ?? []).length === 1, 'the page arms the grimoire arrow exactly once')
const beat1 = page.slice(page.indexOf('grimoire: () => {'), page.indexOf('grimoire: () => {') + 600)
ok(beat1.includes("armArrow('grimoire')"), 'it is armed inside the Beat 1 grimoire gift')
const hud = readFileSync(new URL('./game-hud.tsx', import.meta.url), 'utf8')
ok((hud.match(/<FirstArrow /g) ?? []).length === 2, 'GameHud draws the arrow in both layouts (phone + desktop)')
ok(/prevSel\.current !== slot/.test(hud), 'used = a CHANGE of selection onto the slot')
console.log(`first-arrow: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
