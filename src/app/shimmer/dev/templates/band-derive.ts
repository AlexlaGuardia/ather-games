/**
 * WHICH GAME'S DATA DOES THIS EDITOR ACTUALLY AUTHOR?
 *
 * ★★★ WHY THIS EXISTS (2026-09-02, hub lane). Alex, looking at the dev index shipped the night
 * before: *"it looks like we have a bunch of the old pixel game editors mixed in here.. but i
 * wonder why? this has nothing to do with our game anymore.. just add useless clutter, no?"*
 *
 * He was half right, and the half he was right about is the sharper half. `/shimmer` has
 * redirected to `voxel3d` since 2026-08-07 and the 2D game was archived 2026-07-21 — so the
 * original consumer of these editors is genuinely gone. But measured against the real import
 * closure of the shipped voxel game, a MAJORITY of the thirty still author data it runs on:
 * alchemy, farming, skills, tools, moves, encounters, evolution, resources, items. Deleting the
 * block would have taken the live tables with it.
 *
 * ⚠ AND THEY DID NOT BECOME CLUTTER — THEY BECAME VISIBLE. The 09-01 index promoted sixteen
 * URL-only pages and thirty editors into something clickable for the first time. Reachability did
 * not make any of them wrong; it made them READ. PATTERNS 2026-09-01 asks exactly this on any
 * change that improves discoverability: *what is now being believed that was previously only
 * being stored?* The answer here was "that every editor on this page is current", and it was not.
 *
 * ── ★★ WHY THIS IS DERIVED AND NOT A LIST ────────────────────────────────────────────────────
 * The obvious fix is a hand-kept `orphaned: true` flag per editor. That is precisely the artefact
 * PATTERNS 2026-08-22 names: an exemption is a silent promise that somebody is watching that
 * corner, and it is the thing still sitting there a month after its reason expired. Worse, a
 * hand-kept band would AGREE with itself forever — a copy and its original agreeing is not
 * evidence about either.
 *
 * So the band is computed from the actual transitive import graph of the two shipped entry
 * points, and `editor-bands.generated.ts` is a CACHE of that computation, not a source of truth.
 * `editor-bands.test.ts` re-derives and asserts the cache matches. The day an editor's last
 * consumer disappears, the band changes under it and the guard goes red naming the editor.
 *
 * ── ⚠ WHAT THIS MEASURES, AND WHAT IT DOES NOT ───────────────────────────────────────────────
 * It reads the STATIC import graph. It therefore does NOT see:
 *   · data a game reads at RUNTIME through a save route or fetch rather than an import
 *   · a module reached only through a string-keyed dynamic path
 *   · whether the live game's use of a module is load-bearing or vestigial
 * A `live` band means the shipped bundle imports that module. It is not a claim that the editor
 * is USEFUL, and an `orphan` band is a prompt to look, never an instruction to delete.
 *
 * ★★ AND THE BLINDNESS IS A BAND OF ITS OWN, BECAUSE IT HAD TO BE. `mana` and `daycycle` import no
 * data module and still carry a Deploy button — they author through a save route the import graph
 * cannot see. Filing them under `tool` beside Banner and Spinner would have been the comfortable
 * reading and a false one: it would report *"not a data editor"* about two data editors. They band
 * `opaque` instead, which says what is true — this editor writes something, and THIS INSTRUMENT
 * CANNOT SEE WHAT. PATTERNS 2026-08-31: the failure mode that would be safe, an instrument
 * announcing its own blindness, essentially never happens on its own. It has to be built in.
 *
 * ⚠ NODE-ONLY. Uses `node:fs`. Never import this from a client component — `editor-bands.test.ts`
 * asserts that nothing under `dev/` outside the test and the generator does.
 */
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname, resolve as pathResolve, relative } from 'node:path'

export type Band = 'live' | 'legacy' | 'orphan' | 'tool' | 'opaque'

export interface EditorBand {
  /** `?mode=` id, exactly as the hub routes it. */
  id: string
  /** Editor component file, relative to `src/app/shimmer/dev/editors/`. */
  file: string
  band: Band
  /** Data modules this editor imports that the shipped voxel game also imports. */
  live: string[]
  /** Data modules reachable only from `play3d` — the legacy route the port still mines. */
  legacy: string[]
  /** Data modules no shipped game imports at all. These are what the card names. */
  orphan: string[]
  /** Does the hub give this editor a Deploy button? Read from `EDITOR_MAP`. */
  deployable: boolean
}

/** Directories that hold GAME DATA. Everything else an editor imports is infrastructure. */
const DATA_DIRS = ['engine', 'spirits', 'sprites', 'world', 'data', 'voxel'] as const

const SRC = () => join(process.cwd(), 'src')

/** Resolve an import specifier the way the bundler would, or null if it is a package. */
function resolveSpec(spec: string, fromFile: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = join(SRC(), spec.slice(2))
  else if (spec.startsWith('.')) base = pathResolve(dirname(fromFile), spec)
  else return null
  for (const c of [`${base}.ts`, `${base}.tsx`, `${base}.js`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(c) && statSync(c).isFile()) return c
  }
  return null
}

const IMPORT_RE = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g

/** Every file reachable from `entry`, following static AND `dynamic(() => import(...))` edges. */
export function importClosure(entry: string): Set<string> {
  const seen = new Set<string>()
  const stack = [entry]
  while (stack.length) {
    const file = stack.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    let src: string
    try { src = readFileSync(file, 'utf8') } catch { continue }
    IMPORT_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = IMPORT_RE.exec(src))) {
      const r = resolveSpec(m[1], file)
      if (r) stack.push(r)
    }
  }
  return seen
}

/** `/abs/src/app/shimmer/engine/alchemy.ts` -> `engine/alchemy`, or null if not game data. */
function dataModule(absFile: string): string | null {
  const rel = relative(join(SRC(), 'app/shimmer'), absFile)
  if (rel.startsWith('..')) return null
  const parts = rel.split('/')
  if (!(DATA_DIRS as readonly string[]).includes(parts[0])) return null
  return rel.replace(/\.(ts|tsx)$/, '')
}

/**
 * The editor roster, read out of `page.tsx`.
 *
 * ⚠ THIS IS A TEXTUAL READER OVER A FILE IT DOES NOT OWN, which PATTERNS 2026-08-22 calls a
 * standing claim that fails SILENTLY — `String.match` returning nothing looks exactly like "there
 * are no editors". Both regexes therefore have to hit, and every id has to resolve to a real file;
 * the caller asserts the count. "I could not look" must not read as "nothing to band".
 */
export function readEditorRoster(): { id: string; file: string; abs: string; deployable: boolean }[] {
  const pageFile = join(SRC(), 'app/shimmer/dev/page.tsx')
  const page = readFileSync(pageFile, 'utf8')

  // `const SpriteEditor = dynamic(() => import('./editors/SpriteEditor'))`
  const byComponent = new Map<string, string>()
  for (const m of page.matchAll(/const\s+(\w+)\s*=\s*dynamic\(\s*\(\)\s*=>\s*import\(\s*'\.\/editors\/([\w-]+)'/g)) {
    byComponent.set(m[1], m[2])
  }
  // `  alchemy:    { component: AlchemyEditor, deployable: true },`
  const roster: { id: string; file: string; abs: string; deployable: boolean }[] = []
  for (const m of page.matchAll(/^\s*(\w+):\s*\{\s*component:\s*(\w+)\s*,\s*deployable:\s*(true|false)/gm)) {
    const [, id, comp, dep] = m
    const file = byComponent.get(comp)
    if (!file) continue
    const abs = join(SRC(), 'app/shimmer/dev/editors', `${file}.tsx`)
    if (!existsSync(abs)) continue
    roster.push({ id, file: `${file}.tsx`, abs, deployable: dep === 'true' })
  }
  return roster.sort((a, b) => a.id.localeCompare(b.id))
}

/** The data modules one editor imports directly. */
function editorDataDeps(absEditor: string): string[] {
  const src = readFileSync(absEditor, 'utf8')
  const out = new Set<string>()
  IMPORT_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = IMPORT_RE.exec(src))) {
    const r = resolveSpec(m[1], absEditor)
    if (!r) continue
    const d = dataModule(r)
    if (d) out.add(d)
  }
  return [...out].sort()
}

export interface Derivation {
  bands: EditorBand[]
  /** Closure sizes, so a caller can assert the instrument saw anything at all. */
  liveSize: number
  legacySize: number
}

/**
 * Band every editor against the two shipped entry points.
 *
 * Priority is orphan > legacy > live on PURPOSE: an editor that authors one dead module and five
 * live ones is still authoring a dead module, and that is the fact worth surfacing. The card names
 * the modules, so a coarse band never has to carry the whole answer.
 */
export function deriveBands(): Derivation {
  const liveClosure = importClosure(join(SRC(), 'app/shimmer/voxel3d/page.tsx'))
  const legacyClosure = importClosure(join(SRC(), 'app/shimmer/play3d/page.tsx'))

  const liveMods = new Set<string>()
  for (const f of liveClosure) { const d = dataModule(f); if (d) liveMods.add(d) }
  const legacyMods = new Set<string>()
  for (const f of legacyClosure) { const d = dataModule(f); if (d) legacyMods.add(d) }

  const bands = readEditorRoster().map(({ id, file, abs, deployable }): EditorBand => {
    const deps = editorDataDeps(abs)
    const live = deps.filter(d => liveMods.has(d))
    const legacy = deps.filter(d => !liveMods.has(d) && legacyMods.has(d))
    const orphan = deps.filter(d => !liveMods.has(d) && !legacyMods.has(d))
    const band: Band =
      deps.length === 0 ? (deployable ? 'opaque' : 'tool') :
      orphan.length > 0 ? 'orphan' :
      legacy.length > 0 ? 'legacy' : 'live'
    return { id, file, band, live, legacy, orphan, deployable }
  })

  return { bands, liveSize: liveClosure.size, legacySize: legacyClosure.size }
}

/**
 * Render the band cache exactly as `editor-bands.generated.ts` must look on disk.
 *
 * ★ THE RENDERER LIVES BESIDE THE DERIVATION, NOT IN THE CLI, so `editor-bands.test.ts` can compare
 * the file on disk against THIS function instead of re-implementing the format. A guard that
 * restates its subject's format is a second derivation, and two derivations drift apart
 * (PATTERNS 2026-08-22: compare the derivations, not the values).
 */
export function renderBands(): string {
  const { bands, liveSize, legacySize } = deriveBands()
  const rows = bands.map(b =>
    `  { id: ${JSON.stringify(b.id)}, file: ${JSON.stringify(b.file)}, band: ${JSON.stringify(b.band)}, deployable: ${b.deployable},\n` +
    `    live: ${JSON.stringify(b.live)}, legacy: ${JSON.stringify(b.legacy)}, orphan: ${JSON.stringify(b.orphan)} },`
  ).join('\n')

  return [
    '/**',
    ' * GENERATED — DO NOT EDIT BY HAND. Run `npm run gen:bands`.',
    ' *',
    " * Which game's data each dev editor authors, computed from the real transitive import graph of",
    ' * the two shipped entry points. `editor-bands.test.ts` re-derives this and goes red if it has',
    ' * drifted, so this file is a CACHE OF A COMPUTATION rather than a hand-kept list somebody has to',
    ' * remember to update. `band-derive.ts` says why that distinction is the entire point.',
    ' *',
    ` * Derived against: voxel3d closure ${liveSize} files, play3d closure ${legacySize} files.`,
    ' */',
    "export type Band = 'live' | 'legacy' | 'orphan' | 'tool' | 'opaque'",
    '',
    'export interface EditorBand {',
    '  id: string',
    '  file: string',
    '  band: Band',
    '  deployable: boolean',
    '  live: string[]',
    '  legacy: string[]',
    '  orphan: string[]',
    '}',
    '',
    'export const BAND_LABELS: Record<Band, { label: string; note: string }> = {',
    "  live:   { label: 'Live',     note: 'Authors data the shipped voxel game imports.' },",
    "  legacy: { label: 'Legacy',   note: 'Authors data only play3d imports — the legacy route the voxel port still mines.' },",
    "  orphan: { label: 'Orphaned', note: 'Authors at least one module no shipped game imports. The card names them.' },",
    "  opaque: { label: 'Opaque',   note: 'Deploys, but writes through a save route the import graph cannot see.' },",
    "  tool:   { label: 'Tool',     note: 'Not a data editor. Its usefulness does not depend on any game.' },",
    '}',
    '',
    'export const EDITOR_BANDS: EditorBand[] = [',
    rows,
    ']',
    '',
    'export const bandOf = (id: string): EditorBand | undefined => EDITOR_BANDS.find(b => b.id === id)',
    '',
  ].join('\n')
}
