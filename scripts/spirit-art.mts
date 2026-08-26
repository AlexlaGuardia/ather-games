// ── Grimoire portraits: the locked spirit art, resized into the game and indexed ───────────────
// Run: npx tsx scripts/spirit-art.mts        (add --check to verify without writing)
//
// ★ WHY THIS IS A SCRIPT AND NOT A HAND-WRITTEN MAP. Three ledgers in /root/athernyx own which
// spirit art is LOCKED, and they gain rows as Magii locks sets of four. A hand-kept table in this
// repo would be a mirror of those ledgers — it would agree with them until it silently did not,
// which is the exact shape this codebase has paid for repeatedly. So the manifest is GENERATED
// from the ledgers, and `spirit-art.test.ts` re-derives it and fails when the two disagree.
//
// ⚠⚠ THE CONCEPT/LOCK BOUNDARY IS A LICENSING BOUNDARY, NOT A TIDINESS ONE.
// Every ledger row records `method: "concept-riff off <concept>"` — the CONCEPT is an input and
// lives under /root/akatskii-web/public (flux-dev, NON-COMMERCIAL, must never ship); the numbered
// file in /root/athernyx/assets is the output that may. Raw concept art has been shipped to the
// public site once before and Alex caught it. This script therefore reads ONLY files named by a
// ledger lock, and refuses outright if a source path points into a concept directory.
//
// ★ THE JOIN IS DERIVED, NOT TABULATED. The ledgers key spirits by canon id (`vulnyx`); the build
// keys them by species code (`fox`). `SPECIES_NAMES` already states that relationship, so the join
// is `SPECIES_NAMES[code].toLowerCase() === lock.spirit` and a species missing from either side is
// a hard failure. The ledgers' own `analog` field is NOT used: it says `tardigrade` where the build
// says `water-bear`, and that mismatch has silently blanked the Dewbear once already.

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, statSync } from 'node:fs'
import { join, normalize, dirname } from 'node:path'
import sharp from 'sharp'
import { SPECIES_NAMES } from '../src/app/shimmer/spirits/spirit'

const ATHERNYX = '/root/athernyx'
const OUT_DIR = join(process.cwd(), 'public/spirits/grimoire')
const MANIFEST = join(process.cwd(), 'src/app/shimmer/voxel3d/spirit-art.ts')
const EDGE = 256                       // a grimoire tile is ~44px; 256 covers retina + the open panel
const CHECK = process.argv.includes('--check')

/** Paths that hold NON-COMMERCIAL concept input. A source under any of these is a hard stop. */
const CONCEPT_ROOTS = ['/root/akatskii-web/public']

type Lock = { key: string; name: string; src: string }

const speciesOf = (spiritId: string): string => {
  const hit = Object.entries(SPECIES_NAMES).find(([, n]) => n.toLowerCase() === spiritId.toLowerCase())
  if (!hit) throw new Error(`ledger names spirit '${spiritId}', which no species in SPECIES_NAMES maps to`)
  return hit[0]
}

const locks: Lock[] = []

// ── tier 1: the base species, from the Grimoire data manifest ────────────────────────────────
{
  const m = JSON.parse(readFileSync(join(ATHERNYX, 'CANON/design-briefs/spirits.json'), 'utf8'))
  // ⚠ `ref` is relative to _meta.ref_dir, NOT to the json's own directory. Resolving it the
  // obvious way reports all ten as MISSING, which reads as "the base art was never made".
  const refDir = m._meta.ref_dir as string
  for (const s of m.spirits) {
    locks.push({ key: speciesOf(s.id), name: s.name, src: normalize(join(refDir, s.ref)) })
  }
}

// ── tier 2 + 3: the numbered locks ───────────────────────────────────────────────────────────
{
  const st2 = JSON.parse(readFileSync(join(ATHERNYX, 'assets/stage2/grimoire-ledger.json'), 'utf8'))
  for (const l of st2.locks) {
    locks.push({ key: `${speciesOf(l.spirit)}:${l.element}`, name: l.name, src: join(ATHERNYX, 'assets/stage2', l.file) })
  }
  const st3 = JSON.parse(readFileSync(join(ATHERNYX, 'assets/stage3/grimoire-ledger-stage3.json'), 'utf8'))
  for (const l of st3.locks) {
    // ★ Awakened is keyed by BRANCH, not by a second element — a stage-3 form is one of four
    // branches off a stage-2 form, so `<species>:<element>:<branch>` is the whole coordinate.
    locks.push({ key: `${speciesOf(l.spirit)}:${l.element}:${l.branch}`, name: l.name, src: join(ATHERNYX, 'assets/stage3', l.file) })
  }
}

// ── refuse concept sources, and refuse a lock whose file is not there ────────────────────────
const problems: string[] = []
for (const l of locks) {
  if (CONCEPT_ROOTS.some(r => l.src.startsWith(r))) problems.push(`${l.name}: source is CONCEPT art, must never ship — ${l.src}`)
  else if (!existsSync(l.src)) problems.push(`${l.name}: locked file does not exist — ${l.src}`)
}
if (problems.length) {
  console.error(`\n✗ spirit-art refuses to run:\n${problems.map(p => '  · ' + p).join('\n')}\n`)
  process.exit(1)
}

const entries = locks.map(l => [l.key, `/spirits/grimoire/${l.key.replace(/:/g, '-')}.webp`] as const)
  .sort((a, b) => a[0].localeCompare(b[0]))

if (CHECK) {
  console.log(`spirit-art --check: ${locks.length} locked portraits, every source present, none from a concept dir`)
  process.exit(0)
}

// ── write ────────────────────────────────────────────────────────────────────────────────────
if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true })
mkdirSync(OUT_DIR, { recursive: true })
let bytes = 0
for (const l of locks) {
  const dest = join(OUT_DIR, `${l.key.replace(/:/g, '-')}.webp`)
  // `cover` to a square: every source is already a centred portrait on a soft ground, and the UI
  // masks it to an oval, so a square crop loses nothing and keeps one aspect for every tile.
  await sharp(l.src).resize(EDGE, EDGE, { fit: 'cover' }).webp({ quality: 82 }).toFile(dest)
  // ⚠ NOT `metadata().size` — it comes back undefined for webp, so the first version of this line
  // reported "0 KB total" over 548 KB of real files. A total that reads as nothing is the one
  // number nobody double-checks. Ask the filesystem.
  bytes += statSync(dest).size
}

mkdirSync(dirname(MANIFEST), { recursive: true })
writeFileSync(MANIFEST, `// GENERATED by scripts/spirit-art.mts — do not edit by hand.
//
// Keys: '<species>' base · '<species>:<element>' second form · '<species>:<element>:<branch>'
// awakened. Derived from the three lock ledgers in /root/athernyx; \`spirit-art.test.ts\` re-derives
// this and goes red when a ledger gains a lock that has not been regenerated here, so a stale
// manifest cannot pass as a complete one.
//
// ⚠ ONLY LEDGER-LOCKED ART REACHES THIS FILE. The concept renders these were riffed from are
// non-commercial and must never ship; the generator refuses a source under a concept directory.

/** Portrait path by form key, or undefined when that form's art is not locked yet. */
export const SPIRIT_ART: Readonly<Record<string, string>> = Object.freeze({
${entries.map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n')}
})

/** Every form key that has locked art. */
export const SPIRIT_ART_KEYS: readonly string[] = Object.freeze(Object.keys(SPIRIT_ART))
`)

console.log(`spirit-art: ${locks.length} portraits at ${EDGE}px → public/spirits/grimoire (${(bytes / 1024).toFixed(0)} KB total)`)
console.log(`  base ${locks.filter(l => !l.key.includes(':')).length} · second ${locks.filter(l => l.key.split(':').length === 2).length} · awakened ${locks.filter(l => l.key.split(':').length === 3).length}`)
