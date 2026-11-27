// M150 s5: the bench's gameplay dials + bench-only guns (gun-bench.ts) and the two LIVE balance calls (gunplay / combat).
// Run: npx tsx src/app/shimmer/open/shared/gun-bench.test.ts
import { BENCH_GUNS, BENCH_ONLY_GUNS, GRINDER_GUN, STAT_DIALS, benchGun, cleanStats, heldDps, statsOf, loadStats, saveStats, GUN_STATS_KEY } from './gun-bench'
import { RANGE_GUNS, BACKBONE_DAMAGE } from './gunplay'
import { WEAPONS } from '../../engine/weapons'
import { HEAD_Y, BODY_Y, SHAMBLER, newCombat, spawnHollow, stepCombat, fire, headKillOf, type Terrain } from '../ather/combat'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, l: string) => { if (c) pass++; else fails.push(l) }
const gun = (id: string) => RANGE_GUNS.find(g => g.id === id)!

// ── (4) LIVE: the Charred Rifle hits as hard as the Lance; the Lance's headshot takes a whole Hollow ──
const lanceEngine = WEAPONS.find(w => w.id === 'lance')!
ok(gun('charred-rifle').damage === gun('lance').damage, `Charred Rifle damage (${gun('charred-rifle').damage}) == Lance damage (${gun('lance').damage})`)
ok(gun('lance').damage === lanceEngine.damage && lanceEngine.damage === 22, 'the Lance keeps its own damage (22): the Charred Rifle took the Lance\'s, not the other way')
ok(gun('lance').headKill === true && RANGE_GUNS.filter(g => g.headKill).length === 1, 'only the Lance carries headKill')
ok(gun('lance').crit < SHAMBLER.hp, 'the Lance\'s crit alone would NOT one-shot a shambler (the rule does it, not a number)')
ok(headKillOf({ headKill: true }, { hp: 45 }) === 45 && headKillOf({}, { hp: 45 }) === 0 && headKillOf({ headKill: true }, { hp: -3 }) === 0, 'headKillOf: all it has, only for a headKill round')

const flat: Terrain = { heightAt: () => 0, walkable: () => true }
/** one aimed (ADS) round from `id` at a still shambler 10 m off, at the head or the body: [hp before, hp after, killed] */
function oneShot(id: string, at: 'head' | 'body', hp = SHAMBLER.hp) {
  const c = newCombat(7, id); c.hollows.length = 0
  const h = spawnHollow(c, flat, 0, 0, 'shambler'); Object.assign(h, { state: 'recover', t: 99, hp, maxHp: hp })
  const y = (at === 'head' ? HEAD_Y : BODY_Y) + 0.08   // fire() lets the round go 8 cm under the eye
  ok(fire(c, { x: 0, y, z: 10 }, { x: 0, y: 0, z: -1 }, true), `${id}: fires`)
  let killed = false
  for (let i = 0; i < 30 && c.rounds.length; i++) { stepCombat(c, flat, { x: 60, y: 0, z: 60 }, 1 / 60); if (c.events.some(e => e.kind === 'hit' && e.killed)) killed = true }
  return { after: h.hp, killed, hit: h.hp < hp }
}
{ const r = oneShot('lance', 'head'); ok(r.killed && r.after <= 0, `Lance HEADSHOT kills a full shambler in one (hp after ${r.after})`) }
{ const r = oneShot('lance', 'head', 400); ok(r.killed, 'Lance headshot kills even a 400 hp body (all it has)') }
{ const r = oneShot('lance', 'body'); ok(r.hit && !r.killed && Math.abs(r.after - (SHAMBLER.hp - 22)) < 1e-9, `Lance BODY shot keeps today's 22 (hp ${SHAMBLER.hp} -> ${r.after})`) }
{ const r = oneShot('backbone', 'head'); ok(r.hit && !r.killed, 'any other gun\'s headshot still deals its crit only (Backbone)') }
{ const r = oneShot('charred-rifle', 'body'); ok(r.hit && Math.abs(r.after - (SHAMBLER.hp - 22)) < 1e-9, `Charred Rifle body shot = 22 now (hp after ${r.after})`) }

// ── (3) the M9 Grinder: bench only, full auto, slower than the Backbone, more a round, DPS inside the band ──
ok(!RANGE_GUNS.some(g => g.id === 'grinder') && BENCH_GUNS.some(g => g.id === 'grinder') && BENCH_ONLY_GUNS.has('grinder'), 'Grinder: on the bench, not on the range (no player holds it)')
ok(GRINDER_GUN.auto && GRINDER_GUN.burst === 1 && GRINDER_GUN.slot === 'LONGBARREL' && GRINDER_GUN.name === 'M9 GRINDER', 'Grinder: a full-auto LONGBARREL, canon name')
ok(GRINDER_GUN.fireCd >= 0.18 && GRINDER_GUN.fireCd <= 0.22, `Grinder: 0.18-0.22 s a round (${GRINDER_GUN.fireCd})`)
const bb = gun('backbone')
ok(GRINDER_GUN.fireCd > bb.burstGap && GRINDER_GUN.damage > BACKBONE_DAMAGE * 1.2, 'Grinder: slower than the Backbone fires inside a burst, more per bullet')
const band = RANGE_GUNS.map(heldDps), lo = Math.min(...band), hi = Math.max(...band), gd = heldDps(GRINDER_GUN)
ok(gd >= lo && gd <= hi, `Grinder DPS held ${gd.toFixed(1)} inside the range's band ${lo.toFixed(1)}..${hi.toFixed(1)}`)
ok(gd > heldDps(bb), `Grinder out-damages the Backbone held (${gd.toFixed(1)} vs ${heldDps(bb).toFixed(1)})`)
ok(BENCH_GUNS.some(g => g.id === 'twins' && g.pellets > 1), 'the Twins are on the bench (their sim row)')

// ── (1) the gameplay dials ──
ok(benchGun(bb, null) === bb && benchGun(bb, {}) === bb, 'untouched: the same gun object back')
{ const g = benchGun(bb, { damage: 20, crit: 31 }); ok(g.damage === 20 && g.crit === 31 && g.fireCd === bb.fireCd && bb.damage === BACKBONE_DAMAGE, 'damage / crit move alone, the row is untouched') }
{ const g = benchGun(bb, { projSpeed: 164 }); ok(g.projSpeed === 164 && Math.abs(g.projSpeed * g.projLife - bb.projSpeed * bb.projLife) < 1e-9, 'round speed keeps the reach') }
ok(benchGun(bb, { pellets: 9 }) === bb, 'a dial a gun does not have (pellets on the Backbone) does nothing')
ok(benchGun(gun('roar'), { pellets: 12 }).pellets === 12 && benchGun(gun('charred-rifle'), { charge: 0.6 }).charge === 0.6, 'pellets on the Roar, charge on the Charred Rifle')
ok(benchGun(bb, { burst: 4 }).burst === 4, 'rounds a burst on a burst gun')
ok(cleanStats({ damage: 999, clip: -4, nope: 3, crit: 'x' } as never).damage === 80 && cleanStats({ clip: -4 }).clip === 1 && !('crit' in cleanStats({ crit: 'x' } as never)), 'cleanStats clamps, drops junk')
for (const g of BENCH_GUNS) for (const d of STAT_DIALS) if (!d.only || d.only(g)) { const v = statsOf(g)[d.k]; ok(v >= d.min && v <= d.max, `${g.id}: ${d.k} ${v} sits inside its dial ${d.min}..${d.max}`) }

// saved per gun (a fake localStorage)
{ const mem: Record<string, string> = {}
  ;(globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v }, removeItem: (k: string) => { delete mem[k] } } as Storage
  saveStats('lance', { damage: 30 }); saveStats('grinder', { clip: 50 })
  ok(loadStats().lance?.damage === 30 && loadStats().grinder?.clip === 50 && JSON.parse(mem[GUN_STATS_KEY]).lance.damage === 30, 'saved per gun under open:gun-stats.v1')
  saveStats('lance', null); ok(!loadStats().lance && loadStats().grinder?.clip === 50, 'reset forgets one gun')
  mem[GUN_STATS_KEY] = '{bad'; ok(Object.keys(loadStats()).length === 0, 'a broken save loads empty') }

console.log(`gun-bench: ${pass} pass, ${fails.length} fail`)
if (fails.length) { for (const f of fails) console.log('  FAIL', f); process.exit(1) }
