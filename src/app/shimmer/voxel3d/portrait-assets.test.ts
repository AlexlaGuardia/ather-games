// ── Every portrait a body can ask for is a file that exists ────────────────────────────────────
// Run: npx tsx src/app/shimmer/voxel3d/portrait-assets.test.ts
//
// ── ★★ WHY THIS FILE EXISTS: A MISSING TEXTURE IS THE QUIETEST FAILURE IN THE BUILD ────────────
// `THREE.TextureLoader.load` on a URL that 404s does not throw and does not reject. It logs, hands
// back a Texture that never receives an image, and the sprite draws NOTHING. On a world where
// spirits legitimately come and go through mist, an invisible resident is indistinguishable from
// one that has not spawned yet — so this class of bug has no symptom a player or a screenshot can
// report. It has to be caught off the disk.
//
// ── ★★★ THE BUG THAT MOTIVATED IT, BECAUSE THE SHAPE REPEATS ──────────────────────────────────
// `collaredUrl` read `ALL_PORTRAITS`, which includes the folk. `moglin` therefore resolved to
// `/spirits/world/moglin-collared.webp`, which has never existed — and because a string is not
// `undefined`, `portraitUrl`'s `?? ALL_PORTRAITS[species]` could not fall back. The fallback READS
// like it handles a missing collared sheet; it can never fire for any species that has a base
// portrait, which is every species.
//
// ⚠ THE RULE WAS WRITTEN DOWN THREE TIMES AND ENFORCED ZERO. The commit that added the badge is
// titled *"the dragged spirit wears its iron, and no Moglin ever does"*; this module's own header
// says the two tables exist so each can make an exact claim; `scripts/collar-badge.py` keeps a
// species list that correctly excludes the folk. Prose, a commit message and a generator's list —
// none of which the runtime can read. It stayed latent only because no caller passes `collared`
// for a folk yet, and the Moglin portrait swap is the step that reaches it.
//
// ── ★★★ WHY THIS IS NOT `portrait-art.test.ts` WEARING A SECOND NAME ──────────────────────────
// That file already asserts the canon rule and asserted it CORRECTLY THE WHOLE TIME: every spirit
// has a `-collared.webp` on disk, and no folk does (`moglins.md:75` — the collar is spirit-only and
// a Moglin is not a spirit). It was green while the moglin bug was live, and it was not wrong to be.
//
// It checks the ASSET LAYOUT. This checks WHAT THE RUNTIME ASKS FOR. The moglin bug is the whole
// argument for keeping both: the layout was right, the request was wrong, and the two guards are
// internally consistent about different things — the same shape as a test that reaches a module
// directly while the game reaches it through a gate.
//
// ⚠ AND THE REASON THAT FILE COULD NOT CATCH IT IS ONE LINE OF ITS OWN: `collaredName` RESTATES the
// suffix derivation instead of calling it, so it verifies files exist for the names IT computes,
// never for the names `spirit-portrait-body.ts` computes. A hand-kept copy of a derivation agrees
// with its original right up until it doesn't. This file calls the real function.
//
// ★ ASSERTS THROUGH `portraitUrl`, THE FUNCTION `sheetFor` ACTUALLY CALLS. Restating the
// resolution here would have re-derived it from the same prose that was already wrong, and agreed
// with itself perfectly. There is one path, and this is it.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PORTRAIT_OF, FOLK_PORTRAIT, hasPortrait, portraitUrl } from './spirit-portrait-body'

const PUBLIC = join(process.cwd(), 'public')
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SPIRITS = Object.keys(PORTRAIT_OF).sort()
const FOLK = Object.keys(FOLK_PORTRAIT).sort()

// ── A. the sweep found something ───────────────────────────────────────────────────────────────
// An empty table would make every loop below vacuously green — "I could not look" wearing the
// costume of "nothing is wrong".
ok(SPIRITS.length >= 10, `A: only ${SPIRITS.length} spirit portraits — the table went empty, this file proves nothing`)
ok(FOLK.length >= 3, `A: only ${FOLK.length} folk portraits — the table went empty`)

// ── B. every URL any caller can reach resolves to a file on disk ───────────────────────────────
// Both axes, because `collared` is a caller's free choice and each value picks a different sheet.
for (const s of [...SPIRITS, ...FOLK]) {
  for (const collared of [false, true]) {
    const url = portraitUrl(s, collared)
    ok(!!url, `B: portraitUrl('${s}', ${collared}) returned nothing`)
    if (url) ok(existsSync(join(PUBLIC, url)), `B: ${s} (collared=${collared}) resolves to ${url}, which is not on disk`)
  }
}

// ── C. ★ THE INVARIANT ITSELF: folk do the collaring and are never collared ────────────────────
// Stated as what a CALLER OBSERVES, not as "collaredUrl returns undefined" — the private helper is
// free to change shape, the guarantee is not.
for (const f of FOLK) {
  ok(portraitUrl(f, true) === portraitUrl(f, false),
    `C: ${f} is folk and must fall back to its own art when asked for a collar, not a separate sheet`)
  ok(!existsSync(join(PUBLIC, `/spirits/world/${f}-collared.webp`)),
    `C: ${f} has a collared sheet on disk — folk are the ones doing the collaring`)
}

// ── D. a spirit asked for a collar gets a DIFFERENT sheet, or the badge is invisible ───────────
// The mirror of C, and the assert that fails if someone "fixes" C by making everything fall back.
for (const s of SPIRITS) {
  ok(portraitUrl(s, true) !== portraitUrl(s, false),
    `D: ${s} returns its plain portrait when collared — the collar badge would never show`)
}

// ── E. `hasPortrait` covers both tables ────────────────────────────────────────────────────────
for (const k of [...SPIRITS, ...FOLK]) ok(hasPortrait(k), `E: hasPortrait('${k}') is false but a portrait is listed`)
ok(!hasPortrait('kael'), 'E: hasPortrait says yes to a person with no portrait')
ok(!hasPortrait('__proto__'), 'E: a prototype key must not resolve to a portrait')

// ── F. ★ THE GENERATOR AND THE CONSUMER MUST AGREE ON WHO IS COLLARABLE ────────────────────────
// `scripts/collar-badge.py` stamps the collared sheets from its own hand-kept list — a fourth copy
// of the species list, in a language that cannot import the table above. That is the hand-kept
// mirror shape, so it gets compared rather than trusted.
//
// ⚠ AND THE READ IS ASSERTED, NOT TRUSTED. A regex that matches nothing returns "no drift found",
// which is the same shape as "I could not look" — this repo has shipped that exact failure. If the
// list cannot be found, that is a FAILURE, not a skip.
{
  const py = readFileSync(join(process.cwd(), 'scripts/collar-badge.py'), 'utf8')
  const m = py.match(/^SPECIES\s*=\s*\[([^\]]*)\]/m)
  ok(!!m, 'F: could not find SPECIES in scripts/collar-badge.py — the cross-check went BLIND, which is not a pass')
  if (m) {
    const listed = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]).sort()
    ok(listed.length > 0, 'F: SPECIES parsed to an empty list — the pattern matched the wrong thing')
    ok(listed.join() === SPIRITS.join(),
      `F: collar-badge.py stamps [${listed.join(', ')}] but the consumer collars [${SPIRITS.join(', ')}]`)
  }
}

console.log(`\nportrait assets — ${SPIRITS.length} spirits, ${FOLK.length} folk, both collar axes checked`)
if (fails.length) { console.error(`❌ ${fails.length} failed:`); for (const f of fails) console.error('   · ' + f); process.exit(1) }
console.log(`✅ every portrait a body can ask for is on disk — ${pass} passed\n`)
