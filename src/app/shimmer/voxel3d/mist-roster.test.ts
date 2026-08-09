// Mist-roster oracle. Run: npx tsx src/app/shimmer/voxel3d/mist-roster.test.ts
//
// The drift gate (`npm run canon`) proves this table MATCHES canon. This proves it BEHAVES — that
// exclusivity actually holds, that an unruled zone yields nothing rather than something, and that
// no patch the generator currently produces lands somewhere canon was never asked about. That last
// one is the real point: a terrain retune can silently create a patch in a zone with no ruling, and
// the failure mode would be a faceless resident nobody notices for a month.

import { MIST_ROSTERS, MIST_CORRIDORS, rosterFor, residentFor, residentName, SPECIES_AFFINITY, type ZoneId } from './mist-roster'
import { mistPatchAt, DEFAULT_MIST } from '../voxel/mist'
import { zoneAt, ZONE_ANCHORS } from '../voxel/zones'
import { SPECIES_NAMES, type Species } from '../spirits/spirit'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337
const WILD = ['spirit-meadow', 'twilight-thicket', 'mana-springs'] as const

// ── 1. the three wild rosters are genuinely EXCLUSIVE ───────────────────────────────────────────
// Alex's actual ask. If two regions share a species, travelling stops paying.
{
  const seen = new Map<Species, string>()
  let overlap = 0
  for (const z of WILD) {
    for (const s of MIST_ROSTERS[z] ?? []) {
      const prev = seen.get(s)
      if (prev) { overlap++; fails.push(`${s} answers both ${prev} and ${z}`) }
      else seen.set(s, z)
    }
  }
  ok(overlap === 0, 'no species answers two wild regions')
  ok(seen.size === 10, `all ten base forms are placed exactly once across the wild regions (${seen.size})`)
}

// ── 2. the Outfields draw from the enduring, and are NOT a fourth exclusive region ───────────────
// The edge is thin ground, so it re-calls hardy species rather than owning any. That is deliberate
// and would otherwise look like an exclusivity bug.
{
  const of = MIST_ROSTERS['the-outfields'] ?? []
  ok(of.length > 0 && of.every(s => [...WILD].some(z => (MIST_ROSTERS[z] ?? []).includes(s))),
    'every Outfields species is re-called from a wild region, not unique to the edge')
  ok(of.length < 3, `the edge calls few (${of.length}) — a full roster would read as healthy ground`)
}

// ── 3. the corridor calls from both neighbours and owns nothing ──────────────────────────────────
{
  ok(!MIST_ROSTERS['mycelial-path'], 'the corridor has no roster of its own')
  const r = rosterFor('mycelial-path')
  const meadow = MIST_ROSTERS['spirit-meadow'] ?? []
  const thicket = MIST_ROSTERS['twilight-thicket'] ?? []
  ok(meadow.every(s => r.includes(s)) && thicket.every(s => r.includes(s)),
    `the corridor calls both neighbours (${r.length} species)`)
  ok(r.length === meadow.length + thicket.length, 'and nothing else')
  ok((MIST_CORRIDORS['mycelial-path'] ?? []).length === 2, 'the corridor names exactly its two forks')
}

// ── 4. FAIL CLOSED — an unruled zone calls nothing ───────────────────────────────────────────────
{
  ok(rosterFor('garden').length === 0, 'the home garden is unruled → calls nothing')
  ok(rosterFor('moonwell-glade').length === 0, 'Moonwell is unruled → calls nothing')
  ok(rosterFor(null).length === 0, 'wild country calls nothing')
  ok(rosterFor('gloview-village').length === 0, 'the village is ruled empty')
}

// ── 5. ★ NO PATCH LANDS IN A ZONE CANON HAS NOT RULED ───────────────────────────────────────────
// The tripwire. Home/Moonwell carry mist chance 1.0 and produce nothing only because their terrain
// has no dells; that is a measurement, not a guarantee. If a height retune ever makes one, this
// fails and the answer is a CANON_GAPS entry, not a quietly added roster line.
{
  const RULED = new Set<string>([...Object.keys(MIST_ROSTERS), ...Object.keys(MIST_CORRIDORS)])
  const reach = Math.max(...ZONE_ANCHORS.map(a => Math.max(Math.abs(a.x) + a.rx, Math.abs(a.z) + a.rz)))
  const cells = Math.ceil(reach / (DEFAULT_MIST.spacing * 16)) + 2
  const stray: string[] = []
  let patches = 0, withResident = 0
  for (let cx = -cells; cx <= cells; cx++) {
    for (let cz = -cells; cz <= cells; cz++) {
      const p = mistPatchAt(SEED, cx, cz)
      if (!p) continue
      patches++
      const id = zoneAt(p.x, p.z, SEED).zone?.id
      if (!id || !RULED.has(id)) { stray.push(`${id ?? 'wild'} @ (${p.x},${p.z})`); continue }
      if (residentFor(p, id)) withResident++
    }
  }
  ok(patches > 0, `swept ${patches} patches`)
  ok(stray.length === 0, `every patch stands in a zone canon has ruled (${stray.slice(0, 3).join(', ')})`)
  ok(withResident === patches, `every patch can name a resident (${withResident}/${patches})`)
}

// ── 6. the resident is stable, and a withdrawal re-draws it ─────────────────────────────────────
{
  let p: ReturnType<typeof mistPatchAt> = null
  let z: ZoneId | null = null
  for (let cx = -20; cx <= 20 && !p; cx++) for (let cz = -20; cz <= 20 && !p; cz++) {
    const c = mistPatchAt(SEED, cx, cz)
    if (c) { p = c; z = zoneAt(c.x, c.z, SEED).zone?.id ?? null }
  }
  if (!p) fails.push('no patch to probe the resident with')
  else {
    ok(residentFor(p, z) === residentFor(p, z), 'a resident is the same one every time you walk back')
    ok(rosterFor(z).includes(residentFor(p, z)!), 'and it is on its own region roster')
    // Across many patches a re-draw must sometimes change — otherwise the nonce does nothing and
    // every sparred patch would re-manifest the identical spirit forever.
    let changed = 0, tried = 0
    for (let cx = -20; cx <= 20; cx++) for (let cz = -20; cz <= 20; cz++) {
      const c = mistPatchAt(SEED, cx, cz)
      if (!c) continue
      const zz = zoneAt(c.x, c.z, SEED).zone?.id
      if (!zz || rosterFor(zz).length < 2) continue
      tried++
      if (residentFor(c, zz, 0) !== residentFor(c, zz, 1)) changed++
    }
    ok(tried > 0 && changed > 0, `a withdrawal re-draws what answers next (${changed}/${tried} patches changed kind)`)
  }
}

// ── 7. the Native-World Law — a player never sees a species CODE ────────────────────────────────
{
  const all = new Set<Species>()
  for (const z of Object.keys(MIST_ROSTERS) as (keyof typeof MIST_ROSTERS)[]) for (const s of MIST_ROSTERS[z] ?? []) all.add(s)
  let bad = 0
  for (const s of all) {
    const shown = residentName(s)
    if (!shown || shown === s || shown !== SPECIES_NAMES[s]) bad++
    // The codes are Earth-animal shorthand; the canon name must never simply echo one.
    if (/^(fox|frog|owl|bat|turtle|rabbit)$/i.test(shown)) bad++
  }
  ok(bad === 0, `every resident shows its canon name, never its code (${bad} leaks)`)
  ok(all.size === 10, 'all ten kinds have a display name')
}

// ── 8. affinity table matches canon's own column ────────────────────────────────────────────────
// Transcribed from world/spirits-species.md; the drift gate checks it against canon, this checks it
// is total (a missing entry would tint a resident undefined and fail silently at a glance).
{
  const codes: Species[] = ['fox', 'axolotl', 'water-bear', 'turtle', 'owl', 'frog', 'firefly', 'rabbit', 'hummingbird', 'bat']
  ok(codes.every(c => SPECIES_AFFINITY[c] !== undefined), 'every species has a ruled affinity')
  ok(new Set(Object.values(SPECIES_AFFINITY)).size === 4, 'all four elements are represented')
}

if (fails.length) {
  console.error(`❌ ${fails.length} failed (${pass} passed)`)
  for (const f of fails.slice(0, 12)) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ the mist calls what the ground calls — ${pass} passed`)
