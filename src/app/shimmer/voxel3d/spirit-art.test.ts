// ── The grimoire portraits are a DERIVATION of the canon ledgers, and this proves it still is ──
// Run: npx tsx src/app/shimmer/voxel3d/spirit-art.test.ts
//
// ★ WHY. `spirit-art.ts` is generated from three lock ledgers that live in ANOTHER REPO
// (/root/athernyx) and gain rows whenever Magii locks a set of four. A generated file that nobody
// re-generates is a hand-kept mirror with extra steps: it agrees with the ledgers until it quietly
// stops, and it stops at the exact moment new art lands — the moment someone goes looking. So this
// re-derives the manifest from the ledgers and fails when the two disagree.
//
// ⚠ IT COMPARES THE DERIVATION, NOT A REMEMBERED COUNT. A test asserting "54 portraits" would go
// red on the next lock for the right reason and be greened by editing a number, which is the one
// edit that must not be cheap here. It names what is missing instead.

import { readFileSync, existsSync } from 'node:fs'
import { join, normalize } from 'node:path'
import { SPIRIT_ART } from './spirit-art'
import { SPECIES_NAMES } from '../spirits/spirit'

const ATHERNYX = '/root/athernyx'
const PUBLIC = join(process.cwd(), 'public')
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── 0. BLIND CHECK — "I found no drift" and "I could not look" must not share an exit code ────
const LEDGERS = {
  base: join(ATHERNYX, 'CANON/design-briefs/spirits.json'),
  stage2: join(ATHERNYX, 'assets/stage2/grimoire-ledger.json'),
  stage3: join(ATHERNYX, 'assets/stage3/grimoire-ledger-stage3.json'),
}
for (const [tier, p] of Object.entries(LEDGERS)) {
  ok(existsSync(p), `BLIND: the ${tier} ledger is gone from ${p} — this guard cannot see its subject`)
}
if (fails.length) { console.log(`\n❌ ${fails.join('\n  · ')}\n`); process.exit(1) }

const base = JSON.parse(readFileSync(LEDGERS.base, 'utf8'))
const st2 = JSON.parse(readFileSync(LEDGERS.stage2, 'utf8'))
const st3 = JSON.parse(readFileSync(LEDGERS.stage3, 'utf8'))

// A count guard, for the reason every parser-backed oracle in this repo has one: if a regex or a
// shape drifts, the parse collapses quietly and every assert below audits a subset it chose itself.
ok(base.spirits?.length === 10, `the base ledger parsed as ${base.spirits?.length} spirits, not 10 — the shape drifted and this check is auditing a subset`)
ok(Array.isArray(st2.locks) && st2.locks.length >= 40, `stage-2 parsed as ${st2.locks?.length} locks — expected at least the 40 that were locked on 2026-06-23`)
ok(Array.isArray(st3.locks), 'stage-3 locks did not parse as a list')

// ── 1. THE JOIN, asserted rather than assumed ─────────────────────────────────────────────────
// The ledgers key by canon id (`vulnyx`); the build keys by species code (`fox`). SPECIES_NAMES is
// where that relationship is stated, so it is the join — and the ledgers' own `analog` field is
// deliberately NOT used, because it says `tardigrade` where the build says `water-bear`.
const speciesOf = (id: string): string | null =>
  Object.entries(SPECIES_NAMES).find(([, n]) => n.toLowerCase() === id.toLowerCase())?.[0] ?? null
for (const s of base.spirits) {
  ok(!!speciesOf(s.id), `canon spirit '${s.id}' (${s.name}) maps to no species in SPECIES_NAMES — the join is broken, not the art`)
}

// ── 2. RE-DERIVE the whole manifest and compare KEY SETS ──────────────────────────────────────
const expected = new Set<string>()
for (const s of base.spirits) { const c = speciesOf(s.id); if (c) expected.add(c) }
for (const l of st2.locks) { const c = speciesOf(l.spirit); if (c) expected.add(`${c}:${l.element}`) }
for (const l of st3.locks) { const c = speciesOf(l.spirit); if (c) expected.add(`${c}:${l.element}:${l.branch}`) }

const have = new Set(Object.keys(SPIRIT_ART))
const missing = [...expected].filter(k => !have.has(k))
const extra = [...have].filter(k => !expected.has(k))
ok(missing.length === 0, `${missing.length} locked form(s) have no portrait — run \`npx tsx scripts/spirit-art.mts\`: ${missing.slice(0, 8).join(', ')}`)
ok(extra.length === 0, `${extra.length} portrait(s) name a form no ledger locks — stale generation: ${extra.slice(0, 8).join(', ')}`)

// ── 3. every path a player can request must actually be there ─────────────────────────────────
// A missing file renders as a broken image over the world, and `onError` hiding it would make an
// absent portrait indistinguishable from an unknown species — the two states this panel exists to
// tell apart.
for (const [key, path] of Object.entries(SPIRIT_ART)) {
  ok(path.startsWith('/spirits/grimoire/'), `${key} points outside the grimoire art dir: ${path}`)
  ok(existsSync(join(PUBLIC, path)), `${key}: ${path} is referenced but not in public/ — regenerate`)
}

// ── 4. ⚠ THE LICENSING BOUNDARY, ASSERTED STRUCTURALLY ────────────────────────────────────────
// Concept renders are non-commercial and must never ship. They live under akatskii-web/public, so
// no generated path may name that tree, and the generator must still carry its refusal.
const gen = readFileSync(join(process.cwd(), 'scripts/spirit-art.mts'), 'utf8')
ok(/CONCEPT_ROOTS/.test(gen) && /akatskii-web\/public/.test(gen),
   'the generator no longer refuses concept-directory sources — that refusal is the licensing boundary')
for (const [key, path] of Object.entries(SPIRIT_ART)) {
  ok(!/concept|akatskii/i.test(path), `${key} resolves into concept art, which is non-commercial and must never ship: ${path}`)
}

// ── 5. ★★ THE OTHER MIRROR — public/grimoire/spirits.json ─────────────────────────────────────
// The build keeps its OWN copy of the ten spirits (the public /grimoire book page reads it, and it
// carries entry copy canon does not have). Two files stating the same ten facts, in two repos, with
// nothing checking they agree: the shape this codebase has paid for repeatedly.
//
// ⚠ IT COMPARES ONLY WHAT IS THE SAME CLAIM. My first version diffed every shared field and
// reported 41 of 50 "drifted" — which was the instrument, not the data. `palette` is PROSE in canon
// and HEX in the build (a deliberate translation, not a copy), `element` differs only in case, and
// the quirk/signature lines are legitimately reworded for the page. Comparing a translation against
// its source and calling every difference drift is crying wolf, and this file's whole argument is
// that a guard which cries wolf stops being read. So: id, name, and element case-insensitively —
// the fields where the two files genuinely assert the same thing.
{
  const buildManifest = join(PUBLIC, 'grimoire/spirits.json')
  if (!existsSync(buildManifest)) {
    fails.push(`BLIND: public/grimoire/spirits.json is gone — the /grimoire page reads it and this cross-check cannot look`)
  } else {
    const mine = JSON.parse(readFileSync(buildManifest, 'utf8')).spirits as Record<string, string>[]
    ok(mine.length === base.spirits.length, `the build's grimoire manifest has ${mine.length} spirits, canon has ${base.spirits.length}`)
    const byName = new Map(mine.map(s => [s.name, s]))
    for (const c of base.spirits) {
      const b = byName.get(c.name)
      if (!b) { fails.push(`canon spirit ${c.name} is absent from the build's grimoire manifest`); continue }
      ok(b.id === c.id, `${c.name}.id disagrees: build '${b.id}' vs canon '${c.id}'`)
      ok(String(b.element).toLowerCase() === String(c.element).toLowerCase(),
         `${c.name}.element disagrees: build '${b.element}' vs canon '${c.element}'`)
    }
    // ⚠ `analog` IS DELIBERATELY NOT ASSERTED, and the reason is a live finding rather than an
    // exemption. It is `waterbear` in the build manifest, `tardigrade` in canon, and `water-bear`
    // in the build's own species code — three spellings of one animal across three files, which is
    // why `speciesOf` above joins on SPECIES_NAMES and never on analog. Asserting agreement would
    // go red on a disagreement nobody intends to resolve; what matters is that no CODE depends on
    // it. That is what this asserts instead.
    const usesAnalog = readFileSync(join(process.cwd(), 'scripts/spirit-art.mts'), 'utf8')
    ok(!/\.analog\b/.test(usesAnalog), 'the portrait generator reads `analog` — it must join on SPECIES_NAMES, the three spellings do not agree')
  }
}

console.log(`\nspirit-art — ${have.size} portraits, re-derived from ${base.spirits.length} base + ${st2.locks.length} second + ${st3.locks.length} awakened locks`)
if (fails.length) {
  console.log(`\n❌ ${pass} passed, ${fails.length} FAILED\n`)
  fails.forEach(f => console.log('  · ' + f))
  process.exit(1)
}
console.log(`✅ ${pass} asserts passed — the manifest still matches the ledgers\n`)
