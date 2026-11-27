// M245 (Alex 11-27): Hollows 100-150 hp, every gun re-numbered, head = body x HEAD_MULT, champions keep their time-to-kill.
// Prints the before/after table (shots to kill per gun per Hollow, body + head; champion time-to-kill) and asserts it.
// Run: npx tsx src/app/shimmer/open/shared/m245-damage.test.ts
import { RANGE_GUNS, withRhythm, M195_BACKBONE_RHYTHM, M245_DEFAULT_GUN, M245_BEFORE, M245_DAMAGE, M245_CHAMP_SCALE, M245_HOLLOW_SCALE, HEAD_MULT, BACKBONE_DAMAGE, type RangeGun } from './gunplay'
import { BENCH_GUNS, GRINDER_GUN, heldDps } from './gun-bench'
import { TWINS_GUN } from './twins-sim'
import { SHAMBLER, CRAWLER, FLOATER, FX } from '../ather/combat'
import { CHAMP, WAVE_HP, CHAMP_BAR_HP, CHAMP_SCALE } from '../ather/champion'
import { FIST_DMG } from './boop'
import { FIGHT } from './spirit-fight'
import { CHAMP_DPS_MAX } from './fight-share'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, l: string) => { if (c) pass++; else fails.push(l) }
/** a gun as everyone fires it: the Backbone on its baked M195 rhythm (fp-gun GUN_RHYTHM_BAKED), the rest their rows */
const live = <G extends RangeGun>(g: G): G => g.id === 'backbone' ? withRhythm(g, M195_BACKBONE_RHYTHM.BURST_GAP, M195_BACKBONE_RHYTHM.BURST_DELAY) : g
const gun = (id: string) => live(BENCH_GUNS.find(g => g.id === id)!)

// (1) Alex's numbers, exactly
ok(SHAMBLER.hp === 150 && CRAWLER.hp === 120 && FLOATER.hp === 100, `Hollow hp ${SHAMBLER.hp}/${CRAWLER.hp}/${FLOATER.hp} = 150/120/100`)
const want: Record<string, [number, number]> = { lance: [108, 1], repeater: [18, 1], spitter: [16, 1], backbone: [24, 1], 'charred-rifle': [77, 1], roar: [12, 8], grinder: [29, 1] }
for (const [id, [d, p]] of Object.entries(want)) ok(gun(id).damage === d && gun(id).pellets === p, `${id}: body ${gun(id).damage} x${gun(id).pellets} = ${d} x${p}`)
ok(BACKBONE_DAMAGE === 24, 'BACKBONE_DAMAGE 24')
ok(Math.abs(TWINS_GUN.damage * TWINS_GUN.pellets - 99) < 1e-9, `Twins: 99 a shell (${TWINS_GUN.pellets} x ${TWINS_GUN.damage})`)
ok(!RANGE_GUNS.some(g => g.id === 'grinder' || g.id === 'twins'), 'Grinder + Twins stay bench only')
// (2) head = body x the one table: 1.5 most, 1.25 shotguns (a pellet), 2 precision rifles
const mult: Record<string, number> = { repeater: 1.5, spitter: 1.5, backbone: 1.5, grinder: 1.5, roar: 1.25, twins: 1.25, lance: 2, 'charred-rifle': 2 }
for (const [id, m] of Object.entries(mult)) ok(HEAD_MULT[id] === m && Math.abs(gun(id).crit - Math.round(gun(id).damage * m * 10) / 10) < 1e-9, `${id}: head ${gun(id).crit} = ${gun(id).damage} x ${m}`)
ok(gun('lance').crit === 216 && gun('charred-rifle').crit === 154, 'Lance head 216, Charred head 154')

// (3) the table
const before = (g: RangeGun): RangeGun => { const o = M245_BEFORE[g.id]; return o ? { ...g, damage: o.damage, crit: o.crit, pellets: o.pellets ?? g.pellets } : g }
const OLD_HP = { shambler: 45, crawler: 35, floater: 30 }, NEW_HP = { shambler: SHAMBLER.hp, crawler: CRAWLER.hp, floater: FLOATER.hp }
const shots = (hp: number, a: number) => Math.ceil(hp / a - 1e-9)
const OLD_GRINDER = { damage: 13.5, crit: 21.4, pellets: 1 }, OLD_TWINS = { damage: 4.2, crit: 5.6, pellets: 8 }
const rows: string[] = ['| gun | body/round old -> new | head/round old -> new | shambler body | shambler head | crawler body | floater body |', '|---|---|---|---|---|---|---|']
for (const row of [...RANGE_GUNS, GRINDER_GUN, TWINS_GUN]) {
  const g = live(row), ob0 = row.id === 'grinder' || row.id === 'twins' ? null : live(before(row))
  const o = row.id === 'grinder' ? OLD_GRINDER : row.id === 'twins' ? OLD_TWINS : { damage: ob0!.damage, crit: ob0!.crit, pellets: ob0!.pellets }
  const ob = o.damage * o.pellets, oh = o.crit * o.pellets, nb = g.damage * g.pellets, nh = g.crit * g.pellets
  const oldHeadSh = g.id === 'lance' ? 1 : shots(OLD_HP.shambler, oh)   // the M150 s5 headKill rule
  rows.push(`| ${g.id} | ${+ob.toFixed(1)} -> ${+nb.toFixed(1)} | ${+oh.toFixed(1)} -> ${+nh.toFixed(1)} | ${shots(OLD_HP.shambler, ob)} -> ${shots(NEW_HP.shambler, nb)} | ${oldHeadSh} -> ${shots(NEW_HP.shambler, nh)} | ${shots(OLD_HP.crawler, ob)} -> ${shots(NEW_HP.crawler, nb)} | ${shots(OLD_HP.floater, ob)} -> ${shots(NEW_HP.floater, nb)} |`)
}
// champion time-to-kill: all 3 bars, trigger held, every pellet on (heldDps); body and head
const OLD_BAR = 150, bars = CHAMP.bars
const crows: string[] = ['| gun | champion TTK body old -> new (s) | head old -> new (s) |', '|---|---|---|']
let rb = 0, rh = 0
for (const g of RANGE_GUNS) {
  const b = before(g), hb = { ...b, damage: b.crit }, hn = { ...g, damage: g.crit }
  const tbo = OLD_BAR * bars / heldDps(b), tbn = CHAMP.barHp * bars / heldDps(g), tho = OLD_BAR * bars / heldDps(hb), thn = CHAMP.barHp * bars / heldDps(hn)
  rb += tbn / tbo; rh += thn / tho
  crows.push(`| ${g.id} | ${tbo.toFixed(1)} -> ${tbn.toFixed(1)} | ${tho.toFixed(1)} -> ${thn.toFixed(1)} |`)
}
rb /= RANGE_GUNS.length; rh /= RANGE_GUNS.length
const meanT = (f: (g: RangeGun) => number) => RANGE_GUNS.reduce((a, g) => a + f(g), 0) / RANGE_GUNS.length
const mbo = meanT(g => OLD_BAR * bars / heldDps(before(g))), mbn = meanT(g => CHAMP.barHp * bars / heldDps(g))
const mho = meanT(g => { const b = before(g); return OLD_BAR * bars / heldDps({ ...b, damage: b.crit }) }), mhn = meanT(g => CHAMP.barHp * bars / heldDps({ ...g, damage: g.crit }))
crows.push(`| MEAN (6 held guns) | ${mbo.toFixed(1)} -> ${mbn.toFixed(1)} (${(100 * (mbn / mbo - 1)).toFixed(1)}%) | ${mho.toFixed(1)} -> ${mhn.toFixed(1)} (${(100 * (mhn / mho - 1)).toFixed(1)}%) |`)
if (process.env.M245_TABLE) console.log(rows.join('\n') + '\n\nchampion bar hp 150 -> ' + CHAMP.barHp + ` (x ${M245_CHAMP_SCALE.toFixed(3)}), wave adds ${JSON.stringify(WAVE_HP)}\n` + crows.join('\n'))
// M245 s2 (meaning MOVED, Alex 11-27: "CHAMPIONS 500 HP per bar"): the champion no longer holds the newcomer's old time-to-kill
// (M245's 'within 10%' asserts, bar 270 = 150 x M245_CHAMP_SCALE 1.8). It is Alex's 500 a bar, and its heal and wave adds keep
// M245's ratio to the bar. Per-gun TTK at the M245 bar (270) and at 500 prints with M245_TABLE=1 (wilds-teeth runs the fight sim).
const M245_BAR = Math.round(150 * M245_CHAMP_SCALE)
/** seconds to land `hp` with the trigger held from a full clip, every pellet on, RELOADS INCLUDED (heldDps alone has none) */
const ttkReload = (g: RangeGun, hp: number) => { const per = g.pellets * g.damage, gap = per / heldDps(g), n = Math.ceil(hp / per - 1e-9); return (n - 1) * gap + Math.floor((n - 1) / g.clip) * g.reloadTime }
{ const t2: string[] = ['| gun | champion TTK body, 3 bars held: 270 -> 500 (s) | with reloads: 270 -> 500 (s) | head held (s) |', '|---|---|---|---|']
  for (const g of [...RANGE_GUNS, TWINS_GUN, GRINDER_GUN]) { const h = { ...g, damage: g.crit }
    t2.push(`| ${g.id} | ${(M245_BAR * bars / heldDps(g)).toFixed(1)} -> ${(CHAMP.barHp * bars / heldDps(g)).toFixed(1)} | ${ttkReload(g, M245_BAR * bars).toFixed(1)} -> ${ttkReload(g, CHAMP.barHp * bars).toFixed(1)} | ${(M245_BAR * bars / heldDps(h)).toFixed(1)} -> ${(CHAMP.barHp * bars / heldDps(h)).toFixed(1)} |`) }
  if (process.env.M245_TABLE) console.log('\nM245 s2:\n' + t2.join('\n')) }
ok(M245_CHAMP_SCALE === 1.8 && M245_BAR === 270, `the M245 bar was 150 x the default gun's ${M245_CHAMP_SCALE} = ${M245_BAR}`)
ok(CHAMP_BAR_HP === 500 && CHAMP.barHp === 500, `M245 s2: champion bar ${CHAMP.barHp} (Alex: 500)`)
ok(Math.abs(CHAMP_SCALE - 500 / 150) < 1e-12, 'the champion scale = the 500 bar over the pre-M245 150')
// the wave adds keep M245's ratio to the bar (54 / 270 and 36 / 270), to rounding
ok(WAVE_HP.shambler === Math.round(30 * CHAMP_SCALE) && WAVE_HP.floater === Math.round(20 * CHAMP_SCALE) && WAVE_HP.shambler === 100 && WAVE_HP.floater === 67, `wave adds ${JSON.stringify(WAVE_HP)} (54 / 36 at the 270 bar)`)
ok(Math.abs(WAVE_HP.shambler / CHAMP.barHp - Math.round(30 * M245_CHAMP_SCALE) / M245_BAR) < 0.002 && Math.abs(WAVE_HP.floater / CHAMP.barHp - Math.round(20 * M245_CHAMP_SCALE) / M245_BAR) < 0.002, 'wave adds : bar = M245\'s ratio')
void [mbn, mbo, mhn, mho, rb, rh]
ok(gun('lance').crit < CHAMP.barHp && gun('lance').crit < CRAWLER.hp * 2, 'a Lance head does NOT drop a champion bar or a merged (mass 2) crawler')
ok(CHAMP_DPS_MAX >= 216 * 1.3 * 2, 'the guest DPS cap fits two amped Lance heads a second')
void M245_DAMAGE

// (4) non-gun damage on a Hollow keeps its hits-to-kill (x 10/3)
ok(FIST_DMG === 20 && shots(SHAMBLER.hp, FIST_DMG) === shots(45, 6), `fist ${FIST_DMG}: a shambler takes ${shots(SHAMBLER.hp, FIST_DMG)} punches (was ${shots(45, 6)})`)
ok(Math.abs(FIGHT.hit - 5 * M245_HOLLOW_SCALE) < 1e-9 && shots(SHAMBLER.hp, FIGHT.hit) === shots(45, 5), `a spirit's hit ${FIGHT.hit.toFixed(2)}: ${shots(SHAMBLER.hp, FIGHT.hit)} hits on a shambler (was 9)`)
ok(Math.abs(FX.burnDps - 5 * M245_HOLLOW_SCALE) < 1e-9 && Math.abs(SHAMBLER.hp / FX.burnDps - 45 / 5) < 1e-9, 'burning: the same 9 s on a shambler')

console.log(`m245-damage: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
if (fails.length) process.exit(1)
