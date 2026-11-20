// bench-tabs.ts. Run: npx tsx src/app/shimmer/open/ather/bench-tabs.test.ts
import { benchTabs, TAB_LABEL } from './bench-tabs'
import { BENCH } from './focuses'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

ok(benchTabs('carpentry').join() === 'refine,furniture,blades,keeper', 'carpentry: refine, furniture, blades, keeper')
ok(benchTabs('stonemason').join() === 'refine,spikes,keeper', 'stonemason: refine, spikes, keeper')
ok(benchTabs('cooking').join() === 'hearth,keeper' && benchTabs('alchemy').join() === 'cauldron,keeper', 'cooking + alchemy')
ok(benchTabs('rinnshop').join() === 'bait,rinsticks,keeper', 'rinnshop')
ok(benchTabs('smith').join() === 'keeper', 'a room with no crafts yet still has its keeper')
for (const k of ['carpentry', 'stonemason', 'cooking', 'alchemy', 'rinnshop', 'smith', 'farm'] as const) {
  const t = benchTabs(k)
  ok(t[t.length - 1] === 'keeper' && new Set(t).size === t.length && t.every(x => !!TAB_LABEL[x]), `${k}: keeper last, no repeats, labelled`)
}
ok(benchTabs(BENCH.forestry).includes('blades') && benchTabs(BENCH.prospecting).includes('spikes'), 'focus tabs follow BENCH')

console.log(`bench-tabs: ${pass} pass, ${fails.length} fail`)
if (fails.length) { console.log(fails.join('\n')); process.exit(1) }
