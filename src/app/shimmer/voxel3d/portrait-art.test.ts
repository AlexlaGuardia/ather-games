// ── The world portraits: present, cut out, and neither eaten nor uncut ────────────────────────
// Run: npx tsx src/app/shimmer/voxel3d/portrait-art.test.ts
//
// ★ THIS GUARD EXISTS BECAUSE THE NUMBERS LIED TO ME TWICE WHILE I BUILT THE CUTOUTS, and both
// times a contact sheet was the only thing that caught it. Background removal does not error: it
// returns a confident, well-formed, WRONG image. The Athowl came back with a bite out of its head
// and the Lepara as ears with no body, and both cleared the area floor I had set. So this asserts
// the two shapes those failures actually take, rather than "does a file exist".
//
// ⚠ AND IT CHECKS BOTH DIRECTIONS, because they are opposite errors that look alike in a number:
//   · alpha coverage near 100% = nothing was removed, the painted ground is still there and the
//     creature will stand in the world inside a rectangle of its own backdrop.
//   · alpha coverage very low = the fill walked through the subject and ate it.
// A single "it has some transparency" check passes both.

import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { PORTRAIT_OF, FOLK_PORTRAIT, hasPortrait } from './spirit-portrait-body'
import { ALL_SPECIES } from '../engine/spirit-index'

const DIR = join(process.cwd(), 'public/spirits/world')
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

ok(existsSync(DIR), `BLIND: ${DIR} is gone — this guard cannot see its subject`)
if (fails.length) { console.log('❌ ' + fails.join('\n')); process.exit(1) }

// ── 1. the roster is DERIVED, not restated ────────────────────────────────────────────────────
// A hand-kept portrait list would drift from the species list the day an eleventh is painted.
for (const sp of ALL_SPECIES) {
  ok(hasPortrait(sp), `${sp} is a live species with no world portrait — it falls back to the unfinished pixel sprite`)
}
const extra = Object.keys(PORTRAIT_OF).filter(k => !(ALL_SPECIES as string[]).includes(k))
ok(extra.length === 0, `portrait(s) for species that do not exist: ${extra.join(', ')}`)

// ── 2. every path resolves, and nothing points outside the world art dir ──────────────────────
const EVERY = { ...PORTRAIT_OF, ...FOLK_PORTRAIT }
for (const [sp, path] of Object.entries(EVERY)) {
  ok(path.startsWith('/spirits/world/'), `${sp} points outside the world portrait dir: ${path}`)
  ok(existsSync(join(process.cwd(), 'public', path)), `${sp}: ${path} is referenced but not on disk — run scripts/spirit-cutout.py`)
}

// ── 3. THE CUTOUT ACTUALLY HAPPENED, AND DID NOT EAT THE CREATURE ─────────────────────────────
// ⚠ Wrapped in a main() rather than top-level await: this repo's tsx runner emits cjs, where a
// top-level await is a TRANSFORM error, not a runtime one — the file does not run at all, and a
// guard that cannot start looks exactly like a guard with nothing to say.
const LOW = 0.10, HIGH = 0.92
async function main() {
for (const [sp, path] of Object.entries(EVERY)) {
  const file = join(process.cwd(), 'public', path)
  if (!existsSync(file)) continue
  const img = sharp(file)
  const meta = await img.metadata()
  ok(meta.hasAlpha === true, `${sp}: no alpha channel — this is the painting, not a cutout of it`)
  // Mean of the alpha channel over the whole image = the fraction that is subject.
  // ⚠ NO ALPHA MEANS FULLY OPAQUE, NOT FULLY EMPTY. webp DROPS an alpha channel that is entirely
  // 255 because it is redundant, so `channels[3]` is simply absent — and defaulting that to 0 made
  // the guard report "the fill ate the creature" about an untouched painting, which is the exact
  // opposite failure. It still went red, for the wrong reason, with a message that would have sent
  // the next reader to re-run the cutout instead of noticing it had never run.
  const st = await img.stats()
  const alpha = st.channels[3]
  const cover = alpha ? alpha.mean / 255 : 1
  ok(cover > LOW, `${sp}: only ${(cover * 100).toFixed(1)}% of the tile is opaque — the fill ate the creature (this is how Lepara came back as ears with no body)`)
  ok(cover < HIGH, `${sp}: ${(cover * 100).toFixed(1)}% opaque — nothing was removed, so it will stand in the world inside its own painted backdrop`)
}

// ── 4a. ★ THE COLLARED VARIANTS, AND THE ONE CANON RULE ABOUT WHO MAY WEAR ONE ───────────────
// `spirit-portrait-body.ts` derives a collared URL by suffix rather than listing them, so nothing
// in the tables names these files — they still have to BE there or a dragged spirit 404s.
//
// ⚠⚠ AND NO MOGLIN MAY HAVE ONE. `moglins.md:75` pins it: "The collar's power is SPIRIT-ONLY — it
// does not bite on a Mana'mal or an Alkin, and a Moglin is not a spirit"; every canon instance has
// the Moglin HOLDING the leash. Canon says the ambiguity in "collar-Moglin" already "cost real build
// work" once, when the Shimmer build read it the other way and shipped collared Moglins as foes. So
// this asserts the absence, not just the presence: a folk portrait acquiring a collar badge is that
// same mistake coming back, and it would look perfectly reasonable on a contact sheet.
const collaredName = (path: string) => path.split('/').pop()!.replace(/\.webp$/, '-collared.webp')
for (const [sp, path] of Object.entries(PORTRAIT_OF)) {
  ok(existsSync(join(DIR, collaredName(path))),
     `${sp} has no collared variant — a spirit on a Moglin's leash would request it and 404. Run scripts/collar-badge.py`)
}
for (const [folk, path] of Object.entries(FOLK_PORTRAIT)) {
  ok(!existsSync(join(DIR, collaredName(path))),
     `${folk} has a COLLARED portrait — canon: the collar is spirit-only and a Moglin is not a spirit. He holds the leash; he never wears it.`)
}

// ── 4b. no stray files, so a rename cannot leave an orphan the world still requests ────────────
const onDisk = readdirSync(DIR).filter(f => f.endsWith('.webp'))
const named = new Set([
  ...Object.values(EVERY).map(p => p.split('/').pop()!),
  ...Object.values(PORTRAIT_OF).map(collaredName),
])
const orphans = onDisk.filter(f => !named.has(f))
ok(orphans.length === 0, `${orphans.length} portrait file(s) nothing references: ${orphans.join(', ')}`)

console.log(`\nportrait-art — ${Object.keys(PORTRAIT_OF).length} species + ${Object.keys(FOLK_PORTRAIT).length} folk portraits`)
if (fails.length) {
  console.log(`\n❌ ${pass} passed, ${fails.length} FAILED\n`)
  fails.forEach(f => console.log('  · ' + f))
  process.exit(1)
}
console.log(`✅ ${pass} asserts passed — every species wears a real cutout\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
