// Registry oracle. Run: npx tsx src/app/shimmer/sprites/registry.test.ts
//
// ★ THE DIRECTORY SCAN IS THE WHOLE POINT. Every other assert here checks that what IS registered is
// coherent; only the scan notices what ISN'T. A hand-kept map's failure mode is silence on the day a
// new species is painted, and silence is what this file exists to break.

import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { SPECIES_ART, SPECIES_IDS, speciesArt, SPECIES_IN_ORDER, ORDER_ORPHANS, speciesLabel } from './registry'
import { PALETTES } from './palette'
import { MIST_ROSTERS, MIST_CORRIDORS } from '../voxel3d/mist-roster'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const DIR = join(process.cwd(), 'src/app/shimmer/sprites')

// ── 1. ★★ THE SCAN — anything that looks like a creature must be registered ──────────────────────
// "Looks like a creature" is DERIVED, not listed: a `sprites/<id>.ts` exporting `<ID>_SPRITES` that
// also has `PALETTES[<id>]`. People (player/kael/gregory) export the first and not the second, so
// they fall out without an allowlist — and an allowlist is exactly what this file replaces.
{
  const found: string[] = []
  for (const f of readdirSync(DIR)) {
    if (!f.endsWith('.ts') || f.endsWith('.test.ts')) continue
    const id = f.slice(0, -3)
    const src = readFileSync(join(DIR, f), 'utf8')
    const exportsSprites = new RegExp(`export const ${id.replace(/-/g, '_').toUpperCase()}_SPRITES\\b`).test(src)
    const hasPalette = Object.prototype.hasOwnProperty.call(PALETTES, id)
    if (exportsSprites && hasPalette) found.push(id)
  }
  ok(found.length > 0, '★ the scan found NO creature files at all — it cannot see its subject, so it can never fail')
  const missing = found.filter(id => !SPECIES_ART[id])
  ok(missing.length === 0, `★ painted species NOT in the registry: ${missing.join(', ')} — add them to ANIMS`)
  const extra = SPECIES_IDS.filter(id => !found.includes(id))
  ok(extra.length === 0, `registry names species with no matching painted file: ${extra.join(', ')}`)
  console.log(`   scan · ${found.length} creature files on disk, ${SPECIES_IDS.length} registered`)
}

// ── 2. Every entry is actually usable ────────────────────────────────────────────────────────────
for (const id of SPECIES_IDS) {
  const a = speciesArt(id)
  ok(!!a, `${id}: speciesArt returned null for a registered id`)
  if (!a) continue
  ok(a.palette.length > 0, `${id}: empty palette — PALETTES.${id}.base is missing or misnamed`)
  ok(Object.keys(a.anims).length > 0, `${id}: no animations`)
  // ⚠ The palette must be the SAME ARRAY the palette file holds, not a copy. A copy is the mirror
  // bug: it would agree today and drift the first time someone recolours a species.
  ok(a.palette === (PALETTES as Record<string, Record<string, readonly string[]>>)[id].base,
    `${id}: palette was copied rather than referenced — it will drift on the next recolour`)
}

// ── 3. Unknown ids return null, and do not throw or invent ───────────────────────────────────────
{
  ok(speciesArt('moglin') === null, 'an unpainted species must return null, not a stand-in')
  ok(speciesArt('') === null, 'the empty id must return null')
  ok(speciesArt('__proto__') === null, 'a prototype key must not resolve to anything')
}

// ── 4. ★★ EVERY SPECIES THE MIST CAN CALL MUST BE DRAWABLE ───────────────────────────────────────
// The registry existing is not the point; the encounter being drawable is. This joins the two and
// fails if canon's rosters ever name something nobody has painted.
{
  const rostered = new Set<string>()
  for (const list of Object.values(MIST_ROSTERS)) for (const s of list) rostered.add(s)
  for (const [, from] of Object.entries(MIST_CORRIDORS)) {
    for (const zone of from) for (const s of (MIST_ROSTERS as Record<string, string[]>)[zone] ?? []) rostered.add(s)
  }
  ok(rostered.size > 0, 'no rostered species found — this assert cannot fire, so it proves nothing')
  const undrawable = [...rostered].filter(s => !speciesArt(s))
  ok(undrawable.length === 0, `★ the mist can call species with no art: ${undrawable.join(', ')}`)
  console.log(`   mist · ${rostered.size} rostered species, all drawable`)
}

// ── 5. The editor display order, which is the one list here that CAN quietly rot ─────────────────
// `SPECIES_IN_ORDER` cannot lose a species — anything registered but unlisted is appended, by
// construction — so asserting that it covers `SPECIES_IDS` would be an assert with no input that
// makes it fire. The failure this list actually has is the opposite one: a name that no longer
// exists, left behind by a rename, silently filtered out and never seen again.
{
  ok(ORDER_ORPHANS.length === 0,
    `the display order names species the registry does not have (a rename went unfollowed): ${ORDER_ORPHANS.join(', ')}`)
  ok(SPECIES_IN_ORDER.length === SPECIES_IDS.length,
    `display order holds ${SPECIES_IN_ORDER.length} of ${SPECIES_IDS.length} species`)
  for (const id of SPECIES_IN_ORDER) ok(id in SPECIES_ART, `${id}: shown by the editors but not registered`)

  // The three dev editors read this and nothing else. A duplicate would render one species twice.
  ok(new Set(SPECIES_IN_ORDER).size === SPECIES_IN_ORDER.length, 'the display order repeats a species')

  // Labels are derived, so the hyphenated id is the only interesting case — it is also the exact
  // pair that drifted before the registry existed (`water-bear` vs `WATER_BEAR_SPRITES`).
  ok(speciesLabel('water-bear') === 'Water Bear', `speciesLabel('water-bear') = ${speciesLabel('water-bear')}`)
  ok(speciesLabel('fox') === 'Fox', `speciesLabel('fox') = ${speciesLabel('fox')}`)
  console.log(`   editors · ${SPECIES_IN_ORDER.length} species shown, ${SPECIES_IN_ORDER[0]} first`)
}

if (fails.length) { console.error(`❌ ${fails.length} failed:`); for (const f of fails) console.error('   · ' + f); process.exit(1) }
console.log(`✅ one map, and it notices when it goes stale — ${pass} passed`)
