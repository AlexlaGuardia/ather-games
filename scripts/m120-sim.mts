// npx tsx scripts/m120-sim.mts — BETA M120: the offline newcomer-keeper sim (packs, crawlers, the first champion), 200 seeds.
import { packFight, championFight, summarise } from '../src/app/shimmer/open/ather/wilds-sim'
import * as combat from '../src/app/shimmer/open/ather/combat'
const seeds = Array.from({ length: 200 }, (_, i) => 1001 + i * 13)
const group = (combat as { groupPack?: (c: combat.Combat, ids: number[]) => void }).groupPack
console.log(`shambler hp ${combat.SHAMBLER.hp} chase ${combat.SHAMBLER.chaseSpeed} · floater hp ${combat.FLOATER.hp}`)
console.log('pack 3S+1F      ', JSON.stringify(summarise(seeds.map(s => packFight(s, ['shambler', 'shambler', 'shambler', 'floater'], group)))))
console.log('crawlers x3 pool', JSON.stringify(summarise(seeds.map(s => packFight(s, ['crawler', 'crawler', 'crawler'], undefined, true)))))
console.log('crawlers x4 pool', JSON.stringify(summarise(seeds.map(s => packFight(s, ['crawler', 'crawler', 'crawler', 'crawler'], undefined, true)))))
console.log('champion        ', JSON.stringify(summarise(seeds.map(s => championFight(s)))))
console.log('champion + 3 cr ', JSON.stringify(summarise(seeds.map(s => championFight(s, 3)))))
