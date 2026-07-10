// Input guards for the dev save routes.
//
// The save-* routes mutate tracked TypeScript source by interpolating request
// payload into template literals. They are owner-gated, so the threat is a
// malformed editor payload writing broken TS into the repo, not RCE. A quote in
// an id is enough to corrupt a source file the build then can't parse.
//
// `save-dialogue` and `save-structure` already guarded with a bare SAFE_ID regex;
// this is that guard, generalized so the other three routes share one definition.

/** Identifiers that are safe to splice into source as-is: `'${id}'`, `const ${ID}_SPRITES`, `${id}.ts`. */
export const SAFE_ID = /^[a-zA-Z0-9_-]+$/

/** A filename that stays inside its directory: no separators, no dots beyond the extension. */
export const SAFE_TS_FILE = /^[a-zA-Z0-9_-]+\.ts$/

/** Thrown by the assert helpers; routes map it to a 400. */
export class BadRequest extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BadRequest'
  }
}

export function isSafeId(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= 64 && SAFE_ID.test(v)
}

/** Assert an identifier destined for interpolation into source. */
export function safeId(v: unknown, field: string): string {
  if (!isSafeId(v)) throw new BadRequest(`Invalid ${field}: expected [a-zA-Z0-9_-]{1,64}, got ${JSON.stringify(v)}`)
  return v
}

/** Same, but allows undefined/null/'' → returns undefined. For optional fields. */
export function safeIdOpt(v: unknown, field: string): string | undefined {
  if (v === undefined || v === null || v === '') return undefined
  return safeId(v, field)
}

/** Assert a value is one of a fixed set. Use where the target type is a union. */
export function safeEnum<T extends string>(v: unknown, allowed: readonly T[], field: string): T {
  if (typeof v !== 'string' || !allowed.includes(v as T))
    throw new BadRequest(`Invalid ${field}: expected one of ${allowed.join('|')}, got ${JSON.stringify(v)}`)
  return v as T
}

/** Assert a filename that will be joined onto a fixed directory. Blocks traversal. */
export function safeTsFile(v: unknown, field: string): string {
  if (typeof v !== 'string' || !SAFE_TS_FILE.test(v))
    throw new BadRequest(`Invalid ${field}: expected <name>.ts, got ${JSON.stringify(v)}`)
  return v
}

/** Coerce to a finite integer, rejecting NaN/Infinity/strings. Bounds are inclusive. */
export function safeInt(v: unknown, field: string, min = -1_000_000, max = 1_000_000): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max)
    throw new BadRequest(`Invalid ${field}: expected integer in [${min}, ${max}], got ${JSON.stringify(v)}`)
  return v
}

/** Coerce to a finite number (allows decimals, e.g. drop chances). */
export function safeNum(v: unknown, field: string, min = -1_000_000, max = 1_000_000): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max)
    throw new BadRequest(`Invalid ${field}: expected finite number in [${min}, ${max}], got ${JSON.stringify(v)}`)
  return v
}

/**
 * Assert a free-text string and return it unchanged. For targets that do their
 * own escaping — notably `JSON.stringify`, which emits a complete double-quoted
 * literal. Escaping first would double-escape.
 */
export function safeText(v: unknown, field: string, maxLen = 2000): string {
  if (typeof v !== 'string') throw new BadRequest(`Invalid ${field}: expected string, got ${JSON.stringify(v)}`)
  if (v.length > maxLen) throw new BadRequest(`Invalid ${field}: exceeds ${maxLen} characters`)
  return v
}

/**
 * Escape a free-text string for a single-quoted TS literal. Use for names and
 * descriptions, which legitimately hold spaces and punctuation and so can't be
 * SAFE_ID. Returns the body only — the caller supplies the quotes.
 *
 * Newlines are escaped rather than rejected: a `\n` inside a single-quoted
 * literal is a syntax error, and silently dropping it would lose author intent.
 */
export function escText(v: unknown, field: string, maxLen = 2000): string {
  return safeText(v, field, maxLen)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    // A lone `${` inside a template literal would open an interpolation. None of
    // our targets are template literals today, but sprite templates are, and the
    // cost of being wrong is a corrupted source file.
    .replace(/\$\{/g, '\\${')
}

/** A CSS hex colour, the only form the sprite palettes use. Interpolated as `'${c}'`. */
export const SAFE_COLOR = /^#[0-9a-fA-F]{3,8}$/

/** Assert every entry of a palette is a hex colour. */
export function safeColors(v: unknown, field: string): string[] {
  if (!Array.isArray(v) || v.length === 0) throw new BadRequest(`Invalid ${field}: expected non-empty array`)
  return v.map((c, i) => {
    if (typeof c !== 'string' || !SAFE_COLOR.test(c))
      throw new BadRequest(`Invalid ${field}[${i}]: expected hex colour, got ${JSON.stringify(c)}`)
    return c
  })
}

/**
 * Own-property lookup on a plain string-keyed record. A bare `MAP[key]` answers
 * truthily for `constructor`, `toString`, and friends, which then flow onward as
 * a function where a filename was expected.
 */
export function lookup<T>(map: Record<string, T>, key: unknown): T | undefined {
  if (typeof key !== 'string' || !Object.hasOwn(map, key)) return undefined
  return map[key]
}

/** Largest value in a numeric grid, without spreading it as call arguments. */
export function gridMax(grid: number[][], field: string): number {
  let max = 0
  for (const row of grid) {
    if (!Array.isArray(row)) throw new BadRequest(`Invalid ${field}: row is not an array`)
    for (const cell of row) {
      if (typeof cell !== 'number' || !Number.isInteger(cell) || cell < 0)
        throw new BadRequest(`Invalid ${field}: cell ${JSON.stringify(cell)} is not a non-negative integer`)
      if (cell > max) max = cell
    }
  }
  return max
}
