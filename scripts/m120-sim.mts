// npx tsx scripts/m120-sim.mts — BETA M120: the offline newcomer-keeper sim (pack fight + the first champion), 30 seeds each.
import { packFight, championFight, summarise } from '../src/app/shimmer/open/ather/wilds-sim'
import * as combat from '../src/app/shimmer/open/ather/combat'
const N = 30, seeds = Array.from({ length: N }, (_, i) => 101 + i * 7)
const group = (combat as { groupPack?: (c: combat.Combat, ids: number[]) => void }).groupPack
const pack = summarise(seeds.map(s => packFight(s, ['shambler', 'shambler', 'shambler', 'floater'], group)))
const big = summarise(seeds.map(s => packFight(s, ['shambler', 'shambler', 'shambler', 'shambler', 'floater'], group)))
const champ = summarise(seeds.map(s => championFight(s)))
console.log(`shambler hp ${combat.SHAMBLER.hp} chase ${combat.SHAMBLER.chaseSpeed} · floater hp ${combat.FLOATER.hp}`)
console.log('pack 3S+1F', JSON.stringify(pack))
console.log('pack 4S+1F', JSON.stringify(big))
console.log('champion  ', JSON.stringify(champ))
