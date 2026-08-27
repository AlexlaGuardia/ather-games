// READING A ZONE GRID OUT OF `tilemap.ts` AS TEXT — the editor's source-of-truth loader.
//
// ★ WHY TEXT AND NOT AN IMPORT. The editor must show what is on DISK, not what was compiled into
// the client bundle at the last deploy. Those differ for exactly as long as it takes someone to
// save a map and wait for a build — which is the normal workflow here (save to branch, ping to
// build) — and an editor that loads the baked copy resurrects every edit made since. The region
// branch of `save-map` refuses that by name. This is the zone branch's version of the same rule.
//
// ── ★★★ IT LIVED IN THE ROUTE AND WAS WRONG TWICE, IN THE DIRECTION NOBODY LOOKS ─────────────
// Both bugs produced a well-formed answer rather than an error, which is why neither was noticed:
//   1. It anchored on the first `[` after the const NAME. Every zone is declared
//      `export const NAME: number[][] = [`, so that bracket is the one inside `number[][]`, and the
//      matcher opened and closed on the same pair. Result: `[]` — a valid, parseable, EMPTY grid,
//      for all 23 zone maps, always. The editor's `if (data.grid?.length)` read that as "nothing
//      here" and fell back to the bundle, so the loader had never once done its job.
//   2. Fixing that revealed the row split dropped row 0. `/\[([^\]]+)\]/g` lets `[` through, so its
//      first match begins at the OUTER bracket and ends at the first `]` — it is row 0 wearing the
//      outer bracket — and a `.slice(1)` meant to skip the outer bracket threw the top row away and
//      shifted the map up one. ⚠ **The half-fix was worse than the original**: an empty grid is
//      ignored, a 99-row grid is loaded and saved back.
// ★ A map is a wall of digits. Neither wrong answer looked wrong, and the only thing that settled
// it was comparing against the module's own export — two derivations of one fact, not one opinion.

/**
 * Pull a `number[][]` zone grid out of `tilemap.ts` source text.
 *
 * Returns null when the const is absent or is not a literal array (a `createStubMap(...)` call has
 * nothing to read). ⚠ Null means *could not read*; it must never be flattened into an empty grid by
 * a caller, because those are different claims and the first bug above is what happens when they
 * share a value.
 */
export function parseZoneGrid(source: string, constName: string): number[][] | null {
  const declStart = source.indexOf(`export const ${constName}`)
  if (declStart === -1) return null

  // ★ ANCHOR ON THE ASSIGNMENT, NOT THE NAME. A `const` declaration cannot carry an `=` before its
  // own, so the first `=` after the name is always the right anchor — and it skips the type
  // annotation's brackets, which is what bug 1 tripped over.
  const eq = source.indexOf('=', declStart)
  if (eq === -1) return null
  const bracketStart = source.indexOf('[', eq)
  if (bracketStart === -1) return null
  if (source.substring(declStart, bracketStart).includes('createStubMap')) return null

  let depth = 0, pos = bracketStart
  while (pos < source.length) {
    if (source[pos] === '[') depth++
    else if (source[pos] === ']') { depth--; if (depth === 0) break }
    pos++
  }
  if (depth !== 0) return null  // unterminated — a truncated read is not a grid

  // ★ INNERMOST BRACKETS ONLY. `[^\[\]]*` cannot cross a `[`, so the outer array can never match
  // and there is no outer match to skip — which is what made the old `.slice(1)` eat row 0.
  const rows = source.substring(bracketStart, pos + 1).match(/\[[^[\]]*\]/g)
  if (!rows || rows.length === 0) return null
  return rows.map(row =>
    row.replace(/[[\]]/g, '').split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n)),
  )
}

/** `rune-hold` -> `RUNE_HOLD`. The editor speaks zone ids, `tilemap.ts` speaks const names. */
export const zoneConstName = (id: string): string => id.replace(/-/g, '_').toUpperCase()
