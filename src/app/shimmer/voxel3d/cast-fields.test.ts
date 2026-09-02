// ── The voxel cast-field ADAPTER — headless oracle ──────────────────────────────────────────────
// Run: npx tsx src/app/shimmer/voxel3d/cast-fields.test.ts
//
// ★ WHY THIS FILE EXISTS, AND IT IS NOT "more coverage for field-effects".
// `field-effects.ts` is pure and well tested — spawn, expire, tick-resync, the cap, and (since the
// voxel port) the slab. None of that is the thing that can quietly break here.
//
// What can break is the ARITHMETIC BETWEEN TWO MODULES THAT DO NOT IMPORT EACH OTHER. A field is
// grounded at `columnHeight + 1` with `FIELD_HEIGHT` above it and `FIELD_UNDERBITE` below. A Hollow
// floats at `HOLLOW_HOVER` above the same ground line. Whether a Firewall actually burns the thing
// drifting into it is decided entirely by those four numbers overlapping — and NOTHING references
// both sets. Retune `HOLLOW_HOVER` for a better silhouette, or trim `FIELD_UNDERBITE`, and every
// damaging field in the game silently stops connecting. The bug reads as "fields do nothing", which
// is indistinguishable from the port never having worked, and no existing test would move.
//
// This is the same family as the 07-07 watchdog probe-calibration lesson: two independently sensible
// numbers, no single place that asserts they still mean what the feature needs.

import { spawnField, containsVolume, blocksShotAtVolume, absorbShotAtVolume, absorbShotAt, FIELD_HEIGHT, FIELD_UNDERBITE } from '../engine/field-effects'
import { castForMove } from '../play3d/cast'
import { readFileSync } from 'node:fs'
import { noComments } from '../testing/guard'
import { HOLLOW_HOVER, HOLLOW_RADIUS, HOLLOW_FORMS, FORM_ORDER } from './hollows'

let ok = 0, bad = 0
const chk = (n: string, c: boolean, x = '') => { c ? ok++ : (bad++, console.error('  FAIL:', n, x)) }

const T0 = 1_000_000
/** What the host does: ground the slab one above the column top, exactly as `castSlot` computes it. */
const GROUND = 64
const fieldAt = (x: number, z: number, radius: number, dps: number, hps: number, stops: boolean) =>
  spawnField([], {
    moveId: 'test', x, y: GROUND + 1, z, radius, height: FIELD_HEIGHT,
    secs: 6, dps, hps, stopsShots: stops, hp: 0,
  }, T0)[0]

// ── 1. ★ THE OVERLAP THE WHOLE FEATURE RESTS ON ────────────────────────────────────────────────
//
// ⚠ UPDATED 2026-08-14 (same day): this section originally tested ONE body height, `HOLLOW_HOVER`,
// because every form hovered. Alex then ruled the melee forms WALK (goopy bipedal creatures; only
// the ranged caster floats), which split one body height into two — and a test that only pins the
// floater would have gone on passing while a Firewall missed 7 of every 9 Hollows. So this now walks
// the form table itself: **add a fourth form and it is checked automatically.**
{
  const f = fieldAt(10, 10, 3.2, 12, 0, true)
  // A Hollow drifting across the field, standing on the same ground the cast landed on. `hollowStep`
  // parks a body at `ground + 1 + form.hover`, so that is the height a field has to reach.
  const bodyY = (form: keyof typeof HOLLOW_FORMS) => GROUND + 1 + HOLLOW_FORMS[form].hover

  for (const form of FORM_ORDER) {
    const y = bodyY(form)
    chk(`★ a ${form} on the field's own ground line IS inside the slab`,
      containsVolume(f, 10, y, 10), `body y=${y} vs slab ${f.y - FIELD_UNDERBITE}..${f.y + f.height}`)
    // The margins, stated rather than assumed — so a retune that eats them fails HERE and says why.
    //
    // ⚠ THE TWO BODY TYPES ARE AT RISK FROM OPPOSITE EDGES, and writing one assert for both is how I
    // got this wrong on the first run. A FLOATER can rise out of the top of the slab, so headroom is
    // its margin. A WALKER stands on the cast's own ground line, so it has no room below by
    // construction — its margin IS the underbite, which exists precisely so a body in a one-block
    // terrain dip stays in the fire. Demanding "more than 1 below" of a walker is demanding it hover.
    chk(`...${form}: real headroom above it, not by a hair`,
      (f.y + f.height) - y > 1, `headroom ${((f.y + f.height) - y).toFixed(2)}`)
    chk(`...${form}: the full underbite is available beneath it (terrain dips are covered)`,
      y - (f.y - FIELD_UNDERBITE) >= FIELD_UNDERBITE, `underroom ${(y - (f.y - FIELD_UNDERBITE)).toFixed(2)}`)
  }
  // The two body heights are genuinely different, so the loop above is testing two cases and not the
  // same one three times — the assert that gives the loop its teeth.
  chk('a walker and the floater sit at DIFFERENT heights (so the loop covers two cases)',
    bodyY('stalker') !== bodyY('caster'))
  chk('the floater is the higher of the two, i.e. the one at risk of clearing the slab',
    bodyY('caster') > bodyY('stalker') && HOLLOW_HOVER > 0)

  // A Hollow whose CENTRE is just outside still overlaps by its body radius. Worth pinning: the host
  // tests the centre point, so the effective bite is radius + HOLLOW_RADIUS and that is deliberate,
  // not a slop bug — a body half in the fire is in the fire.
  chk('the host tests a Hollow\'s CENTRE, so its body radius is bite it gets for free',
    !containsVolume(f, 10 + 3.2 + 0.01, bodyY('stalker'), 10) && HOLLOW_RADIUS > 0)
}

// ── 2. verticality is the reason the slab exists ────────────────────────────────────────────────
{
  const f = fieldAt(0, 0, 4, 10, 0, true)
  chk('a Hollow in the cave BELOW the cast is not burned', !containsVolume(f, 0, GROUND - 6, 0))
  chk('a Hollow on the ridge ABOVE the cast is not burned', !containsVolume(f, 0, GROUND + 1 + FIELD_HEIGHT + 2, 0))
  chk('a round crossing the ridge above a Firewall is not eaten',
    !blocksShotAtVolume([f], 0, GROUND + 1 + FIELD_HEIGHT + 2, 0))
  chk('a round at a walker\'s body height IS eaten (Firewall is cover)',
    blocksShotAtVolume([f], 0, GROUND + 1, 0))
  chk('...and at the floater\'s body height too', blocksShotAtVolume([f], 0, GROUND + 1 + HOLLOW_HOVER, 0))
}

// ── 3. the keeper's own feet, which is what a grove has to mend ─────────────────────────────────
{
  const grove = fieldAt(5, 5, 5.5, 0, 14, false)
  // `loco.py` is the FEET, and the host passes it — a grove you are standing in must count.
  chk('a keeper standing in a grove is inside it', containsVolume(grove, 5, GROUND + 1, 5))
  chk('...and one standing a step outside is not', !containsVolume(grove, 5 + 6, GROUND + 1, 5))
  chk('a grove is NOT cover — you can be shot standing in it',
    !blocksShotAtVolume([grove], 5, GROUND + 1, 5))
}

// ── 4. the ground line is the CAST's, not the caster's ─────────────────────────────────────────
// Cast downhill: the field stands on the lower ground it landed on. If the host ever anchors to the
// camera again, a Hollow standing at the bottom of the slope stops being hit and the fire visibly
// floats — this asserts the intent so the regression has a name.
{
  const downhill = 8
  const f = spawnField([], {
    moveId: 'test', x: 0, y: GROUND - downhill + 1, z: 0, radius: 3, height: FIELD_HEIGHT,
    secs: 6, dps: 10, hps: 0, stopsShots: false, hp: 0,
  }, T0)[0]
  chk('a field cast downhill bites at the LOWER ground line',
    containsVolume(f, 0, GROUND - downhill + 1, 0))
  chk('...and not up at the keeper\'s own feet', !containsVolume(f, 0, GROUND + 1, 0))
}

console.log('\n── ★ shield hit points: a shell pays for what it eats (ruled by Alex 2026-09-02) ──')
{
  const th = castForMove('threshold'), fw = castForMove('firewall')
  chk('Threshold is a SHELL — cover with hit points', th.fieldStopsShots && th.fieldHp > 0)
  chk('Firewall is cover that does not break — a round does not shatter fire', fw.fieldStopsShots && fw.fieldHp === 0)
  const shell = (hp: number) => spawnField([], { moveId: 'threshold', x: 0, y: GROUND, z: 0, radius: 2.4, height: FIELD_HEIGHT,
    secs: 5, dps: 0, hps: 0, stopsShots: true, hp }, 0)
  // three light rounds against a 20-point door
  let fs = shell(20)
  const r1 = absorbShotAtVolume(fs, 0, GROUND + 1, 0, 9)
  chk('a light round is eaten and the shell pays for it', r1.hit !== null && !r1.broke && r1.fields[0].hp === 11, `hp ${r1.fields[0]?.hp}`)
  const r2 = absorbShotAtVolume(r1.fields, 0, GROUND + 1, 0, 9)
  chk('...still cover at 2 hp', r2.hit !== null && !r2.broke && r2.fields.length === 1 && r2.fields[0].hp === 2)
  const r3 = absorbShotAtVolume(r2.fields, 0, GROUND + 1, 0, 9)
  chk('★ the third round SHATTERS it — the field is gone, whatever its clock says', r3.hit !== null && r3.broke && r3.fields.length === 0)
  const r4 = absorbShotAtVolume(r3.fields, 0, GROUND + 1, 0, 9)
  chk('...and the next round passes through the gap', r4.hit === null)
  // one hard blow
  const hard = absorbShotAtVolume(shell(20), 0, GROUND + 1, 0, castForMove('keenshard').damage)
  chk('★ canon: "gone at the first hard blow" — one Keenshard takes the door', hard.broke, `keenshard ${castForMove('keenshard').damage} vs ${th.fieldHp}`)
  // unbreakable cover and non-cover
  const wall = spawnField([], { moveId: 'firewall', x: 0, y: GROUND, z: 0, radius: 3, height: FIELD_HEIGHT, secs: 6, dps: 12, hps: 0, stopsShots: true, hp: 0 }, 0)
  const w1 = absorbShotAtVolume(wall, 0, GROUND + 1, 0, 999)
  chk('unbreakable cover eats the round and is unchanged', w1.hit !== null && !w1.broke && w1.fields === wall)
  const grove = spawnField([], { moveId: 'healing-grove', x: 0, y: GROUND, z: 0, radius: 3, height: FIELD_HEIGHT, secs: 6, dps: 0, hps: 5, stopsShots: false, hp: 50 }, 0)
  chk('a grove never absorbs, hp or not — it is not cover', absorbShotAtVolume(grove, 0, GROUND + 1, 0, 9).hit === null)
  chk('a round over the ridge above a shell is not absorbed (the slab still has a height)',
    absorbShotAtVolume(shell(20), 0, GROUND + 1 + FIELD_HEIGHT + 2, 0, 9).hit === null)
  chk('the 2D reader (play3d) charges the shell the same way', absorbShotAt(shell(20), 0, 0, 9).fields[0].hp === 11)
  chk('★ a zero-damage round costs nothing — and does not go negative-into-healing', absorbShotAt(shell(20), 0, 0, -5).fields[0].hp === 20)
}

console.log('\n── ★ the hosts ask the reader with the bill attached, not the free one ──')
{
  const vw = noComments(readFileSync('src/app/shimmer/voxel3d/VoxelWorld.tsx', 'utf8'))
  const s3 = noComments(readFileSync('src/app/shimmer/play3d/Shimmer3D.tsx', 'utf8'))
  const count = (src: string, re: RegExp) => (src.match(new RegExp(re.source, 'g')) || []).length
  chk('voxel: the shot site charges the shell with the round\'s damage, once', count(vw, /absorbShotAtVolume\(fields\.current, sh\.x, sh\.y, sh\.z, sh\.dmg\)/) === 1)
  chk('voxel: no shot site still asks the free query', count(vw, /blocksShotAtVolume\(/) === 0)
  chk('voxel: the spawn hands the spec\'s hp in', count(vw, /hp: out\.placed\.fieldHp/) === 1)
  chk('voxel: a shattered shell says so', count(vw, /shattered/) === 1)
  chk('play3d: both shot sites charge the shell (gun + drone)', count(s3, /absorbShotAt\(fieldsRef\.current/) === 2 && count(s3, /blocksShotAt\(/) === 0)
  chk('play3d: the spawn hands the spec\'s hp in', count(s3, /hp: pending\.fieldHp/) === 1)
}

console.log(`\nvoxel cast-field adapter: ${ok} passed, ${bad} failed`)
process.exit(bad ? 1 : 0)
