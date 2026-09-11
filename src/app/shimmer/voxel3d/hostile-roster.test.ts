// Hostile-roster oracle. Run: npx tsx src/app/shimmer/voxel3d/hostile-roster.test.ts
//
// Three things, in order of what would hurt most if they went wrong:
//   1. THE ORDER IN THE HOST. The roster is asked AFTER `hollowEligible` and can only `continue`.
//      Read off `VoxelWorld.tsx` source, anchored on statements — a roster that ran first, or
//      that replaced the ruling, would be a Hollow on untouched ground wearing a lookup table.
//   2. THE TABLE BEHAVES: exhaustive over every zone, fails closed on unknown ground, restricted
//      rolls never leave the list, the default roll is byte-identical to before.
//   3. THE TABLE STANDS ON REAL GROUND: the grid sweep that sized it is re-run here, so an entry
//      that refuses ground which has begun to yield goes RED and asks for a decision, and an
//      entry that acts on almost nothing says so in the output rather than looking load-bearing.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HOSTILE_ROSTERS, WILD, groundAt, hostileRosterFor, holdsOn, hostileReadout, type HostileGround } from './hostile-roster'
import { FORM_ORDER, PACK_MAX, HOLLOW_GREY_MIN, pickForm, type HollowForm } from './hollows'
import { ZONE_ANCHORS } from '../voxel/zones'
import { greyness } from '../voxel/biome'
import { HOLDS } from '../voxel/holds'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const SEED = 1337

// ── 1. ★★★ THE HOST ASKS THE RULING FIRST AND THE ROSTER SECOND ────────────────────────────────
{
  const src = readFileSync(join(__dirname, 'VoxelWorld.tsx'), 'utf8')
  // The anchor block: from the sweep gate to the end of the mate loop. Anchored on the same gate
  // string hollow-wiring.test.ts asserts exists, so a moved anchor names itself rather than going quiet.
  const GATE = 'if (hollows.current.length < cap && hollowClock.current <= 0)'
  const g0 = src.indexOf(GATE)
  ok(g0 > 0, '★★ the sweep gate is findable')
  const sweep = src.slice(g0, g0 + 9000)
  const iRule = sweep.indexOf('if (!hollowEligible(wx + 0.5, wz + 0.5, SEED')
  const iRoster = sweep.indexOf('const roster = hostileRosterFor(groundAt(wx + 0.5, wz + 0.5, SEED).ground)')
  const iRefuse = sweep.indexOf('if (!roster.forms.length) continue')
  const iPack = sweep.indexOf('Math.min(packSize(Math.random()), roster.pack, cap - hollows.current.length)')
  const iSpawn = sweep.indexOf('spawnHollow(wx + 0.5, sh, wz + 0.5, undefined, roster.forms)')
  ok(iRule > 0 && iRoster > 0 && iRefuse > 0 && iPack > 0 && iSpawn > 0,
     `★★ every statement of the roster wiring is findable (rule ${iRule} roster ${iRoster} refuse ${iRefuse} pack ${iPack} spawn ${iSpawn})`)
  ok(iRule < iRoster, '★★★ the RULING (hollowEligible) is asked BEFORE the roster — the roster filters, it never sources')
  ok(iRoster < iRefuse && iRefuse < iPack && iPack < iSpawn,
     '★★ roster → refuse-if-empty → pack ceiling → spawn, in that order')
  // The roster must not appear anywhere before the ruling inside the anchor's column walk.
  ok(!/hostileRosterFor/.test(sweep.slice(0, iRule)), '★★★ no roster lookup precedes the ruling in the sweep')
  // The ruling is still a `continue` — the roster did not swallow it into a combined predicate.
  ok(/if \(!hollowEligible\(wx \+ 0\.5, wz \+ 0\.5, SEED[\s\S]{0,120}?\)\) continue/.test(sweep),
     '★★ the ruling still stands on its own `continue`')
  // Mates: re-checked against their OWN ground, and spawned with the ANCHOR's forms.
  const iMateRule = sweep.indexOf('if (!hollowEligible(mx, mz, SEED')
  const iMateRoster = sweep.indexOf('if (!hostileRosterFor(groundAt(mx, mz, SEED).ground).forms.length) continue')
  const iMateSpawn = sweep.indexOf('spawnHollow(mx, mfy - 1, mz, undefined, roster.forms)')
  ok(iMateRule > 0 && iMateRoster > iMateRule && iMateSpawn > iMateRoster,
     '★★ a pack mate is ruled, then asked its own ground\'s roster, then spawned with the anchor\'s forms')
  // The console's own spawn passes NO roster: a test spawn is the whole mix in front of the keeper.
  ok(/spawnHollow\(sx, sh, sz, req\.form\)/.test(src), 'the /hollow harness spawns with no roster (the wild mix, on purpose)')
  // And /hostiles reads the same floor the ruling uses, at the keeper, with the live counts.
  ok(/hostiles: \(\) => hostileReadout\(camera\.position\.x, camera\.position\.z, SEED, HOLLOW_GREY_MIN,/.test(src),
     '★ /hostiles prints against HOLLOW_GREY_MIN — the same floor the ruling reads, not a copy')
}

// ── 2. the table behaves ─────────────────────────────────────────────────────────────────────
{
  const grounds: HostileGround[] = [...ZONE_ANCHORS.map(a => a.id), WILD]
  for (const gnd of grounds) {
    const r = HOSTILE_ROSTERS[gnd]
    ok(!!r, `${gnd}: has a roster entry (a new zone must be ruled here, not defaulted)`)
    if (!r) continue
    ok(r.forms.every(f => FORM_ORDER.includes(f)), `${gnd}: every form is a real form`)
    ok(new Set(r.forms).size === r.forms.length, `${gnd}: no form listed twice`)
    ok(r.forms.length ? r.pack >= 1 && r.pack <= PACK_MAX : r.pack === 0,
       `${gnd}: pack ${r.pack} is 1..${PACK_MAX} when it yields and 0 when it does not`)
  }
  ok(Object.keys(HOSTILE_ROSTERS).length === grounds.length, `exactly ${grounds.length} grounds — no orphan entry for a zone that does not exist`)
  ok(HOSTILE_ROSTERS.wild.forms.length === FORM_ORDER.length && HOSTILE_ROSTERS.wild.pack === PACK_MAX,
     '★ wild country keeps the FULL mix and the full pack — the weights hollows.test.ts pins are the wild night')
  // Fail closed.
  ok(hostileRosterFor(null).forms.length === 0 && hostileRosterFor(undefined).forms.length === 0,
     '★ unknown ground yields NOTHING')
  ok(hostileRosterFor('no-such-zone' as HostileGround).forms.length === 0, '★ an unlisted id yields NOTHING, never the wild mix')
  // Rolls over a restricted list never leave it, and every listed form is reachable.
  const only = (forms: readonly HollowForm[]) => {
    const seen = new Set<HollowForm>()
    for (let i = 0; i < 300; i++) seen.add(pickForm(i / 300, forms))
    return seen
  }
  const sc = only(['stalker', 'caster'])
  ok(sc.size === 2 && !sc.has('warden'), 'a stalker+caster roster rolls both and never a warden')
  ok([...only(['warden'])].join() === 'warden', 'a one-form roster always rolls that form')
  ok([...only(['caster'])].join() === 'caster', '…and the last form alone rolls itself (the tail is not FORM_ORDER\'s tail)')
  let threw = false
  try { pickForm(0.5, []) } catch { threw = true }
  ok(threw, '★ an EMPTY roster throws — the spawner must refuse before rolling, never get a default form')
  // The default roll is byte-identical to the pre-roster one.
  let same = true
  for (let i = 0; i < 200; i++) if (pickForm(i / 200) !== pickForm(i / 200, FORM_ORDER)) same = false
  ok(same, '★ pickForm(roll) with no roster is exactly the wild roll')
}

// ── 3. derived patrols: every hold on exactly one ground ──────────────────────────────────────
{
  const grounds: HostileGround[] = [...ZONE_ANCHORS.map(a => a.id), WILD]
  const seen = new Map<string, HostileGround[]>()
  for (const gnd of grounds) for (const h of holdsOn(gnd, SEED)) seen.set(h.id, [...(seen.get(h.id) ?? []), gnd])
  ok(seen.size === HOLDS.length, `every hold stands on some ground (${seen.size}/${HOLDS.length})`)
  ok([...seen.values()].every(v => v.length === 1), 'no hold stands on two grounds')
  for (const h of HOLDS) console.log(`  hold ${h.id.padEnd(13)} → ${seen.get(h.id)?.[0]}  grey ${greyness(h.x, h.z, SEED).toFixed(2)}`)
}

// ── 4. ★★ THE TABLE STANDS ON MEASURED GROUND — the sizing sweep, re-run ─────────────────────
{
  const STEP = 32
  const stat = new Map<HostileGround, { n: number; grey: number }>()
  for (let x = -4200; x <= 5200; x += STEP) for (let z = -4200; z <= 3200; z += STEP) {
    const { ground } = groundAt(x, z, SEED)
    const s = stat.get(ground) ?? { n: 0, grey: 0 }
    s.n++
    if (greyness(x, z, SEED) >= HOLLOW_GREY_MIN) s.grey++
    stat.set(ground, s)
  }
  for (const [gnd, s] of stat) {
    const pct = 100 * s.grey / s.n
    const r = HOSTILE_ROSTERS[gnd]
    const tag = !r.forms.length ? 'yields nothing' : pct < 1 ? '⚠ acts on almost no ground' : ''
    console.log(`  ${gnd.padEnd(17)} ${String(s.n).padStart(6)} cells  ${pct.toFixed(1).padStart(5)}% hollow-grade grey  [${r.forms.join(' ') || '—'}] pack ${r.pack}  ${tag}`)
    // ★ An EMPTY roster over ground that has begun to yield is a decision, not a default. Red
    // here means a terrain retune greyed a zone this table refuses — rule it, do not widen silently.
    if (!r.forms.length) ok(pct < 1, `★ ${gnd} yields nothing AND has <1% hollow-grade grey (${pct.toFixed(1)}%) — if this is red, the ground changed under the table`)
  }
  ok((stat.get(WILD)?.grey ?? 0) > 0, 'wild country has hollow-grade grey — the bulk entry is live')
  ok((stat.get('the-outfields')?.grey ?? 0) > 0, 'the Outfields have hollow-grade grey — the hardest entry is live')
  ok((stat.get('twilight-thicket')?.grey ?? 0) > 0, 'the Thicket edge has hollow-grade grey — the stalker entry is live')
}

// ── 5. the readout says the four things and nothing false ────────────────────────────────────
{
  const brack = HOLDS.find(h => h.id === 'brack-hold')!
  const wild = hostileReadout(brack.x, brack.z, SEED, HOLLOW_GREY_MIN, { hollows: 2, foes: 3 })
  ok(/wild country/.test(wild), 'at Brack the readout says wild country')
  ok(/warden · stalker · caster · pack ≤ 4/.test(wild), '…and the full mix')
  ok(/brack/.test(wild) && /vetch/.test(wild) && /thistle/.test(wild), '…and names the three holds on that ground')
  ok(/drained enough/.test(wild) && !/NOT drained/.test(wild), '…and Brack\'s ground (grey 1.00) is drained enough')
  ok(/2 hollow\(s\) · 3 collared foe\(s\)/.test(wild), '…and the live counts are the ones passed in')
  const vil = ZONE_ANCHORS.find(a => a.id === 'gloview-village')!
  const village = hostileReadout(vil.x, vil.z, SEED, HOLLOW_GREY_MIN, { hollows: 0, foes: 0 })
  ok(/gloview-village \(membership 1\.00\)/.test(village), 'at the village heart the readout names the zone at full membership')
  ok(/nothing — this ground yields no Hollow/.test(village), '…and says it yields nothing')
  ok(/NOT drained enough/.test(village), '…and that the ground is not drained')
  ok(/none on this ground/.test(village), '…and that no hold stands there')
}

console.log(fails.length ? `❌ hostile-roster: ${pass} pass, ${fails.length} fail\n  - ${fails.join('\n  - ')}` : `✅ hostile-roster: ${pass} pass, 0 fail`)
if (fails.length) process.exit(1)
