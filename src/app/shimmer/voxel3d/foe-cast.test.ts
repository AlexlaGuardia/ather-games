// The CAST KIT REACHES A PATROL — the wiring (2026-09-10, #294).
// Run: npx tsx src/app/shimmer/voxel3d/foe-cast.test.ts
//
// Row #294 said "build real-time world enemies so runes ARE the combat". Measured: the enemies
// existed since 08-16 and a cast PROJECTILE already struck a collar. What was actually missing was
// narrower and invisible from the pure oracles — the field loop, the status loop, the cloak and the
// tremor tick each iterated `hollows.current` ALONE, so casting Grove Fire onto a patrol did nothing
// and said nothing, which reads as the cast being broken. `collar-foes.test.ts` proves the RULE
// (`answerCollar`, `strike`, `FoeImpair`); this file proves each host path ASKS it.
//
// ⚠ EVERY ASSERT HERE READS SOURCE, and a source assert is satisfied by text anywhere in an
// 11k-line file. So each one is scoped to the block it belongs to, and the block is located by a
// string that appears exactly once — a slice that came back empty is reported by name, never
// passed vacuously (the 09-04 lesson: two suites went '' and green when their anchors moved).

import { readFileSync } from 'node:fs'
import { noComments } from '../testing/guard'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length

const raw = readFileSync(new URL('./VoxelWorld.tsx', import.meta.url), 'utf8')
const src = noComments(raw)

/** the source between two anchors, each of which must appear exactly once — or '' and a named failure */
function between(startAnchor: string, endAnchor: string, label: string): string {
  const a = src.indexOf(startAnchor), b = src.indexOf(endAnchor, a + 1)
  const aN = count(src, new RegExp(startAnchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))
  ok(a >= 0 && b > a && aN === 1, `${label}: anchored (start ×${aN} at ${a}, end at ${b})`)
  return a >= 0 && b > a ? src.slice(a, b) : ''
}

// ── 1. ONE DOOR ─────────────────────────────────────────────────────────────────────────────────
{
  const door = between('const contestCollar = (', 'const foeFreedMat', 'the door')
  ok(door.length > 0 && /answerCollar\(e\.f, delivery\)/.test(door), 'the door asks answerCollar with the delivery it was handed')
  ok(/strike\(e\.f, amount\)/.test(door), 'and strikes by the amount it was handed — a field\'s dps, a round\'s dmg, a burn, or 0')
  ok(/foeFreed\.current\[e\.hold\] = \(foeFreed\.current\[e\.hold\] \?\? 0\) \+ 1/.test(door), 'the permanent count is written in the door, on the freeing strike')
  ok(/clearTarget\(statusBag\.current, e\.f\.id\)/.test(door), 'a freed foe drops its statuses — the contest is over')
  for (const line of ['you would hurt him', 'you cannot give a choice back', 'out-contested', 'it is a rune he needs, not a bullet'])
    ok(count(src, new RegExp(line, 'g')) === 1 && door.includes(line), `the refusal line "${line}" is written ONCE, in the door`)
  ok(/leadSaid\.current > 6000/.test(door), 'the refusal throttle is the shared 6s clock')
  // ⚠ no second copy of the freed beat anywhere: the shot path used to carry it
  ok(count(src, /the collar gives — the spirit goes free/g) === 1, '★ the freed line exists exactly once — the shot site no longer restates it')
  ok(count(src, /contestCollar\(g, e, /g) >= 5, `★ at least five paths come through the door (${count(src, /contestCollar\(g, e, /g)}): shot, field, status, cloak ×2`)
}

// ── 2. THE SHOT PATH still comes through it, and lets a freed one pass ──────────────────────────
{
  const shots = between('for (const e of foes.current) {\n          if (!hostile(e.f)) continue', 'if (absorbed) continue\n        const hit = raycast', 'the shot path')
  ok(/if \(contestCollar\(g, e, sh\.delivery, sh\.dmg\) === 'not-a-target'\) continue/.test(shots), '★ a round asks the door with its delivery + dmg, and passes through a freed Moglin')
  ok(!/answerCollar\(/.test(shots) && !/strike\(/.test(shots), 'and no longer restates the rule inline')
}

// ── 3. FIELDS bite a patrol standing in them ────────────────────────────────────────────────────
{
  const fields = between('for (const fd of ticked.fired) {', 'if (fd.hps > 0 && containsVolume(fd, lc.px, lc.py, lc.pz))', 'the field tick')
  ok(/for \(const e of foes\.current\) \{\s*if \(!hostile\(e\.f\) \|\| !e\.spirit\) continue/.test(fields), '★ the field loop reaches the patrols, hostile ones with a spirit to test')
  ok(/containsVolume\(fd, sp\.position\.x, sp\.position\.y - 0\.95, sp\.position\.z\)/.test(fields), '★ tested against the SPIRIT\'s feet — the Moglin is never the target')
  ok(/contestCollar\(g, e, collarClassOf\(fd\.moveId\), fd\.dps\)/.test(fields), '★ and asks the door with the FIELD\'s own move class and its dps')
  ok(!/e\.f\.collar/.test(fields) && !/\.hp -= /.test(fields.slice(fields.indexOf('foes.current'))), 'nothing in the foe half touches integrity or an hp directly')
}

// ── 4. STATUSES ask before they hold ────────────────────────────────────────────────────────────
{
  const st = between("let caught = 0\n      for (const hw of hollows.current) {", "onSay(caught > 0", 'the status cast')
  ok(/for \(const e of foes\.current\) \{\s*if \(!hostile\(e\.f\)\) continue/.test(st), '★ the status loop reaches the patrols')
  ok(/if \(contestCollar\(g, e, collarClassOf\(out\.placed\.moveId\), 0\) !== 'opens'\) continue/.test(st), '★ a status asks the door with amount 0 and lands only on `opens` — control is refused with its line')
  ok(/applyStatuses\(statusBag\.current, e\.f\.id, kinds, out\.placed\.areaSecs, env\.now\)/.test(st), 'a status that opens is applied to the FOE\'s id in the same bag the Hollows use')
  ok(count(st, /caught\+\+/g) === 2, 'and it counts toward "N held" — a status that landed on a patrol is not "nothing in reach"')
}

// ── 5. THE FOE TICK reads the bag, and the cloak answers a press ────────────────────────────────
{
  const tick = between("prof.current.mark('world:foes')", "prof.current.mark('world:guard')", 'the foe tick')
  for (const k of ['rooted', 'blinded', 'disarmed'])
    ok(new RegExp(`${k}: hasStatus\\(statusBag\\.current, e\\.f\\.id, '${k}', foeNowMs\\)`).test(tick), `★ the step context carries \`${k}\` off the status bag`)
  ok(/impair: \{/.test(tick), 'as the pure brain\'s `impair`')
  const cloak = tick.slice(tick.indexOf('if (intent.pressing && vitals.current) {'))
  ok(/cloak\.current\.charge > 0 && foeDef\(e\.f\.posture\)\.body > 0/.test(cloak), '★ the cloak fires on a PRESS by a foe with a body — a channeler (body 0) never touches you')
  ok(/const cls = collarClassOf\('flame-cloak'\)/.test(cloak), 'and asks the class of the cloak\'s own move')
  ok(/if \(answerCollar\(e\.f, cls\) === 'opens'\) \{\s*const ig = cloakIgnite/.test(cloak), '★ the charge is spent ONLY if the collar opens — a refusal does not fire the cloak')
  ok(/if \(ig\.burn > 0\) contestCollar\(g, e, cls, ig\.burn\)/.test(cloak), 'and the burn goes to the collar through the door')
  ok(/\} else contestCollar\(g, e, cls, 0\)/.test(cloak), 'a refused cloak still SAYS why, through the same throttle')
  ok(cloak.indexOf('cloakIgnite') < cloak.indexOf('pressure(vitals.current'), 'the cloak answers before the press is billed — the order a contact reads in')
}

// ── 6. TREMOR SENSE feels a patrol ──────────────────────────────────────────────────────────────
{
  const tremor = between('tremorBodies.length = 0', 'r.contacts = senseGround(tremorBodies', 'the tremor tick')
  ok(/for \(const e of foes\.current\) \{\s*tremorBodies\.push\(\{ x: e\.f\.x, y: e\.y, z: e\.f\.z, hover: 0, present: hostile\(e\.f\) \}\)/.test(tremor),
     '★ every patrol is pushed with hover 0 (a Moglin walks) and present = hostile (a freed one is nobody\'s contact)')
  ok(/hover: formOf\(st\)\.hover/.test(tremor), 'control: the Hollow push still reads its form\'s hover — never 0, that field IS the canon limitation')
}

// ── 7. DESPAWN drops the statuses with the body ─────────────────────────────────────────────────
{
  const drop = between('const dropFoe = (i: number) => {', 'foes.current.splice(i, 1)', 'dropFoe')
  ok(/clearTarget\(statusBag\.current, e\.f\.id\)/.test(drop), '★ a foe that leaves the world takes its statuses with it — the bag never holds a ghost')
}

console.log(`foe-cast: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length === 0 ? 0 : 1)
