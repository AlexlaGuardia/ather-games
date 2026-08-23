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
const CONVERTED = ['ui.tsx']

/**
 * Still holding raw literals. NOT an exemption — a worklist with a red light on it (assert B).
 * Delete a name from here the moment its file is clean.
 */
const PENDING = [
  'collar-raid.ts', 'GfxPanel.tsx', 'HotBar.tsx', 'MoveBook.tsx', 'multiplayer.ts',
  'npcs3d.ts', 'page.tsx', 'PartyPanel.tsx', 'PassageRack.tsx', 'RemotePlayers.tsx',
  'Shimmer3D.tsx', 'StationMenus.tsx', 'WorldMap.tsx',
]

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
const onDisk = readdirSync(DIR)
  .filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')))
  .filter(f => !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'))
  .filter(f => f !== 'tokens.ts')
  .filter(f => {
    // data/logic modules carry no colour; only files that render are in scope.
    const s = readFileSync(join(DIR, f), 'utf8')
    return /#[0-9a-fA-F]{3,8}|StationShell|style=\{\{/.test(s)
  })
  .sort()

// ── E. the sweep read something ────────────────────────────────────────────────────────────────
// A scan that silently matched nothing returns "no drift found", which is the same shape as "I
// could not look". Those must not share an exit code.
ok(onDisk.length >= 10, `E: sweep found only ${onDisk.length} colour-bearing files in play3d — it went blind`)

// ── B. every colour-bearing file is classified ─────────────────────────────────────────────────
const classified = [...CONVERTED, ...PENDING].sort()
const unclassified = onDisk.filter(f => !classified.includes(f))
const ghosts = classified.filter(f => !onDisk.includes(f))
ok(unclassified.length === 0, `B: unclassified play3d file(s) — add to CONVERTED or PENDING: ${unclassified.join(', ')}`)
ok(ghosts.length === 0, `B: CONVERTED/PENDING names a file that is not on disk or has no colour: ${ghosts.join(', ')}`)

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
console.log(`\ntokens guard — ${onDisk.length} colour-bearing files (${CONVERTED.length} converted, ${PENDING.length} pending)`)
if (fails.length) {
  console.log(`\n❌ ${pass} passed, ${fails.length} FAILED\n`)
  fails.forEach(f => console.log('  · ' + f))
  process.exit(1)
}
console.log(`✅ ${pass} asserts passed\n`)
