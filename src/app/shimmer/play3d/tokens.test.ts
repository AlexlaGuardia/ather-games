// ── The guard that keeps the walker's vocabulary from rotting back into 761 colours ────────────
// Run: npx tsx src/app/shimmer/play3d/tokens.test.ts
//
// `tokens.ts` is only half a fix. The other half is this file, because the thing that produced 761
// distinct colours (459 used exactly once) was never a shortage of taste — it was that nothing
// OBLIGED two panels to agree. A style guide is a hand-kept list, and a hand-kept list of "things
// that must match" is precisely the shape that rots: this repo already carries a March-era style
// guide nobody follows, and `ui.tsx` carried a header promising the menus "can't drift" while six
// call sites drifted straight through the props it handed them.
//
// WHAT IT CHECKS
//   A. a CONVERTED file holds no raw colour literal at all
//   B. CONVERTED ∪ PENDING is EXACTLY the play3d source list — so a NEW file fails until classified
//   C. no token VALUE is re-spelled as a literal inside a converted file
//   D. a converted file uses only the radius ladder
//   E. the sweep actually read the files it claims to have read
//   F. the scope filter tells a colour literal from a row citation in prose
//
// ⚠ B IS THE ONE THAT MATTERS AND IT IS WHY THIS IS NOT AN EXEMPTION LIST. An exemption is a silent
// promise that somebody is watching that corner, and it outlives the reason it was written. PENDING
// is asserted to match the filesystem EXACTLY: add a file and the guard goes red until you classify
// it, convert a file and forget to promote it and the guard goes red too. It can only shrink, and
// it cannot go quietly stale.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as T from './tokens'

const DIR = join(process.cwd(), 'src/app/shimmer/play3d')

/**
 * Files whose colour comes entirely from `tokens.ts`. Adding a name here without converting the
 * file turns assert A red, which is the intended direction: the list cannot lie in the cheap way.
 */
// vessel-art.tsx was born converted (2026-09-09): two literals, both tokens from the day it was written
// GfxPanel.tsx + MoveBook.tsx converted 2026-09-23 by the Carved Hearth column pass: every colour an hk-* class or an
// `H` token, radii on the ladder. (MoveBook keeps `rune.glow` / `e.accent` — per-rune/element DATA, not literals.)
// StationMenus.tsx converted the same day: the five station menus on the hearth kit, zero literals.
// PartyPanel.tsx + WorldMap.tsx converted the same day (the play3d hearth pass): the party on HearthFrame with `hk-*` /
// `H`, keeping only ELEMENT_COLORS (per-element DATA); the map's picture palette moved to `tokens.map` unchanged.
// ui.tsx LEFT the list that day by drawing nothing any more — its SlotGrid + StationShell went to the
// hearth, and what remains (menuBtn, TOOL_HUD, data) is token-built with no markup, so it is not colour-bearing.
// Shimmer3D.tsx, page.tsx, RemotePlayers.tsx converted 2026-09-23 by the scene-palette pass (radii snapped to the
// ladder, ≤1px each); npcs3d.ts LEFT the list the same day by holding no colour any more (its tints are `npcTint`): what their
// menus did not already take from the hearth, they now take from `scene-palette.ts` — every value moved, none chosen.
const CONVERTED = ['GfxPanel.tsx', 'MoveBook.tsx', 'page.tsx', 'PartyPanel.tsx', 'PassagePanel.tsx', 'RemotePlayers.tsx',
  'Shimmer3D.tsx', 'StationMenus.tsx', 'TremorRing.tsx', 'vessel-art.tsx', 'WorldMap.tsx']

/**
 * Still holding raw literals. NOT an exemption — a worklist with a red light on it (assert B).
 * Delete a name from here the moment its file is clean.
 *
 * ★ EMPTY SINCE 2026-09-23. The menus went to the hearth; what remained was the scene, and the scene
 * got a home (`scene-palette.ts`, below). Keep the list: a new file that holds a literal lands here
 * or in CONVERTED, and assert B still refuses one that lands nowhere.
 */
const PENDING: string[] = []

/**
 * PALETTES — the only files besides `tokens.ts` allowed to hold a colour literal, because holding the
 * picture's colours is their whole job. NOT an exemption either, for the same reason PENDING is not:
 * each one is held to what a palette is, and the moment it stops being one it goes red —
 *   G1. it is `.ts`, so it cannot contain JSX
 *   G2. it builds no style object and names no StationShell (it colours, it does not draw)
 *   G3. it never re-spells a `tokens.ts` value — a colour the menus already own is IMPORTED
 * G3 is the drift shape this whole guard exists for, arriving through the one door that allows hex.
 *
 * `scene-palette.ts` — the world, the Crucible's gun HUD (dark by Alex's ruling, 2026-09-23), the
 * world-space labels, the cuts. `moglin-look.ts` — the moglin's fur + collar, a leaf so the clay
 * bench can import it without dragging the scene.
 */
const PALETTE = ['moglin-look.ts', 'scene-palette.ts']

/**
 * Strip comments so prose can never be mistaken for code.
 *
 * ⚠ THIS IS LOAD-BEARING, NOT HYGIENE. `tokens.ts` documents the census in its own header and
 * quotes a dozen hex literals to do it; `ui.tsx` explains the drift it fixed by naming the colours
 * it removed. A scanner that reads comments would find "drift" in the very files that fixed it —
 * and on 2026-08-22 this repo's canon gate was fooled by exactly that, a file whose header quoted
 * its own marker and handed every reader a second match. Tracks string state so a `//` inside a
 * string literal is not mistaken for a comment.
 */
function stripComments(src: string): string {
  let out = '', i = 0, str: string | null = null
  while (i < src.length) {
    const c = src[i], n = src[i + 1]
    if (str) {
      if (c === '\\') { out += '  '; i += 2; continue }
      if (c === str) str = null
      out += c; i++; continue
    }
    if (c === '"' || c === "'" || c === '`') { str = c; out += c; i++; continue }
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i++ } continue }
    if (c === '/' && n === '*') { i += 2; out += '  '; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++ } i += 2; out += '  '; continue }
    out += c; i++
  }
  return out
}

let pass = 0
const fails: string[] = []
const ok = (cond: boolean, msg: string) => { if (cond) pass++; else fails.push(msg) }

// ── the source list, straight off disk ─────────────────────────────────────────────────────────
/**
 * What puts a file in scope at all. ONE definition, used by the sweep below AND by the self-test in
 * F — never restated, because a hand-kept second copy of a derivation agrees with its original right
 * up until it doesn't, and then it manufactures a green.
 *
 * ⚠ IT READS THE STRIPPED SOURCE, AND THAT IS THE WHOLE POINT. Until 2026-08-27 this one filter read
 * the RAW file while every other check in here stripped first, so prose was scanned as if it were
 * code. `#` plus three hex-ish characters IS a valid short colour, and this repo cites focus rows
 * exactly that way — so `collar-raid.ts (#294)` and `multiplayer.ts (#692)`, two pure-logic modules
 * with no colour anywhere in them, were pulled into scope by their own header and then had to be
 * listed in PENDING to keep assert B quiet. PENDING says "still holding raw literals". For those two
 * it was simply false, and it would have stayed false forever: nobody can convert a file that has
 * nothing to convert. An exemption at least reads as an exemption; this read as WORK.
 *
 * ⚠ AND DELIMITING THE MATCH DOES NOT FIX IT — the tempting cheap version of this repair. `(#294)`
 * is preceded by `(` and followed by `)`: cleanly delimited, and still a valid three-digit hex. The
 * only property that separates a citation from a colour is which side of a comment marker it is on.
 */
// A colour never stands inside a run of `#`: the Hold's ASCII floor plans (`hold-floors.ts`) draw walls
// as `#`, so a wall beside gate `AAAA` spelled `#AAAA` and pulled a data file into scope (09-25).
const COLOUR_BEARING = /(?<![#\w])#[0-9a-fA-F]{3,8}(?![\w#])|StationShell|style=\{\{/
const bearsColour = (src: string) => COLOUR_BEARING.test(stripComments(src))

const onDisk = readdirSync(DIR)
  .filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')))
  .filter(f => !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'))
  .filter(f => f !== 'tokens.ts')
  // data/logic modules carry no colour; only files that render are in scope.
  .filter(f => bearsColour(readFileSync(join(DIR, f), 'utf8')))
  .sort()

// ── F. the scope filter itself, both directions ────────────────────────────────────────────────
// A guard nobody has watched fail is a guard nobody has tested, and this one's failure mode is
// silent over-collection rather than a red light. Both asserts have an input that makes them fire:
// break the stripping and the first goes red, break the detector and the second does.
ok(!bearsColour('// raiders for the Ather regions (#294).\nexport const n = 1\n'),
  'F: a row citation in a line comment classifies a pure-logic file as colour-bearing')
ok(!bearsColour('/* ★ PER-KEEPER, NOT PER-BROWSER (#692 follow-on). */\nexport const n = 1\n'),
  'F: a row citation in a block comment classifies a pure-logic file as colour-bearing')
ok(!bearsColour("const PLAN = ['#####AAAA#####', '#.....BB.....#']\n"),
  'F: a wall-and-gate run in an ASCII floor plan classifies a data file as colour-bearing')
ok(bearsColour("const bg = '#ff8800'\n"),
  'F: the detector stopped seeing a real colour literal in code')

// ── E. the sweep read something ────────────────────────────────────────────────────────────────
// A scan that silently matched nothing returns "no drift found", which is the same shape as "I
// could not look". Those must not share an exit code.
ok(onDisk.length >= 10, `E: sweep found only ${onDisk.length} colour-bearing files in play3d — it went blind`)

// ── B. every colour-bearing file is classified ─────────────────────────────────────────────────
const classified = [...CONVERTED, ...PENDING, ...PALETTE].sort()
const unclassified = onDisk.filter(f => !classified.includes(f))
const ghosts = classified.filter(f => !onDisk.includes(f))
ok(unclassified.length === 0, `B: unclassified play3d file(s) — add to CONVERTED, PENDING or PALETTE: ${unclassified.join(', ')}`)
ok(ghosts.length === 0, `B: CONVERTED/PENDING/PALETTE names a file that is not on disk or has no colour: ${ghosts.join(', ')}`)

// ── the token value set, for the second-spelling ban ───────────────────────────────────────────
const tokenValues = new Set<string>()
const harvest = (v: unknown) => {
  if (typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v)) tokenValues.add(v.toLowerCase())
  else if (v && typeof v === 'object') Object.values(v).forEach(harvest)
}
harvest({ ...T })
ok(tokenValues.size >= 20, `C: harvested only ${tokenValues.size} token colours — the harvester is broken, not the tree`)

// ── A / C / D. the converted files ─────────────────────────────────────────────────────────────
const LADDER = new Set(Object.values(T.radius).map(String))

for (const f of CONVERTED) {
  const raw = readFileSync(join(DIR, f), 'utf8')
  const code = stripComments(raw)
  ok(code.length > 200, `E: ${f} stripped to ${code.length} chars — the stripper ate the file`)

  const hex = [...code.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map(m => m[0])
  ok(hex.length === 0, `A: ${f} holds ${hex.length} raw colour literal(s): ${[...new Set(hex)].join(', ')}`)

  const respelled = [...new Set(hex.map(h => h.toLowerCase()))].filter(h => tokenValues.has(h))
  ok(respelled.length === 0, `C: ${f} re-spells a token value instead of importing it: ${respelled.join(', ')}`)

  const radii = [...code.matchAll(/borderRadius:\s*'?([0-9]+%?|[0-9]+)'?/g)].map(m => m[1])
  const rogue = radii.filter(r => !LADDER.has(r))
  ok(rogue.length === 0, `D: ${f} uses off-ladder radius: ${[...new Set(rogue)].join(', ')} (ladder: ${[...LADDER].join(', ')})`)
}

// ── G. the palettes are palettes ───────────────────────────────────────────────────────────────
for (const f of PALETTE) {
  const code = stripComments(readFileSync(join(DIR, f), 'utf8'))
  ok(f.endsWith('.ts') && !f.endsWith('.tsx'), `G1: palette ${f} is not a .ts file — a palette cannot hold JSX`)
  ok(!/style=|StationShell|CSSProperties/.test(code), `G2: palette ${f} builds a style — it is drawing, so it is chrome`)
  const hex = [...new Set([...code.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map(m => m[0].toLowerCase()))]
  ok(hex.length > 0, `G: palette ${f} holds no colour at all — it is not a palette, remove it from the list`)
  const respelled = hex.filter(h => tokenValues.has(h))
  ok(respelled.length === 0, `G3: palette ${f} re-spells a token value instead of importing it: ${respelled.join(', ')}`)
}
// G3 has to be able to fire: a palette typing a token's value must be caught.
ok([`const x = '${T.mint.base}'`].some(src => [...src.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].some(m => tokenValues.has(m[0].toLowerCase()))),
  'G3: the respelling detector cannot see a token value typed as a literal')

// ── the shell takes a tone, not colours ────────────────────────────────────────────────────────
// The original defect, entering from the door it actually used: a caller handing the shell a colour.
for (const f of onDisk) {
  const code = stripComments(readFileSync(join(DIR, f), 'utf8'))
  const shellCalls = [...code.matchAll(/<StationShell[^>]*>/g)].map(m => m[0])
  for (const call of shellCalls) {
    ok(!/\b(accent|border|bg)=/.test(call),
      `A: ${f} passes a raw colour to StationShell — add a tone to tokens.ts instead: ${call.slice(0, 90)}`)
    ok(/\btone=/.test(call), `A: ${f} calls StationShell without a tone: ${call.slice(0, 90)}`)
  }
}

// ── report ────────────────────────────────────────────────────────────────────────────────────
console.log(`\ntokens guard — ${onDisk.length} colour-bearing files (${CONVERTED.length} converted, ${PENDING.length} pending, ${PALETTE.length} palettes)`)
if (fails.length) {
  console.log(`\n❌ ${pass} passed, ${fails.length} FAILED\n`)
  fails.forEach(f => console.log('  · ' + f))
  process.exit(1)
}
console.log(`✅ ${pass} asserts passed\n`)
