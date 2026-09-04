/**
 * SOURCE-GUARD MACHINERY — for the tests that read their consumer's source.
 *
 * ★★★ WHY THIS FILE EXISTS. Six suites in this tree read a consumer's source to prove the game
 * actually CALLS what a module implements — the class of check that catches "built, tested, green,
 * unreachable", which happened three times in one day on 2026-08-27 (98 build pieces, the collar
 * prompt, ring 2). It is the right pattern. But every one of those suites hand-rolled its own
 * comment stripper, and by the time anyone counted, **four of them disagreed**:
 *
 *   purity / gen-pieces   line-anchored, slash-slash      -> only a comment that STARTS a line;
 *                                                            a trailing one survives
 *   render-audit          slash-slash anywhere, BLANKED   -> keeps line numbers, the good idea
 *   palette               slash-slash anywhere, DELETED   -> shifts every offset after it
 *   audio-bus             the above + string literals     -> the only one that stripped strings
 *
 * ⚠⚠ THOSE PATTERNS ARE DESCRIBED IN WORDS RATHER THAN QUOTED, AND THAT IS NOT PRUDERY. Writing
 * one out puts a star-slash in this comment, and star-slash CLOSES IT -- the rest of the prose
 * becomes code and the file does not compile. That happened twice on 08-27: once in a doc path
 * with a double-star glob, and once HERE, in the file whose whole subject is that a pattern
 * cannot see the context it sits in.
 *
 * ⚠⚠ AND THEY FAIL IN OPPOSITE DIRECTIONS, WHICH IS WHY ONE SHARED VERSION IS WORTH THE FILE.
 * The line-start-only ones leave prose behind, so a NEGATIVE assert (`the file must not mention X`)
 * goes red against correct code the moment someone documents the thing they removed — that cost
 * three separate red-against-green failures on 08-27 alone. The anywhere-regex ones eat the `//`
 * inside `'https://…'`, which corrupts the very string a POSITIVE assert is looking for.
 *
 * ★ NEITHER IS FIXABLE WITH A REGEX, because "is this `//` inside a string?" needs state. So this
 * is a small scanner rather than a clever pattern. `guard.test.ts` runs it against exactly the
 * inputs the four hand-rolled ones get wrong.
 *
 * ⚠ NOT A `.test.ts` ON PURPOSE. It is imported BY tests, so a name ending in `.test.ts` would make
 * every runner try to execute it. It is also never imported by app code, so it never enters a
 * bundle — `audio-bus.test.ts`'s tree scan sees it and finds nothing, which is correct.
 */

/** What a scan is allowed to see. */
export interface StripOptions {
  /** Replace removed text with spaces instead of deleting it, so line/column numbers survive. */
  keepLayout?: boolean
  /** Also blank string literals. Wanted for "does this file DO X"; wrong for "does it MENTION 'x'". */
  strings?: boolean
}

/**
 * Blank out comments — and optionally string literals — without a regex.
 *
 * ★ ONE PASS, TRACKING STATE, because every failure this replaces came from a stateless pattern
 * guessing at context: a `//` inside a URL, a `*​/` inside a doc path, a token quoted in prose.
 */
export function strip(src: string, opts: StripOptions = {}): string {
  const { keepLayout = true, strings = false } = opts
  const out: string[] = []
  const blank = (ch: string) => out.push(keepLayout ? (ch === '\n' ? '\n' : ' ') : (ch === '\n' ? '\n' : ''))

  let i = 0
  while (i < src.length) {
    const c = src[i], d = src[i + 1]

    // ── block comment ──
    if (c === '/' && d === '*') {
      const end = src.indexOf('*/', i + 2)
      const stop = end === -1 ? src.length : end + 2
      for (; i < stop; i++) blank(src[i])
      continue
    }
    // ── line comment ──
    if (c === '/' && d === '/') {
      while (i < src.length && src[i] !== '\n') { blank(src[i]); i++ }
      continue
    }
    // ── string / template literal ──
    if (c === '"' || c === "'" || c === '`') {
      const quote = c
      // ⚠ THE QUOTE CHARACTERS THEMSELVES ARE ALWAYS KEPT, even when blanking the contents. A
      // scan for `'` counts, and more importantly a blanked-to-nothing string would splice two
      // identifiers together and invent a token that was never in the file.
      out.push(c); i++
      while (i < src.length) {
        if (src[i] === '\\') {                 // an escape covers the next char, quote included
          if (strings) { blank(src[i]); blank(src[i + 1] ?? '') } else { out.push(src[i], src[i + 1] ?? '') }
          i += 2
          continue
        }
        if (src[i] === quote) { out.push(src[i]); i++; break }
        // A non-template string cannot span a newline; bail rather than swallow the rest of the file.
        if (src[i] === '\n' && quote !== '`') break
        if (strings) blank(src[i]); else out.push(src[i])
        i++
      }
      continue
    }
    out.push(c); i++
  }
  return out.join('')
}

/** Comments gone, string literals intact. For *"does this file mention the literal `x`"*. */
export const noComments = (src: string): string => strip(src)

/** Comments AND string contents gone. For *"does this file DO x"* — the counting questions. */
export const codeOnly = (src: string): string => strip(src, { strings: true })

/**
 * One statement or call, sliced out by its anchor.
 *
 * ★★ INDEX SLICING, NOT A SPANNING REGEX, AND THE DIFFERENCE IS NOT STYLE. A pattern that has to
 * cross a multi-line call is a parser in disguise: on 2026-08-27 one such pattern matched NOTHING
 * against perfectly correct code and took five asserts red with it — the worst direction for a
 * guard to fail in, because red gets acted on.
 *
 * ⚠ AND IT RETURNS BOTH FORMS ON PURPOSE. `raw` is what the file says; `code` is what it does.
 * Negative asserts (*"this block must not mention X"*) MUST use `code`, or a comment explaining
 * what the block used to do will fail the guard — which happened three times on one day.
 */
export function blockAt(src: string, anchor: string, closer: string): { at: number; raw: string; code: string } {
  const at = src.indexOf(anchor)
  if (at < 0) return { at: -1, raw: '', code: '' }
  const end = src.indexOf(closer, at)
  const raw = src.slice(at, end < 0 ? src.length : end + closer.length)
  return { at, raw, code: codeOnly(raw) }
}

/**
 * The text immediately before an anchor — where a guarding `if` has to live.
 *
 * ⚠ Windowed rather than searched, because a condition like `space.current === 'plot'` appears
 * many times in a big file and a bare match is satisfied by being ANYWHERE. That is the shape that
 * got past a guard on 08-27: an assert that could discriminate but did not CONSTRAIN the line it
 * was about.
 */
export const justBefore = (src: string, at: number, chars = 200): string =>
  at <= 0 ? '' : src.slice(Math.max(0, at - chars), at)

/**
 * ★ DECLARATION ANCHORS THAT TOLERATE AN `export ` PREFIX (2026-09-04, play lane's find, hub's copy).
 * `src.indexOf('\nfunction GearTab(')` is a standing claim one character wide: the moment that
 * declaration is exported it returns -1, and `slice(at, -1)` is not empty, it is the WHOLE REST OF
 * THE FILE (measured: 7,432 -> 464,645 chars), at which point every positive assert on the slice is
 * satisfiable by any match anywhere in the host. Anchored at line start on purpose: pass a
 * comment-stripped `src` and nothing in prose can match. Keep the "has BOTH anchors" assert beside
 * every use — that is what makes a MISSING anchor loud instead of blind.
 */
export const declAt = (src: string, name: string): number => {
  const m = new RegExp(`^(?:export )?function ${name}\\(`, 'm').exec(src)
  return m ? m.index : -1
}
/** The same, searched from an offset; returns the index of the leading newline, as `indexOf('\nfunction …')` did. */
export const declAfter = (src: string, name: string, from: number): number => {
  if (from < 0) return -1
  const m = new RegExp(`\\n(?:export )?function ${name}\\(`).exec(src.slice(from))
  return m ? from + m.index : -1
}
