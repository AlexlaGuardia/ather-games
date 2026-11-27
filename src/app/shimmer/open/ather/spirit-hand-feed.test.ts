// BETA M240 (play, 2026-11-27): FEED BY HAND. Feed left her talk; a dish in hand + the crosshair on her + E (Square on a pad)
// feeds it through spirit-dishes.ts feedDish. A full Steep (10/10) = a SNACK: bond only, Steep unchanged.
// Run: npx tsx src/app/shimmer/open/ather/spirit-hand-feed.test.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { feedDish, handFeedOf, bondOf, BOND_DAY_CAP, DISH_UI } from './spirit-dishes'
import { mealsOf, BAR_SLOTS } from './infusions'
import type { Pot } from './spirit-seeds'
import type { Species } from '../../spirits/spirit'
import { seedOf } from './seed-items'
import { merge } from '@/lib/input/bindings'
import type { PadButton } from '@/lib/input/actions'
import { newPadState, padStep } from '../shared/pad'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const read = (f: string) => readFileSync(join(__dirname, f), 'utf8')

// ── 1. what E feeds from the hand
const spirit = { kind: 'spirit' }
ok(handFeedOf('grilled_rinn', spirit) === 'grilled_rinn', 'a grilled dish in hand, aimed at her: E feeds it')
ok(handFeedOf('roast_rinn', spirit) === 'roast_rinn' && handFeedOf('water_meal', spirit) === 'water_meal', 'a roast and an element meal are fed by hand too')
ok(handFeedOf('shimmerscale', spirit) === null && handFeedOf('waymark', spirit) === null, 'raw food or a tool in hand: not a feed (E talks)')
ok(handFeedOf(null, spirit) === null && handFeedOf(undefined, spirit) === null, 'empty hand: E talks')
ok(handFeedOf('grilled_rinn', { kind: 'work' }) === null && handFeedOf('grilled_rinn', null) === null, 'a dish in hand aimed at anything else: no feed')
ok(DISH_UI.handFeed('Grilled Rinn') === 'E · feed Grilled Rinn', 'the prompt names the dish')

// ── 2. a full Steep = a snack: bond only, Steep unchanged; refused when today's bond is spent
const sp: Species = 'axolotl', low = () => 0, D = 7
const full: Pot = { seed: seedOf(sp), at: 1, bloomed: true, meals: Array(BAR_SLOTS).fill('water') }
const s1 = feedDish(full, sp, 'grilled_rinn', low, D)
ok(s1.ok && s1.snack && s1.steep.length === 0 && mealsOf(s1.pot).join() === mealsOf(full).join(), 'full Steep: the grill is a snack, Steep unchanged')
ok(s1.ok && s1.bond === 4 && bondOf(s1.pot) === 4, `full Steep: bond still rises (+4, got ${s1.ok && s1.bond})`)
const spent: Pot = { ...full, bond: 30, bondDay: D, bondToday: BOND_DAY_CAP }
const s2 = feedDish(spent, sp, 'grilled_rinn', low, D)
ok(!s2.ok && s2.why === 'full', 'full Steep and today\'s bond spent: refused (the dish stays in hand)')
const near: Pot = { ...full, bondDay: D, bondToday: BOND_DAY_CAP - 1 }
const s3 = feedDish(near, sp, 'grilled_rinn', low, D)
ok(s3.ok && s3.snack && s3.bond === 1, 'a snack stays under the day cap (+1 of 4)')
const empty: Pot = { seed: seedOf(sp), at: 1, bloomed: true }
const s4 = feedDish(empty, sp, 'grilled_rinn', low, D)
ok(s4.ok && !s4.snack && s4.steep.length === 3 && mealsOf(s4.pot).length === 3, 'room on her bar: a meal, not a snack (3 Water slots)')
const nine: Pot = { ...empty, meals: Array(BAR_SLOTS - 1).fill('water') }
const s5 = feedDish(nine, sp, 'grilled_rinn', low, D)
ok(s5.ok && !s5.snack && mealsOf(s5.pot).length === BAR_SLOTS, '9/10: the grill fills the last slot (not a snack)')

// ── 3. the talk has no Feed; the page feeds by hand through the panel's one feed path
const talk = read('spirit-talk.tsx'), page = read('page.tsx')
ok(!/label: 'Feed'/.test(talk), 'her talk has no Feed answer')
ok(/label: 'Open'/.test(talk) && /label: 'Follow'/.test(talk) && /label: 'Stay'/.test(talk), 'Follow / Stay / Open stay')
ok(/export function feedSpirit\(/.test(talk) && /feedOne = \(mid: string\) => \{ if \(id\) feedSpirit\(id, sp, mid\) \}/.test(talk), 'her panel and the hand share feedSpirit')
ok(/n\.kind === 'spirit' && handFeedOf\(heldRef\.current, n\)\) \{[^\n]*feedSpirit\(n\.id, sp, heldRef\.current!\)/.test(page), 'page: E on her with a dish in hand calls feedSpirit')
const iFeed = page.indexOf("n.kind === 'spirit' && handFeedOf(heldRef.current, n)) {"), iTalk = page.indexOf("n.kind === 'spirit') setPanel({ kind: 'spirit'")
ok(iFeed > 0 && iTalk > iFeed, 'page: the hand feed is checked before the talk opens')
ok(/n\?\.kind === 'spirit' && handFeedOf\(heldRef\.current, n\) \? DISH_UI\.handFeed\(/.test(page), 'page: the prompt says E · feed <dish>')

// ── 4. the pad: Square (the west face button, 'X' in the binding map) sends E, the same E that feeds
{
  const map = merge(null), s = newPadState()
  const smp = (down: PadButton[]) => ({ down: new Set(down), pressed: new Set(down), lx: 0, ly: 0, rx: 0, ry: 0, kind: 'playstation' as const })
  ok(map['world.interact'].pad.includes('X'), "world.interact's pad button is the west face (Square)")
  const fx = padStep(s, smp(['X']), map, false, 1 / 60, { handsOut: false, holding: true, browsing: false })
  ok(fx.some(f => f.t === 'keydown' && f.code === 'KeyE'), `Square with a dish in hand presses E (${JSON.stringify(fx)})`)
}

console.log(`spirit-hand-feed: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('FAIL', f)
if (fails.length) process.exit(1)
