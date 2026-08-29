// The structure format's oracle. Run: npx tsx src/app/shimmer/voxel/blueprints.test.ts
//
// ★ THE PROPERTY: **a file that loads must mean what it says.** A structure is authored content that
// lives in git and gets stamped into the world, so the failure that matters is not a crash — it is a
// file that parses cleanly and describes a different building than the one somebody built.
import {
  makeBlueprint, normalizeCells, boundsOf, blueprintCells, packCells, blueprintProblems,
  parseBlueprint, serializeBlueprint, stampCells, BLUEPRINT_MAX_SPAN, SAFE_BLUEPRINT_ID,
  type BlueprintCell,
} from './blueprints'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MAT } from './depth'
import { ALL_BLOCKS, type BlockSkill } from './registry'
import { ALL_PIECES, pieceDef, cellsOf } from './pieces'
import { normalize, pieceFootprint, stampPieces, type BlueprintPiece } from './blueprints'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const S = MAT.CUT_STONE
// ⚠⚠ THE SEMICOLON IS LOAD-BEARING AND ITS ABSENCE BLINDS `tsc` ON THE WHOLE PROJECT. An arrow whose
// body is a parenthesized object literal, followed by a bare `{` block, makes the parser report
// `TS1005: '=>' expected` at the BLOCK — and a parse error stops the file, so every later error in
// every later file goes unreported. The project count fell from 7 to 1, which reads as progress.
// ★ `tsx` parses it happily, so the oracle was GREEN the whole time: the PATTERNS note about tsx
// accepting what tsc rejects, wearing a syntax error instead of a type error. Minimal repro:
//     const f = (a: number): T => ({ a })   <newline>   { const x = f(1) }
// ⚠ `m: number`, not `m = S`. Inferred, the default gives the parameter the LITERAL type of
// CUT_STONE, so every other material in this file is a type error — which the parse error above
// was hiding. Three of them.
const cell = (x: number, y: number, z: number, m: number = S): BlueprintCell => ({ x, y, z, m });

// ── 1. ★★ NORMALIZE MOVES THE PILE TO THE ORIGIN AND KEEPS ITS SHAPE ──────────────────────────
{
  const n = normalizeCells([cell(10, 5, 10), cell(12, 5, 10), cell(10, 7, 10)])
  ok(n.length === 3, `all three blocks survive (${n.length})`)
  ok(n.every(c => c.x >= 0 && c.y >= 0 && c.z >= 0), '★ every cell is non-negative after normalizing')
  ok(n.some(c => c.x === 0 && c.y === 0 && c.z === 0), '★★ the min corner lands exactly on the origin')
  const b = boundsOf(n)
  ok(b.w === 3 && b.h === 3 && b.d === 1, `★ and the shape is preserved, not just the position (${b.w}x${b.h}x${b.d})`)
}

// ── 2. ★★★ AIR IS DROPPED, AND A DOUBLE-PLACED CELL KEEPS THE LAST WRITE ──────────────────────
// Storing air would make a stamped structure CARVE HOLES in whatever it lands on — a different
// feature wearing the same file, and one nobody asked for.
{
  const n = normalizeCells([cell(0, 0, 0, MAT.AIR), cell(1, 0, 0, S)])
  ok(n.length === 1 && n[0].m === S, `★★★ air is not stored (${n.length} cell(s))`)
  ok(n[0].x === 0, '★ and the surviving block is re-based, so the dropped air does not shift the origin')

  const twice = normalizeCells([cell(4, 0, 0, S), cell(4, 0, 0, MAT.PLANKS_GOLDWOOD)])
  ok(twice.length === 1 && twice[0].m === MAT.PLANKS_GOLDWOOD,
    '★★ placing on an occupied cell replaces it — what an editor session means by painting twice')
}

// ── 3. ★ THE ORDER IS STABLE, SO A GIT DIFF CARRIES INFORMATION ───────────────────────────────
{
  const a = makeBlueprint('a', 'A', [cell(1, 0, 0), cell(0, 0, 0), cell(0, 1, 0)])
  const b = makeBlueprint('a', 'A', [cell(0, 1, 0), cell(0, 0, 0), cell(1, 0, 0)])
  ok(JSON.stringify(a.cells) === JSON.stringify(b.cells),
    '★ the same building authored in a different order serializes identically')
}

// ── 4. ★★★ THE STORED BOUNDS ARE CHECKED AGAINST THE BLOCKS, NOT TRUSTED ──────────────────────
// The hand-kept mirror (PATTERNS 08-22): a copy and its source agree right up until they do not,
// and agreement between them is not evidence about either. So the file's w/h/d must be re-derived.
{
  const s = makeBlueprint('cottage', 'Cottage', [cell(0, 0, 0), cell(2, 3, 1)])
  ok(s.w === 3 && s.h === 4 && s.d === 2, `★ bounds come out of the blocks (${s.w}x${s.h}x${s.d})`)
  ok(blueprintProblems(s).length === 0, `a well-formed structure has no problems (${blueprintProblems(s).join('; ')})`)

  const lying = { ...s, w: 99 }
  const why = blueprintProblems(lying)
  ok(why.some(m => /disagree/.test(m)),
    `★★★ a file whose stored bounds lie is REFUSED, not believed (${why.join('; ') || 'no problem reported'})`)
}

// ── 5. ★★ EVERY REJECTION HAS AN INPUT THAT FIRES IT ──────────────────────────────────────────
// ⚠ A validator nobody has watched reject anything is decoration. Each case below is the cheapest
// wrong file of its kind — the question is not "does it pass good input" but "can it fail at all".
{
  const good = makeBlueprint('hut', 'Hut', [cell(0, 0, 0)])
  const cases: [string, unknown, RegExp][] = [
    ['a bad id',            { ...good, id: 'Not A Slug' },        /id must match/],
    ['a path-traversal id', { ...good, id: '../../etc' },         /id must match/],
    ['an empty name',       { ...good, name: '  ' },              /name is empty/],
    ['no blocks',           { ...good, cells: [], w: 0, h: 0, d: 0 }, /no blocks/],
    ['a ragged quad array', { ...good, cells: [0, 0, 0] },        /multiple of 4/],
    ['a fractional value',  { ...good, cells: [0, 0.5, 0, S] },   /integer/],
    ['a negative origin',   { ...good, cells: [-1, 0, 0, S] },    /non-negative origin/],
    ['an unknown material', { ...good, cells: [0, 0, 0, 60000] }, /unknown material/],
    ['stored air',          { ...good, cells: [0, 0, 0, MAT.AIR] }, /air is not stored|unknown material/],
    ['not an object',       'a house',                            /not an object/],
  ]
  for (const [what, input, expect] of cases) {
    const why = blueprintProblems(input)
    ok(why.some(m => expect.test(m)),
      `★ ${what} is refused, and the reason says so (${why.join('; ') || 'NOTHING REPORTED'})`)
  }

  // ★★ TWO BLOCKS IN ONE CELL. Reachable only by hand-editing a file, which is exactly when nobody
  // is watching — the editor cannot produce it because normalize collapses them.
  const doubled = { ...good, cells: [0, 0, 0, S, 0, 0, 0, S], w: 1, h: 1, d: 1 }
  ok(blueprintProblems(doubled).some(m => /share the cell/.test(m)),
    '★★ two blocks claiming one cell is refused')

  // ★ AND THE CEILING IS NOT DECORATION EITHER.
  const huge = makeBlueprint('huge', 'Huge', [cell(0, 0, 0), cell(BLUEPRINT_MAX_SPAN, 0, 0)])
  ok(blueprintProblems(huge).some(m => /over the .* ceiling/.test(m)),
    `★ a structure past the span ceiling is refused (${huge.w} wide)`)
}

// ── 6. ★★ THE ROUND TRIP IS LOSSLESS, AND A BROKEN FILE THROWS WITH EVERY REASON AT ONCE ──────
{
  const s = makeBlueprint('barn', 'Barn', [cell(0, 0, 0, S), cell(1, 0, 0, MAT.PLANKS_GOLDWOOD), cell(0, 1, 0, S)])
  const back = parseBlueprint(JSON.stringify(s))
  ok(JSON.stringify(back) === JSON.stringify(s), '★★ a structure survives a write/read round trip byte for byte')
  ok(blueprintCells(back).length === 3 && blueprintCells(back)[0].m === S,
    '★ and unpacks to the same blocks, with materials intact')

  let threw = ''
  try { parseBlueprint('{"id":"x"}') } catch (e) { threw = e instanceof Error ? e.message : String(e) }
  ok(/invalid structure/.test(threw), `★ a malformed file throws rather than loading empty (${threw.slice(0, 40)})`)
  ok(threw.split('\n').length > 2, '★★ and reports EVERY reason at once, so one fix per attempt is not the loop')

  let notJson = ''
  try { parseBlueprint('not json at all') } catch (e) { notJson = e instanceof Error ? e.message : String(e) }
  ok(/not JSON/.test(notJson), '★ and a non-JSON file says THAT, rather than a validation complaint')
}

// ── 7. ★ STAMPING OFFSETS INTO THE WORLD AND CHANGES NOTHING ELSE ─────────────────────────────
{
  const s = makeBlueprint('post', 'Post', [cell(0, 0, 0), cell(0, 1, 0)])
  const at = stampCells(s, { x: 100, y: 64, z: -20 })
  ok(at.length === 2, 'every block is placed')
  ok(at.some(c => c.x === 100 && c.y === 64 && c.z === -20), '★ the structure origin lands on the requested cell')
  ok(at.every(c => c.m === S), '★ and materials are carried through untouched')
  // ⚠ The local copy must not have moved — `stampCells` returning a view onto shared cells would
  // make a second stamp at a different place silently relocate the first.
  ok(blueprintCells(s).every(c => c.x === 0), '★★ and the structure itself is unchanged by being stamped')
}

// ── 8. ★ THE ID PATTERN IS A PATH GUARD, NOT A STYLE RULE ─────────────────────────────────────
{
  for (const bad of ['../x', 'a/b', 'a b', 'A', '', '.hidden', 'x'.repeat(65)]) {
    ok(!SAFE_BLUEPRINT_ID.test(bad), `★ '${bad}' is not a legal id — it becomes a filename`)
  }
  ok(SAFE_BLUEPRINT_ID.test('stone_cottage-2'), 'and an ordinary slug is')
}

// ── 9. ★★★ THE WRITER AND THE READER CANNOT DRIFT ─────────────────────────────────────────────
// The save route used to build the file by string concatenation, which put a second definition of
// the layout in a file whose job is HTTP. A serializer nobody round-trips is a format nobody trusts.
{
  const s = makeBlueprint('quoted', 'A "quoted" name, with a comma', [cell(0, 0, 0), cell(1, 2, 3, MAT.PLANKS_GOLDWOOD)])
  const text = serializeBlueprint(s)
  const back = parseBlueprint(text)
  ok(JSON.stringify(back) === JSON.stringify(s),
    '★★★ what the route writes is exactly what the loader reads back')
  ok(back.name === s.name, '★★ including a name carrying quotes and commas — the hand-rolled writer\'s worst case')
  // Six: the brace, id, name, the bounds line, the cells line, the closing brace.
  const lines = text.split('\n').filter(l => l.trim()).length
  ok(lines === 6, `★ and the file stays diff-readable, cells on one line (${lines} non-empty lines)`)
}

// ── 10. ★★ THE WORKTABLE AND ITS ROUTE ARE WIRED THE WAY THE SECURITY MODEL ASSUMES ───────────
// ⚠ A textual reader of files it does not own fails silently, so each anchor is proved present
// before anything is judged (canon gate, 08-22).
{
  const root = join(__dirname, '../../..')
  const page = readFileSync(join(root, 'app/shimmer/dev/worktable/page.tsx'), 'utf8')
  const route = readFileSync(join(root, 'app/shimmer/save-blueprint/route.ts'), 'utf8')
  const proxy = readFileSync(join(root, 'proxy.ts'), 'utf8')

  ok(page.length > 2000 && route.length > 1000 && proxy.length > 500,
    '★★★ BLIND CHECK: all three files were actually read, so a verdict below means something')

  // ★★★ THE ROUTE IS PROTECTED BY ITS NAME, SO THE NAME IS ASSERTED — AND SO IS THE PREMISE.
  // `proxy.ts` hard-403s `/shimmer/save-*` without the owner cookie. If that prefix ever moves, a
  // route that writes files into the repo becomes an unauthenticated arbitrary file write, and
  // nothing else in this tree would notice. An exemption that asserts its own premise (PATTERNS 08-22).
  ok(/path\.startsWith\("\/shimmer\/save-"\)/.test(proxy),
    '★★★ proxy.ts still owner-gates the /shimmer/save- prefix — the ONLY thing protecting this route')

  // ── ★★★ THE TWO STRUCTURE SYSTEMS MUST NOT SHARE A FOLDER OR A ROUTE ────────────────────────
  // `world/structures.ts` is 2D tile groups and owns `/shimmer/save-structure` + `data/structures/`.
  // This is 3D voxels and owns `/shimmer/save-blueprint` + `data/blueprints/`. On 2026-08-29 this
  // file was born pointing at BOTH of the former, and the collision that would have hurt is the
  // shared directory: each system lists the folder and parses every file as its own format, so the
  // 2D editor would have rendered voxel blueprints as broken tile groups, silently.
  const tileRoute = readFileSync(join(root, 'app/shimmer/save-structure/route.ts'), 'utf8')
  const dirOf = (src: string) => (src.match(/data\/([a-z-]+)/) ?? [])[1]
  ok(!!dirOf(tileRoute) && !!dirOf(route),
    `★★★ BLIND CHECK: both routes name a data directory (2D ${dirOf(tileRoute)}, 3D ${dirOf(route)})`)
  ok(dirOf(tileRoute) !== dirOf(route),
    `★★★ the 2D tile-group system and the voxel blueprints write to DIFFERENT folders (${dirOf(tileRoute)} vs ${dirOf(route)})`)
  ok(!/save-blueprint/.test(tileRoute),
    '★★ and neither route answers on the other\'s path')

  ok(/blueprintProblems/.test(route) && /parseBlueprint/.test(route),
    '★★ the route validates through the shared format on the way in AND on the way out')
  ok(/serializeBlueprint/.test(route) && !/"cells": \[\$\{/.test(route),
    '★★ and writes through the shared serializer rather than re-inventing the layout')

  // ★★ THE PALETTE IS DERIVED. A hand-kept list of material ids here would be a third dialect of
  // the building vocabulary and would go stale the day a block is added.
  ok(/ALL_BLOCKS\.filter\(b => b\.placeable\)/.test(page),
    '★★★ the worktable palette comes off the registry\'s own `placeable` flag, not a literal list')

  // ⚠ THE DIRT-BROWN LESSON, ENFORCED. `dev/court` tagged 480 tower cells `m: 4` — a guess — and
  // rendered the whole tower in dirt while every assert stayed green. A material must be NAMED.
  ok(!/useState<number>\(\s*\d/.test(page),
    '★★★ the default material is a named MAT.* constant, never a numeric literal')

  // ★ It draws with the shipped painter, and defines no painter of its own.
  ok(/buildTileArray/.test(page) && /sliceLayer/.test(page),
    '★★ every texture is sliced out of the array the game samples')
  ok(!/function paintFor|const paintFor/.test(page),
    '★ and the page defines no paint function of its own — seven previews that re-derived were right while the game was wrong')
}

// ── 11. ★★★ THE PALETTE MUST NOT BURY THE THING BELOW IT ──────────────────────────────────────
// Found by LOOKING, not by asserting (2026-08-29). 65 blocks in two columns is 33 rows, and *saved
// structures* — the LOAD half of "view and edit" — sat off the bottom of the viewport. Every assert
// was about correctness and every one passed: the panel was correct and unusable. ⚠ These guards
// exist because the defect returns for free the day someone adds blocks, and nothing would say so.
{
  const root = join(__dirname, '../../..')
  const page = readFileSync(join(root, 'app/shimmer/dev/worktable/page.tsx'), 'utf8')

  // ⚠⚠ COMMENTS STRIPPED FIRST, AND THE MUTATION SWEEP IS WHY. The first cut of this guard did a
  // bare `indexOf('saved structures')` — and the page's own FAMILY docstring EXPLAINS the burial by
  // naming the section, forty lines above the markup. So the guard matched the PROSE, concluded the
  // order was right, and could not have failed however the JSX was arranged. **Documenting a marker
  // created a marker** — the same shape that blinded the canon gate on 08-22, committed by the very
  // comment written to prevent it. Accuracy is not the property that saves you here.
  const markup = page.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*(\/\/|\*|\/\*).*$/gm, '')
  const occurrences = (hay: string, needle: string) => hay.split(needle).length - 1
  ok(occurrences(markup, 'saved structures') === 1 && occurrences(markup, 'material — ') === 1,
    `★★★ BLIND CHECK: each section header appears EXACTLY ONCE in the markup ` +
    `(saved ${occurrences(markup, 'saved structures')}, palette ${occurrences(markup, 'material — ')}) — ` +
    'any other count and this reader is matching something it did not mean to')
  ok(markup.indexOf('saved structures') < markup.indexOf('material — '),
    '★★★ saved structures renders BEFORE the palette — the order IS the fix, asserted so it cannot silently revert')

  // ⚠ A bounded box is the other half: the palette grows every time a block is added, and an
  // unbounded list pushes whatever follows it out of reach no matter what order things are in.
  ok(/maxHeight: '38vh'/.test(page),
    '★★ and the palette lives in its own bounded scroll box, so a new block costs scrolling and nothing else')

  // ★★ THE GROUPING IS DERIVED. A hand-kept family table would go stale the day a block is added —
  // the same failure the palette itself was built to avoid one level up.
  ok(/d\.skill \?\? d\.fastSkill/.test(page),
    '★★★ families come off `skill ?? fastSkill`, the registry\'s own answer to "what tool does this want"')
  ok(/isHalfMat/.test(page) && !/endsWith\('? ?Slab/.test(page),
    '★★ and a slab is identified by the shipped predicate, never by its name ending in " Slab"')
}

// ── 12. ★★★ EVERY PLACEABLE BLOCK LANDS IN EXACTLY ONE FAMILY ─────────────────────────────────
// The grouping is only honest if it PARTITIONS. A block whose tool family the panel does not list
// is invisible in the worktable — placeable, in the registry, and unreachable — and it would be
// invisible silently, which is how a palette quietly stops being the whole vocabulary.
{
  const placeable = ALL_BLOCKS.filter(b => b.placeable)
  ok(placeable.length > 40, `★★ BLIND CHECK: ${placeable.length} placeable blocks — under 40 means this read the wrong set`)

  const FAMILIES: (BlockSkill | null)[] = ['prospecting', 'forestry', 'farming', null]
  const stranded = placeable.filter(b => !FAMILIES.includes(b.skill ?? b.fastSkill ?? null))
  ok(stranded.length === 0,
    `★★★ no placeable block falls outside the four families — ${stranded.map(b => `${b.name}(${b.skill ?? b.fastSkill})`).join(', ') || 'none stranded'}`)

  // ★ AND THE PARTITION IS NOT VACUOUS — every family actually has members, so a grouping that
  // collapsed everything into one bucket would go red rather than look tidy.
  for (const fam of FAMILIES) {
    const n = placeable.filter(b => (b.skill ?? b.fastSkill ?? null) === fam).length
    ok(n > 0, `★ the '${fam ?? 'fixtures'}' family is non-empty (${n} blocks)`)
  }
}

// ── 13. ★★★ THE ROUTE'S RESPONSE KEY AND THE PAGE'S READ MUST BE THE SAME WORD ────────────────
// Found by CLICKING the deployed page, and nothing else could have found it (2026-08-29). After the
// `structure` → `blueprint` rename the route answered `{ blueprints }` while the page still read
// `r?.structures`, so `setList` was never called: the file was on disk, the endpoint returned it,
// the status line said "saved", and the panel rendered "none yet" **forever**.
//
// ⚠⚠ IT IS INVISIBLE TO EVERYTHING ELSE WE HAVE. `fetch(...).json()` is `any`, so tsc cannot see it;
// the format oracle passes because the FORMAT is fine; a screenshot of the first frame passes
// because the list is legitimately empty before anything is saved. Both halves were internally
// consistent about different things — the prebuilt-worker shape, wearing a JSON key.
{
  const root = join(__dirname, '../../..')
  const route = readFileSync(join(root, 'app/shimmer/save-blueprint/route.ts'), 'utf8')
  const page = readFileSync(join(root, 'app/shimmer/dev/worktable/page.tsx'), 'utf8')

  // The key the LIST endpoint actually answers with, read off the route rather than restated here.
  const served = (route.match(/NextResponse\.json\(\{\s*([a-zA-Z]+)\s*\}\)/) ?? [])[1]
  // The key the page reads off that response.
  const read = (page.match(/if \(r\?\.([a-zA-Z]+)\) setList/) ?? [])[1]
  ok(!!served && !!read,
    `★★★ BLIND CHECK: found both sides of the contract (route serves '${served}', page reads '${read}') — ` +
    'a missing side means this reader lost its subject, not that the contract holds')
  ok(served === read,
    `★★★ the list endpoint's key and the page's read are the same word (route '${served}' vs page '${read}')`)
}

// ── 14. ★★★ A BLUEPRINT CARRIES PIECES, BECAUSE BLOCKS ALONE CANNOT MAKE A BUILDING ───────────
// 14 pieces are the building vocabulary — doorway, window, door, shutter, arch, gate, roof_slope,
// roof_cap, stair, beam, fence, half_slab, bracket, hook. A format that stores only raw voxels
// produces block-boxes with a hole where a door goes, and that is what this shipped as.
{
  ok(ALL_PIECES.length >= 14,
    `★★ BLIND CHECK: ${ALL_PIECES.length} pieces in the registry — under 14 and every assert below is vacuous`)

  const piece = (pieceId: string, x: number, y: number, z: number, rot = 0): BlueprintPiece =>
    ({ pieceId, x, y, z, rot: rot as 0 | 1 | 2 | 3 });

  // ★★★ BLOCKS AND PIECES NORMALIZE TOGETHER, ON ONE ORIGIN. Re-basing each on its own minimum
  // slides them apart by the difference: a door that was IN a wall ends up beside it, and nothing
  // reports anything because each collection is internally perfect.
  {
    const n = normalize([cell(10, 5, 10)], [piece('doorway', 12, 5, 10)])
    ok(n.cells[0].x === 0 && n.cells[0].y === 0 && n.cells[0].z === 0, '★ the block lands on the origin')
    ok(n.pieces[0].x === 2 && n.pieces[0].y === 0 && n.pieces[0].z === 0,
      `★★★ and the piece keeps its offset FROM the block (${n.pieces[0].x},${n.pieces[0].y},${n.pieces[0].z}) — not re-based to its own zero`)
  }

  // ★★ A PIECE'S FOOTPRINT IS PART OF THE BUILDING'S SIZE. Bounds over blocks alone report a
  // cottage that does not contain its own roof.
  {
    const s = makeBlueprint('cot', 'Cot', [cell(0, 0, 0)], [piece('roof_cap', 0, 3, 0)])
    ok(s.h === 4, `★★ a roof cap three above the floor makes the blueprint 4 tall (${s.h})`)
    ok(blueprintProblems(s).length === 0, `and it validates (${blueprintProblems(s).join('; ')})`)
    // ⚠ The doorway's PASSABLE cells count too — the bounds must contain the hole you walk through.
    const d = makeBlueprint('d', 'D', [cell(0, 0, 0)], [piece('doorway', 0, 0, 1)])
    ok(d.h === 3 && d.d === 2, `★★ a doorway's passable cells are still footprint (${d.w}x${d.h}x${d.d})`)
  }

  // ★★ A BLUEPRINT OF PIECES ALONE IS LEGITIMATE — a fence line, an arch. The old rule said "no
  // blocks is not a structure", which was right when blocks were the only content and became wrong
  // the moment pieces arrived.
  {
    const f = makeBlueprint('fence', 'Fence', [], [piece('fence', 0, 0, 0), piece('fence', 1, 0, 0)])
    ok(blueprintProblems(f).length === 0,
      `★★ pieces with no blocks is a blueprint (${blueprintProblems(f).join('; ') || 'valid'})`)
    ok(blueprintProblems(makeBlueprint('e', 'E', [], [])).some(m => /no blocks and no pieces/.test(m)),
      '★ while nothing at all is still refused')
  }

  // ★★★ EVERY PIECE REJECTION HAS AN INPUT THAT FIRES IT.
  {
    const good = makeBlueprint('h', 'H', [cell(0, 0, 0)], [piece('fence', 0, 1, 0)])
    const cases: [string, unknown, RegExp][] = [
      ['an unknown piece id', { ...good, pieces: [piece('trebuchet', 0, 1, 0)] }, /unknown piece id/],
      ['a rotation of 7',     { ...good, pieces: [{ ...piece('fence', 0, 1, 0), rot: 7 }] }, /rotation 7, not 0-3/],
      ['a fractional position', { ...good, pieces: [piece('fence', 0.5, 1, 0)] }, /non-integer position/],
      ['pieces not an array',  { ...good, pieces: 'a door' }, /pieces is not an array/],
    ]
    for (const [what, input, expect] of cases) {
      const why = blueprintProblems(input)
      ok(why.some(m => expect.test(m)), `★ ${what} is refused (${why.join('; ') || 'NOTHING REPORTED'})`)
    }

    // ⚠ SOLID-vs-SOLID ONLY, AND THE PASSABLE CASE MUST STILL PASS. An arch's opening and a bracket
    // hung in it legitimately share a cell; two solid pieces in one place is a file no editor can
    // produce. Getting this backwards would refuse ordinary building.
    const stacked = { ...makeBlueprint('s', 'S', [], [piece('fence', 0, 0, 0)]),
                      pieces: [piece('fence', 0, 0, 0), piece('roof_cap', 0, 0, 0)] }
    ok(blueprintProblems(stacked).some(m => /both fill the cell/.test(m)),
      `★★★ two SOLID pieces in one cell is refused (${blueprintProblems(stacked).join('; ') || 'NOTHING'})`)
    const nested = makeBlueprint('n', 'N', [], [piece('arch', 0, 0, 0), piece('bracket', 1, 0, 0)])
    ok(blueprintProblems(nested).length === 0,
      `★★★ but a bracket inside an arch's OPENING is allowed — passable cells may overlap (${blueprintProblems(nested).join('; ')})`)
  }

  // ★★ ROUND TRIP WITH PIECES, AND SAVE-COMPAT WITHOUT THEM.
  {
    const withP = makeBlueprint('barn', 'Barn', [cell(0, 0, 0)], [piece('doorway', 1, 0, 0, 2)])
    const back = parseBlueprint(serializeBlueprint(withP))
    ok(JSON.stringify(back) === JSON.stringify(withP), '★★ a blueprint with pieces survives write/read')
    ok(back.pieces?.[0].rot === 2, '★ rotation intact')

    // ⚠⚠ THE COMPAT CLAIM, ASSERTED RATHER THAN TRUSTED. Every blueprint written before pieces
    // existed has no `pieces` key, and emitting `"pieces": []` would rewrite all of them on first read.
    const noP = makeBlueprint('old', 'Old', [cell(0, 0, 0)])
    ok(!('pieces' in noP), '★★★ a piece-less blueprint has NO pieces key at all, not an empty array')
    ok(!/pieces/.test(serializeBlueprint(noP)),
      `★★★ and the serialized file never mentions pieces (${serializeBlueprint(noP).replace(/\n/g, ' ')})`)
  }

  // ★ STAMPING PIECES IS A TRANSLATION AND NOTHING ELSE.
  {
    const s = makeBlueprint('p', 'P', [], [piece('fence', 0, 0, 0), piece('fence', 2, 0, 0)])
    const at = stampPieces(s, { x: 100, y: 64, z: -20 })
    ok(at.length === 2 && at[0].x === 100 && at[0].y === 64 && at[0].z === -20, '★ pieces land at the world origin')
    ok(at[1].x === 102, '★ keeping their relative offsets')
    ok(at.every(q => q.pieceId === 'fence' && q.rot === 0), '★ id and rotation carried through')
    ok((s.pieces ?? [])[0].x === 0, '★★ and the blueprint itself is unchanged by being stamped')
  }

  // ★★★ THE FOOTPRINT COMES FROM `cellsOf`, NOT FROM A SECOND DERIVATION IN THIS FILE.
  {
    const p = piece('arch', 0, 0, 0)
    const mine = pieceFootprint(p)
    const theirs = cellsOf(p, pieceDef('arch')!)
    ok(mine.length === theirs.length && mine.length === 9,
      `★★★ pieceFootprint returns exactly what the shipped helper returns (${mine.length} vs ${theirs.length})`)
    ok(pieceFootprint(piece('trebuchet', 0, 0, 0)).length === 0,
      '★ and an unknown id footprints as nothing rather than throwing — callers validate first')
  }
}

if (fails.length) {
  console.log(`\n${fails.map(f => `  ✗ ${f}`).join('\n')}\n`)
  console.log(`❌ ${fails.length} failed, ${pass} passed`)
  process.exit(1)
}
console.log(`✅ a structure file means what it says — ${pass} passed`)
