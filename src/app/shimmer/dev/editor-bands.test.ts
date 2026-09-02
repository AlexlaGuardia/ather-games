/**
 * THE BAND CACHE IS A COMPUTATION, NOT A CLAIM.
 *
 * ★★★ WHY THIS EXISTS (2026-09-02, hub lane). `editor-bands.generated.ts` tells the dev index which
 * game each editor's data belongs to. The obvious way to produce that is a hand-kept flag per
 * editor, and PATTERNS 2026-08-22 is unambiguous about what that becomes: an exemption is a silent
 * promise that somebody is watching that corner, and the hand-kept list is the artefact still
 * sitting there a month after its reason expired. Worse than stale — a hand-kept band would AGREE
 * WITH ITSELF FOREVER, and *"I checked, the file says orphaned"* is exactly what a stale mirror
 * produces.
 *
 * So the band is derived from the real import closure of the two shipped entry points, and this
 * guard re-derives it from scratch and asserts the cache still matches. The day an editor's last
 * consumer disappears — or comes back — the band moves under it and this goes red naming it.
 *
 * ⚠ AND IT MUST NOT GO BLIND, IN THE ONE WAY THAT MATTERS HERE. `band-derive.ts` reads the roster
 * out of `page.tsx` with a REGEX, which PATTERNS 2026-08-22 calls a standing claim about a file the
 * reader does not own, failing SILENTLY: a pattern that matches nothing yields an empty roster, an
 * empty cache, and a comparison of two empty things that passes. The roster count is therefore
 * asserted against `EDITOR_MAP`'s own entry count, independently counted.
 *
 * Run: `npx tsx src/app/shimmer/dev/editor-bands.test.ts`
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { deriveBands, importClosure, readEditorRoster } from './templates/band-derive'
import { EDITOR_BANDS, BAND_LABELS, type Band } from './templates/editor-bands.generated'
import { renderBands } from './templates/band-derive'

let pass = 0
const fails: string[] = []
function ok(cond: boolean, label: string) {
  if (cond) pass++
  else fails.push(label)
}

const SRC = join(process.cwd(), 'src')
const OUT = join(SRC, 'app/shimmer/dev/templates/editor-bands.generated.ts')

const { bands, liveSize, legacySize } = deriveBands()

// ── BLIND CHECKS — before anything else ───────────────────────────────────────────────────────
ok(liveSize > 50, `BLIND: the voxel3d closure resolved only ${liveSize} files — the resolver has stopped following imports, and every module would read as orphaned`)
ok(legacySize > 50, `BLIND: the play3d closure resolved only ${legacySize} files`)
ok(bands.length > 0, 'BLIND: no editors were banded — the page.tsx roster regex matched nothing')
ok(EDITOR_BANDS.length > 0, 'BLIND: the generated cache is empty, so every comparison below is vacuous')

/**
 * ★ THE ROSTER COUNT, COUNTED A SECOND WAY. `readEditorRoster` needs BOTH its regexes to hit; if
 * either drifts it silently returns a short list, and a short list bands fewer editors rather than
 * failing. This counts `EDITOR_MAP`'s entries independently and demands they agree.
 */
const pageSrc = readFileSync(join(SRC, 'app/shimmer/dev/page.tsx'), 'utf8')
const mapBody = pageSrc.slice(pageSrc.indexOf('EDITOR_MAP'))
const entryCount = [...mapBody.matchAll(/^\s*\w+:\s*\{\s*component:\s*\w+\s*,\s*deployable:/gm)].length
ok(entryCount > 0, 'BLIND: independent count of EDITOR_MAP entries is zero — this cross-check cannot see its subject')
ok(readEditorRoster().length === entryCount, `ROSTER SHORT: banded ${readEditorRoster().length} editors but EDITOR_MAP has ${entryCount} entries — a regex in band-derive has drifted off page.tsx`)

// ── CONTROLS — the closure must discriminate, not merely return something ─────────────────────
// ⚠ PATTERNS 2026-08-31: a probe with a known-present target is the only thing that tells you the
// search works at all, and the strongest form has a known-ABSENT target too. A closure that
// returned every file in the repo would pass every membership check below.
const live = importClosure(join(SRC, 'app/shimmer/voxel3d/page.tsx'))
const has = (p: string) => live.has(join(SRC, p))
ok(has('app/shimmer/engine/alchemy.ts'), 'CONTROL FAILED: engine/alchemy is not in the voxel closure, but voxel3d imports it — the resolver is broken')
ok(has('app/shimmer/voxel/greedy.ts'), 'CONTROL FAILED: voxel/greedy is not in the voxel closure')
ok(!has('app/shimmer/dev/editors/BeastEditor.tsx'), 'CONTROL FAILED: a dev editor is inside the shipped game closure — the closure is not discriminating')
ok(!has('app/shimmer/sprites/beasts.ts'), 'CONTROL FAILED: sprites/beasts reads as live — it is PARKED art with no renderer, and its editor and doctor check were deleted 2026-09-02. If this fires, followers reached voxel3d and the park note is stale.')

// ── THE CACHE MATCHES THE DERIVATION ──────────────────────────────────────────────────────────
// One string compare, because the generator is the single renderer of this file: a field-by-field
// comparison would be a SECOND derivation that can drift from the first.
ok(readFileSync(OUT, 'utf8') === renderBands(), 'CACHE STALE: editor-bands.generated.ts no longer matches a fresh derivation — run `npm run gen:bands` and read the diff before committing it, because it is telling you an editor changed which game it feeds')

// ── SHAPE ─────────────────────────────────────────────────────────────────────────────────────
const KNOWN: Band[] = ['live', 'legacy', 'orphan', 'tool', 'opaque']
for (const b of EDITOR_BANDS) {
  ok(KNOWN.includes(b.band), `UNKNOWN BAND: ${b.id} is "${b.band}"`)
  ok(BAND_LABELS[b.band] !== undefined, `UNLABELLED BAND: "${b.band}" has no entry in BAND_LABELS, so the index would render a blank badge for ${b.id}`)
  // An orphan band that names no module is an accusation with no evidence on it.
  if (b.band === 'orphan') ok(b.orphan.length > 0, `ORPHAN WITH NOTHING NAMED: ${b.id} bands orphan but lists no dead module`)
  if (b.band === 'live') ok(b.orphan.length === 0 && b.legacy.length === 0, `MISBANDED: ${b.id} bands live while listing non-live modules`)
  if (b.band === 'tool') ok(!b.deployable, `MISBANDED: ${b.id} bands "tool" but the hub gives it a Deploy button — it authors something and should band "opaque"`)
}

// ── EVERY EDITOR THE INDEX CAN OPEN HAS A BAND ────────────────────────────────────────────────
// The index badges from this file. An editor present in the hub but absent here renders unbadged,
// which reads as "no band computed" and is indistinguishable from "band is fine".
const banded = new Set(EDITOR_BANDS.map(b => b.id))
for (const { id } of readEditorRoster()) {
  ok(banded.has(id), `UNBANDED EDITOR: "${id}" is routable in the hub but missing from the cache — it would render with no badge`)
}

// ── REPORT ────────────────────────────────────────────────────────────────────────────────────
const tally = EDITOR_BANDS.reduce<Record<string, number>>((a, b) => ({ ...a, [b.band]: (a[b.band] ?? 0) + 1 }), {})
console.log(`editor-bands: ${pass} pass, ${fails.length} fail`)
console.log(`  closures: voxel3d ${liveSize} files, play3d ${legacySize} files`)
console.log(`  ${EDITOR_BANDS.length} editors — ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(', ')}`)
if (fails.length) {
  for (const f of fails) console.error(`  ✗ ${f}`)
  process.exit(1)
}
