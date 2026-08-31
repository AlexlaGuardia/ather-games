// ── Flame Cloak — headless oracle ───────────────────────────────────────────────────────────────
// Run: npx tsx src/app/shimmer/play3d/flame-cloak.test.ts
//
// In order of what it would cost to lose:
//   1. THE SURFACE PREDICATE — a body with no contact line can never ignite the cloak. It is the
//      only thing keeping the move inside canon (*"punishes grapplers and melee rushers"*), and the
//      obvious wiring gets it wrong in a way that looks right: the host's contact event is gated on
//      the form's REACH, and the caster's reach is 7.5 metres.
//   2. THE ACCUMULATION — canon names two runes doing two jobs (Static builds, Star ignites). If
//      this collapses to a flat reflect, the move still "works" and plays like a different one.
//   3. THE HOST — a stance whose only effect is a number nothing reads is a silent no-op, which is
//      the failure `cast.ts`'s honesty rule exists to forbid.

import { readFileSync } from 'node:fs'
import { castForMove, isBuilt } from './cast'
import { CLOAK_BURN, CLOAK_REBUILD, freshCloak, cloakBuild, cloakIgnite } from './flame-cloak'
import { HOLLOW_FORMS, FORM_ORDER } from '../voxel3d/hollows'

let ok = 0, bad = 0
const chk = (n: string, c: boolean, x = '') => { c ? ok++ : (bad++, console.error('  FAIL:', n, x)) }
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps
/** A cloak charged for `secs`, through the real builder rather than by writing the field. */
const charged = (secs: number) => cloakBuild(freshCloak(), secs, CLOAK_BURN, CLOAK_REBUILD)
const FULL = charged(CLOAK_BURN / CLOAK_REBUILD)

// ── 1. the move ────────────────────────────────────────────────────────────────────────────────
{
  const spec = castForMove('flame-cloak')
  chk('Flame Cloak is built', isBuilt('flame-cloak'), spec.why ?? '')
  chk('...as a worn stance, like every other canon passive', spec.archetype === 'stance')
  chk('...it holds heat, which is the only thing that makes it this move', spec.cloakBurn > 0)
  chk('...and it rebuilds, or Static accumulation is not implemented', spec.cloakRebuild > 0)

  // ★ THE IDENTITY ASSERT. Canon's Molten Shell is a BARRIER ("draining to maintain") and carries
  // resist; Flame Cloak is SKIN. Giving it resist would make it strictly better than its sibling and
  // delete the trade — the reason the old `unbuilt` note called it "aura only, with no shell".
  chk('★ it grants NO resist — it is skin, not a shell, and that is the whole trade',
    spec.resist === 0)
  chk('...and its built sibling Molten Shell DOES carry one, or the contrast is imaginary',
    castForMove('molten-shell').resist > 0)
  chk('free to hold — canon states no cost and the drain belongs to the shell pair',
    spec.manaCost === 0 && spec.regenMult === 1)

  const strays = ['barrier', 'molten-shell', 'iron-skin', 'tremor-sense', 'mend']
    .filter((id) => castForMove(id).cloakBurn !== 0 || castForMove(id).cloakRebuild !== 0)
  chk('no other move holds heat', strays.length === 0, strays.join())
}

// ── 2. ★★★ THE SURFACE PREDICATE ───────────────────────────────────────────────────────────────
{
  chk('a body with a surface ignites the cloak', cloakIgnite(FULL, 0.85).burn > 0)
  chk('★★★ a body with NO surface can never ignite it, however charged',
    cloakIgnite(FULL, 0).burn === 0)
  chk('...nor can a negative one', cloakIgnite(FULL, -1).burn === 0)
  chk('...and the cloak is left UNSPENT when it does not fire — no silent discharge',
    cloakIgnite(FULL, 0).cloak.charge === FULL.charge)

  // Against the shipped roster, so a form moved on or off a body surfaces here as a design change.
  const burns = FORM_ORDER.filter((f) => cloakIgnite(FULL, HOLLOW_FORMS[f].body).burn > 0)
  chk('the warden — the presser — burns', burns.includes('warden'))
  chk('the stalker — the melee rusher canon names — burns', burns.includes('stalker'))
  chk('★★★ the caster does NOT burn: it has no surface, and its reach is 7.5m',
    !burns.includes('caster'), burns.join())

  // ⚠ THE TRAP THIS EXISTS FOR, STATED AS AN ASSERT. Wiring on "took a hit" rather than on a
  // surface would burn the caster, because `hollowTouching` gates on REACH and the caster's is the
  // longest in the game. If these two ever stop disagreeing, the predicate has lost its teeth.
  chk('the caster can reach you from far outside its own body — which is why reach is the wrong gate',
    HOLLOW_FORMS.caster.reach > HOLLOW_FORMS.warden.reach && HOLLOW_FORMS.caster.body === 0)
}

// ── 3. accumulation — the half that makes it this move and not a reflect ───────────────────────
{
  chk('a fresh cloak holds nothing — canon\'s verb is BUILD', freshCloak().charge === 0)
  chk('...so it cannot punish the instant it is donned', cloakIgnite(freshCloak(), 0.85).burn === 0)
  chk('heat builds over time', charged(1).charge > charged(0.5).charge)
  chk('...at the declared rate', near(charged(1).charge, CLOAK_REBUILD))
  chk('and clamps at a full release, never past it', near(FULL.charge, CLOAK_BURN))
  chk('...still clamped after a very long quiet', near(charged(9999).charge, CLOAK_BURN))
  chk('a release deals exactly what was held', near(cloakIgnite(FULL, 0.85).burn, CLOAK_BURN))
  chk('...and leaves the skin cold', cloakIgnite(FULL, 0.85).cloak.charge === 0)

  // ★★ THE CHARACTER ASSERT. Two contacts close together must total LESS than two spaced apart.
  // A flat reflect scores these identically, so this is the assert that tells the two designs apart
  // — and it is the one that would quietly disappear if someone "simplified" the module.
  const spacedGap = CLOAK_BURN / CLOAK_REBUILD
  const rapid = (() => {
    let c = FULL, total = 0
    for (let i = 0; i < 2; i++) { const g = cloakIgnite(c, 0.85); total += g.burn; c = cloakBuild(g.cloak, 0.2, CLOAK_BURN, CLOAK_REBUILD) }
    return total
  })()
  const spaced = (() => {
    let c = FULL, total = 0
    for (let i = 0; i < 2; i++) { const g = cloakIgnite(c, 0.85); total += g.burn; c = cloakBuild(g.cloak, spacedGap, CLOAK_BURN, CLOAK_REBUILD) }
    return total
  })()
  chk('★★ spacing matters: two rushes in a row are punished LESS than two spread out',
    rapid < spaced, `rapid ${rapid.toFixed(2)} vs spaced ${spaced.toFixed(2)}`)
  chk('...and a swarm still gets the first full release, or the move never fires at all',
    rapid >= CLOAK_BURN)

  // Guards on the builder's own edges — a NaN charge would silently make every later compare false.
  chk('a zero-length step changes nothing', cloakBuild(FULL, 0, CLOAK_BURN, CLOAK_REBUILD) === FULL)
  chk('a zero cap holds nothing rather than producing NaN',
    cloakBuild(freshCloak(), 1, 0, CLOAK_REBUILD).charge === 0)
  chk('a NaN step cannot charge the cloak',
    Number.isFinite(cloakBuild(freshCloak(), Number.NaN, CLOAK_BURN, CLOAK_REBUILD).charge))
}

// ── 4. the host — a stance whose only effect nothing reads is a silent no-op ───────────────────
{
  const vox = readFileSync(new URL('../voxel3d/VoxelWorld.tsx', import.meta.url), 'utf8')
  const built = isBuilt('flame-cloak') && castForMove('flame-cloak').cloakBurn > 0

  chk('★ a host builds the heat', !built || /cloakBuild\(/.test(vox))
  chk('★ a host ignites it on contact', !built || /cloakIgnite\(/.test(vox))
  chk('the reach is read off the worn spec, not a second copy of the number',
    !built || /stance\.current\?\.cloakBurn \?\? 0/.test(vox))

  // ★★★ THE ARGUMENT THAT CARRIES THE CANON. Scoped to the call so no comment or Tailwind class can
  // impersonate it — the tremor-sense guard first went red on its own explanatory prose doing
  // exactly that.
  // ⚠ THE WHOLE LINE, NOT A PAREN-MATCHED SLICE — and this assert failed on itself first. A
  // `/cloakIgnite\([^)]*\)/` stops at the FIRST `)`, which is the one inside `formOf(st)`, so the
  // captured call ended one character before the `.body` the assert exists to find. A regex too
  // naive for a nested call reads exactly like a wrongly-wired host. Third time today that a guard
  // accused working code; take the line and let the assert read what a human would.
  const call = vox.split('\n').find((l) => l.includes('cloakIgnite(')) ?? ''
  chk('the ignition call is locatable at all', !built || call.length > 0, 'cloakIgnite(...) not found')
  chk('★★★ it is fed the body\'s SURFACE — reach would burn the caster from 7.5m',
    !built || /formOf\(\w+\)\.body/.test(call), call)
  chk('★ ...and never the reach', !built || !/\.reach\b/.test(call), call)

  // ★★ THE KILL MUST CLOSE THE LOOP THE SAME WAY THE OTHER TWO DO — and this assert exists because
  // a mutation removing the drop passed all 35 without it. `field-effects`' own kill path says why
  // in its comment: *"the loop must close identically, or 'kill it with fire' would quietly pay less
  // than shooting it."* A burn that kills without paying a shard is not a crash and not a visible
  // bug; it is a body that was worth something when shot and worth nothing when burned, which a
  // player would eventually feel as "don't bother with the cloak" and never be able to name.
  const igniteAt = vox.indexOf('const ig = cloakIgnite(')
  const block = igniteAt >= 0 ? vox.slice(igniteAt, igniteAt + 1200) : ''
  chk('the ignition block is locatable', !built || block.length > 0)
  chk('★★ a body killed by the cloak drops its shard, exactly as one shot or burned does',
    !built || /st\.hp <= 0[\s\S]{0,400}?spawnDrop\('raw_mana_shard'/.test(block))

  // Derived, not restated: three ways to kill a Hollow (a round, a field, the cloak), so three
  // places pay the shard. If a fourth is added and forgets, this is what says so.
  const payouts = vox.match(/spawnDrop\('raw_mana_shard'/g)?.length ?? 0
  chk('★ every kill path pays the shard — count them, do not assume',
    !built || payouts >= 3, `found ${payouts} shard payouts, expected one per kill path`)
}

console.log(`\nflame-cloak oracle: ${ok} passed, ${bad} failed`)
process.exit(bad ? 1 : 0)
