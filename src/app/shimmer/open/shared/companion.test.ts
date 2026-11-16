// The open world's Mana'mal companion (companion.ts) + Gemsense in prospecting. Run: npx tsx src/app/shimmer/open/shared/companion.test.ts
import { COMPANIONS, checkJoins, takeJoined, activeCompanion, setCompanion, perkFires, perkChance, unlockedBy, _resetCompanion, companionDef } from './companion'
import { mine, _resetProspecting, CRYSTAL_ITEM } from '../ather/prospecting'
import { _resetForestry, _setOpenLevel } from '../ather/forestry'
import type { SkillId } from '../../engine/skills'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const lv = (m: Partial<Record<SkillId, number>>) => (s: SkillId) => m[s] ?? 1

// canon's table: every skill has a lesser @15 and a true @100, sharing one perk
for (const s of ['farming', 'forestry', 'prospecting', 'rinning', 'alchemy'] as SkillId[]) {
  const two = COMPANIONS.filter(c => c.skill === s)
  ok(two.length === 2 && two.some(c => c.tier === 'lesser' && c.level === 15) && two.some(c => c.tier === 'true' && c.level === 100), `${s}: not one lesser@15 + one true@100`)
  ok(new Set(two.map(c => c.perk)).size === 1, `${s}: tiers carry different perks`)
}
ok(companionDef('glowmite').skill === 'prospecting' && companionDef('gemdigger').skill === 'prospecting', 'Glowmite/Gemdigger are not Prospecting')
ok(perkChance(companionDef('gemdigger')) > perkChance(companionDef('glowmite')), 'Gemdigger is not the strong Gemsense')

// gates
ok(unlockedBy(lv({ prospecting: 14 })).length === 0, 'something unlocks before 15')
ok(unlockedBy(lv({ prospecting: 15 })).map(c => c.id).join() === 'glowmite', 'Prospecting 15 does not bring Glowmite alone')
ok(unlockedBy(lv({ prospecting: 100 })).map(c => c.id).sort().join() === 'gemdigger,glowmite', 'Prospecting 100 does not bring Gemdigger')

// joins: the first one met walks out; a true Mana'mal steps in for its own lesser; another skill's does not displace
_resetCompanion()
ok(checkJoins(lv({ prospecting: 15 })).join() === 'glowmite' && activeCompanion()?.id === 'glowmite', 'Glowmite did not join and walk out')
ok(takeJoined().map(c => c.id).join() === 'glowmite' && takeJoined().length === 0, 'takeJoined does not report once')
ok(checkJoins(lv({ prospecting: 15 })).length === 0, 'Glowmite joined twice')
checkJoins(lv({ prospecting: 15, forestry: 15 }))
ok(activeCompanion()?.id === 'glowmite', "Drifthorn displaced Glowmite (another skill's lesser)")
checkJoins(lv({ prospecting: 100, forestry: 15 }))
ok(activeCompanion()?.id === 'gemdigger', 'Gemdigger did not step in for Glowmite')
setCompanion(null); checkJoins(lv({ prospecting: 100, forestry: 15, rinning: 15 }))
ok(activeCompanion() === null, 'a join called a companion out after the keeper sent it home')
setCompanion('prismstrike'); ok(activeCompanion() === null, 'an unmet companion can be called out')
setCompanion('drifthorn'); ok(activeCompanion()?.id === 'drifthorn', 'a met companion cannot be called out')

// the perk: only on its own skill, at its chance
setCompanion('glowmite')
let hits = 0; for (let i = 0; i < 10000; i++) if (perkFires('prospecting', Math.random)) hits++
ok(Math.abs(hits / 10000 - perkChance(companionDef('glowmite'))) < 0.02, `Gemsense fires ${hits / 100}%`)
ok(!perkFires('forestry', () => 0), 'Gemsense fires on forestry')
setCompanion(null); ok(!perkFires('prospecting', () => 0), 'a perk fires with nobody out')

// in mine(): a bonus shard of what broke, and Gemdigger's gem
_resetForestry(); _resetProspecting(); _resetCompanion()
_setOpenLevel('prospecting', 100); checkJoins(); setCompanion('glowmite')
let r = mine('violet', 't:1', () => 0)
ok(r.ok && r.perk === 'Gemsense' && r.drops.find(d => d.id === CRYSTAL_ITEM.violet)?.n === 2, `Gemsense did not add a violet: ${JSON.stringify(r)}`)
setCompanion('gemdigger')
r = mine('violet', 't:2', () => 0)
ok(r.ok && r.drops.some(d => d.id === 'pure_mana_core'), 'Gemdigger never drops a gem at roll 0')
r = mine('violet', 't:3', () => 0.99)
ok(r.ok && !r.perk && r.drops.length === 2, 'a perk fired at roll 0.99')
setCompanion(null)
r = mine('raw', 't:4', () => 0)
ok(r.ok && !r.perk, 'mine rolled a perk with nobody out')

console.log(`companion: ${pass} pass, ${fails.length} fail`)
if (fails.length) { fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1) }
