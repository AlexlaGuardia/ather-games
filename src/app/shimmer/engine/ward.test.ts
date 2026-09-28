/**
 * OVERPRESSURE — a shell that mends itself out of what it stops, and one flaw shatters it (moves.md).
 * Run: `npx tsx src/app/shimmer/engine/ward.test.ts`
 */
import { spawnField, absorbWardAt, absorbShotAt, absorbStrikeAtVolume, wardStrain, contains, resetFieldIds, type Field } from './field-effects'
import { castForMove, isBuilt, wardOf } from '../play3d/cast'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }
resetFieldIds()

const spec = castForMove('overpressure')
ok(isBuilt('overpressure'), '★★ Overpressure is built')
ok(spec.archetype === 'field' && spec.castRange === 0, 'it drops where the keeper stands')
ok(!spec.fieldStopsShots, 'a ward is NOT cover: the keeper\'s own shots leave it')
const ward = wardOf(spec)!
ok(!!ward && ward.mend > 0 && ward.mend < 1, 'it carries a ward that mends less than it takes')
ok(wardOf(castForMove('threshold')) === undefined && wardOf(castForMove('healing-grove')) === undefined, 'no other field is a ward')

const at = (fs: Field[]) => (f: Field) => contains(f, 0, 0)
const make = () => spawnField([], { moveId: 'overpressure', x: 0, y: 0, z: 0, radius: spec.areaSize, height: 3.5, secs: spec.areaSecs, dps: 0, hps: 0, stopsShots: false, hp: spec.fieldHp, ward }, 0)

// A. a blow inside: absorbed, banked, most of it paid back
let fs = make()
let r = absorbWardAt(fs, at(fs), 20)
ok(!!r.hit && r.spill === 0, 'a 20 blow on a fresh ward reaches nobody')
ok(r.fields[0].hp === spec.fieldHp - 20 + 20 * ward.mend, `★ it mends out of what it stopped (${r.fields[0].hp})`)
ok(r.fields[0].banked === 20, 'and banks the blow')
ok(absorbWardAt(fs, () => false, 20).spill === 20 && !absorbWardAt(fs, () => false, 20).hit, 'outside it, the blow lands whole')

// B. the flaw arrives before the shell wears through under steady fire (the danger scales with its strength)
fs = make()
let taken = 0, shattered: ReturnType<typeof absorbWardAt> | null = null
for (let i = 0; i < 100 && !shattered; i++) {
  r = absorbWardAt(fs, at(fs), 15); taken += 15
  if (r.broke) shattered = r; else fs = r.fields
}
ok(!!shattered && shattered.flawed, `★★ steady fire meets the FLAW, not wear (after ${taken})`)
ok(taken >= ward.flaw && taken < ward.flaw + 15, 'exactly at the flaw')
ok(shattered!.spill === ward.backlash && shattered!.fields.length === 0, `★ the shatter lands its backlash on the keeper (${shattered!.spill}) and the shell is gone`)
ok(taken - ward.backlash > spec.fieldHp * 2, 'net, it stopped far more than its own shell (a defence funded by the attack)')

// C. one blow bigger than the shell breaks it, the rest spills, no mend
fs = make()
r = absorbWardAt(fs, at(fs), spec.fieldHp + 30)
ok(r.broke && !r.flawed && r.spill === 30, 'a blow bigger than the shell breaks it; the rest spills')

// D. strain reads the pressure
fs = make(); r = absorbWardAt(fs, at(fs), 40)
ok(Math.abs(wardStrain(r.fields[0]) - 40 / ward.flaw) < 1e-9 && wardStrain(make()[0]) === 0, 'strain = banked / flaw')

// E. it is invisible to the cover readers (not a door, not a wall)
fs = make()
ok(!absorbShotAt(fs, 0, 0, 10).hit && !absorbStrikeAtVolume(fs, 0, 0, 0, 10).hit, 'shots and strikes pass the cover readers: only the body path asks a ward')
// F. never mends past its own shell
fs = make(); r = absorbWardAt(fs, at(fs), 1)
ok(r.fields[0].hp <= r.fields[0].hpMax, 'never mends past hpMax')

console.log(`ward: ${pass} passed, ${fails.length} failed`)
if (fails.length) { for (const f of fails) console.log('  ✗ ' + f); process.exit(1) }
