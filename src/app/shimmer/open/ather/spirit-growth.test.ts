// BETA M118 s1: spirit growth (spirit-growth.ts), pure. Run: npx tsx src/app/shimmer/open/ather/spirit-growth.test.ts
import { readFileSync } from 'fs'
import { SPECIES_BASE, BASE_STATS, GROWTH, MAX_GROWN, growthMult, expNeed, withExp, barFill, grownStat, GROWTH_LABEL, grownLine } from './spirit-growth'
import { SPECIES_STATS_V2 } from '../../engine/party-stats'
import { spiritSheet } from './spirit-sheet'
import { SPECIES_NAMES, type Species } from '../../spirits/spirit'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const SP = Object.keys(SPECIES_NAMES) as Species[]

// (1) the base table: fixed per species, every species, low band, signature stat highest, the V2 archetype shape kept
ok(SP.every(sp => !!SPECIES_BASE[sp]), 'every species has a base')
for (const sp of SP) {
  const b = SPECIES_BASE[sp], v = BASE_STATS.map(k => b[k]), old = SPECIES_STATS_V2[sp]
  ok(v.every(x => Number.isInteger(x) && x >= 12 && x <= 34), `${sp}: base in the low band (${v.join(' ')})`)
  ok(Math.max(...v) >= 25, `${sp}: a signature stat stands out (${Math.max(...v)})`)
  const sigOld = BASE_STATS.reduce((a, k) => (old[k] > old[a] ? k : a)), sigNew = BASE_STATS.reduce((a, k) => (b[k] > b[a] ? k : a))
  ok(b[sigOld] === b[sigNew], `${sp}: the old signature (${sigOld}) is still the top (${sigNew})`)
  ok(BASE_STATS.every(k => b[k] < old[k]), `${sp}: rebased BELOW the old 50-70s table`)
  ok(spiritSheet(sp).axes.every(a => a.value === b[a.stat]), `${sp}: two sheets read the same base (no RNG)`)
}
ok(JSON.stringify(SPECIES_BASE) === JSON.stringify(SPECIES_BASE) && spiritSheet('fox').axes.map(a => a.value).join() === spiritSheet('fox').axes.map(a => a.value).join(), 'fixed: no roll between reads')
const src = readFileSync(new URL('./spirit-growth.ts', import.meta.url), 'utf8')
ok(!/Math\.random/.test(src), 'no Math.random in the growth module')

// (2) the growth curve: 1 at bloom, strictly rising, concave (each growth adds less), bounded at the ceiling
ok(growthMult(0) === 1, 'bloom = the base')
ok(GROWTH.MAX_LEVEL === 9999 && MAX_GROWN === 9998, 'hidden ceiling 9999')
ok(Math.abs(growthMult(MAX_GROWN) - GROWTH.MULT) < 1e-9 && GROWTH.MULT >= 8 && GROWTH.MULT <= 10, `the ceiling stands ~8-10x base (${growthMult(MAX_GROWN)})`)
ok(growthMult(MAX_GROWN + 50) === growthMult(MAX_GROWN) && growthMult(1e9) === GROWTH.MULT, 'bounded: no growth past the ceiling')
ok(growthMult(-5) === 1 && growthMult(NaN) === 1, 'junk growth reads as bloom')
let mono = true, taper = true
for (let n = 0; n < MAX_GROWN; n++) {
  const d = growthMult(n + 1) - growthMult(n)
  if (!(d > 0)) mono = false
  if (n > 0 && !(d < growthMult(n) - growthMult(n - 1))) taper = false
}
ok(mono, 'strictly rising: every growth adds')
ok(taper, 'tapering: every growth adds less than the one before')
ok(grownStat('fox', 'pwr', 1) - SPECIES_BASE.fox.pwr >= 1, `the FIRST growth is felt: +${(grownStat('fox', 'pwr', 1) - SPECIES_BASE.fox.pwr).toFixed(2)} PWR`)

// (2) the bars: each asks more than the last; the ceiling never fills
let harder = true
for (let n = 0; n < MAX_GROWN - 1; n++) if (!(expNeed(n + 1) > expNeed(n))) harder = false
ok(harder, 'every bar asks more than the last')
ok(expNeed(0) >= 3 && expNeed(0) <= 6, `the first bar is a handful of Hollows (${expNeed(0)})`)
ok(expNeed(MAX_GROWN) === Infinity, 'the ceiling bar never fills')
let total = 0; for (let n = 0; n < MAX_GROWN; n++) total += expNeed(n)
ok(total > 1e8, `9999 is nearly impossible: ${total.toExponential(2)} Hollows`)
// withExp
const w = withExp({ xp: 0, grown: 0 }, expNeed(0) + expNeed(1) + 1)
ok(w.grew === 2 && w.g.grown === 2 && w.g.xp === 1, `a big haul carries over (${JSON.stringify(w)})`)
ok(withExp({ xp: 0, grown: 0 }, 0).grew === 0 && withExp({ xp: 0, grown: 0 }, -5).g.xp === 0 && withExp({ xp: NaN, grown: NaN }, NaN).g.xp === 0, 'nothing / negative / NaN: no change, no NaN')
const top = withExp({ xp: 0, grown: MAX_GROWN - 1 }, 1e12)
ok(top.g.grown === MAX_GROWN && top.grew === 1 && top.g.xp === 0, 'stops at the ceiling')
ok(withExp(top.g, 1e9).grew === 0 && barFill(top.g) === 1, 'at the ceiling: full bar, no more growth')
ok(barFill(undefined) === 0 && barFill({ xp: 2, grown: 0 }) === 2 / expNeed(0), 'the bar = xp / need')

// no level number in the panel's text: the sheet has no level field; the panel source renders no level
ok(SP.every(sp => { const s = spiritSheet(sp, { form: 'base', g: {}, plays: 0, xp: 3, grown: 41 }); return !('level' in s) && s.moves.every(m => !('level' in m)) }), 'the sheet carries no level number (her or her moves)')
const talk = readFileSync(new URL('./spirit-talk.tsx', import.meta.url), 'utf8'), panel = talk.slice(talk.indexOf('export function SpiritPanel'))
ok(panel.length > 100 && !/\bLv\b|[Ll]evel/.test(panel.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'the spirit panel renders no "Lv" / level')
ok(panel.includes('GROWTH_LABEL') && panel.includes('data-spirit-growth'), 'the panel shows the growth bar')
ok(GROWTH_LABEL === 'Growth' && grownLine('Vulnyx') === 'Vulnyx has grown stronger.', 'the lark draft words (aa22eef, unsigned)')

if (fails.length) { console.error(`spirit-growth: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`spirit-growth: ${pass}/0`)
