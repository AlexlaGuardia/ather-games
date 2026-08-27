// The source-guard machinery's own oracle. Run: npx tsx src/app/shimmer/testing/guard.test.ts
//
// ★★★ AN INSTRUMENT NEEDS ITS OWN PROOF, and this one earns it: six suites read a consumer's source
// through machinery like this, and on 2026-08-27 hand-rolled versions of it produced FOUR separate
// red-against-green failures in a single day. A guard that fails toward "you found something" is
// the expensive direction — findings get acted on.
//
// ⚠ EVERY CASE BELOW IS ONE THE FOUR HAND-ROLLED STRIPPERS ACTUALLY GET WRONG. This is not a
// checklist of what a stripper might do; it is the list of things that already cost time.

import { strip, noComments, codeOnly, blockAt, justBefore } from './guard'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── 1. ★★ A TRAILING COMMENT IS A COMMENT ───────────────────────────────────────────────────────
// `purity` and `gen-pieces` anchor on `^\s*`, so only a comment that STARTS a line is removed. A
// trailing one survives — and that is exactly how a negative assert ("this block must not mention
// restingSpirits") goes red against code that documents what it used to do.
{
  const src = "const a = 1   // restingSpirits was here\n"
  ok(!codeOnly(src).includes('restingSpirits'), 'a TRAILING line comment is stripped')
  ok(codeOnly(src).includes('const a = 1'), 'and the code beside it survives')
}

// ── 2. ★★ A SLASH-SLASH INSIDE A STRING IS NOT A COMMENT ────────────────────────────────────────
// `palette` and `render-audit` strip slash-slash anywhere, so they eat the rest of any line holding
// a url — which corrupts the very literal a POSITIVE assert is hunting for.
{
  const src = "const u = 'https://ather.games/x'\nconst after = 2\n"
  ok(noComments(src).includes('https://ather.games/x'), '★ a url inside a string survives — it is not a comment')
  ok(noComments(src).includes('const after = 2'), 'and nothing after it is eaten')
  ok(codeOnly(src).includes('const after = 2'), 'same under codeOnly')
  ok(!codeOnly(src).includes('ather.games'), 'while codeOnly does blank the string CONTENTS, which is its job')
}

// ── 3. ★★★ THE TWO MODES ARE DIFFERENT QUESTIONS AND MUST NOT BE CONFLATED ──────────────────────
// "does this file MENTION the literal 'x'" and "does this file DO x" are not the same, and the
// audio-bus counter needed the second while a binding check needs the first.
{
  const src = "throw new Error('new AudioContext failed')\n"
  ok(noComments(src).includes('new AudioContext'), 'noComments keeps a token that lives inside a string')
  ok(!codeOnly(src).includes('AudioContext'), 'codeOnly does not — so a count cannot be inflated by an error message')
}

// ── 4. ★ THE QUOTES THEMSELVES SURVIVE BLANKING ─────────────────────────────────────────────────
// Deleting a string outright splices its neighbours together and invents a token that was never
// in the file — the cheapest way to manufacture a false positive.
{
  const out = codeOnly("f('a', 'b')")
  // ⚠ Asserted as a PROPERTY, not as an exact spelling. My first version expected '' or '  '
  // and got ' ' — blanking is one space per character, so the width follows the input. An assert
  // pinned to a spelling goes red the day the padding changes and says nothing about correctness.
  ok((out.match(/'/g) ?? []).length === 4, `both quote PAIRS remain (${out})`)
  ok(!out.includes('a') && !out.includes('b'), 'the CONTENTS are gone')
  // ⚠ And my second attempt was over-specified too: /'[^' ]/ cannot tell 'inside the string' from
  // 'after the closing quote', so it tripped on the comma. Fourth guard today written cleverer
  // than the question needed. Assert the two things that matter and stop.
  ok(!/f\(,/.test(out), 'and the arguments are not spliced into each other')
}

// ── 5. LAYOUT IS PRESERVED BY DEFAULT, SO OFFSETS AND LINE NUMBERS STILL MEAN SOMETHING ─────────
// `palette` deletes rather than blanks, which shifts every index after it — fine for a boolean
// test, wrong the moment a guard reports WHERE something is.
{
  const src = "a\n// gone\nb\n"
  ok(codeOnly(src).split('\n').length === src.split('\n').length, 'the line count is unchanged')
  ok(codeOnly(src).length === src.length, 'and so is the length, so an index still lands where it did')
}

// ── 6. ★★ A BLOCK COMMENT CONTAINING A GLOB IS THE BUG THAT BROKE TWO FILES TODAY ───────────────
// A doc path with a double-star, and a quoted regex ending in star-slash, each closed the comment
// they sat in. The stripper has to end a block at the FIRST closer, exactly as the compiler does —
// anything cleverer would disagree with the language.
{
  const src = "/* see .next/app/**/x.json */\nconst live = 1\n"
  const out = codeOnly(src)
  ok(out.includes('const live = 1'), 'code after the block survives')
  ok(out.includes('x.json'), '★ and the text AFTER the accidental closer is code, exactly as tsc reads it')
}

// ── 7. AN UNTERMINATED COMMENT DOES NOT EAT THE PROCESS ─────────────────────────────────────────
{
  ok(typeof codeOnly('/* never closed\nconst a = 1\n') === 'string', 'an unterminated block returns a string')
  ok(typeof codeOnly("const s = 'never closed\n") === 'string', 'so does an unterminated string')
}

// ── 8. ★★ blockAt SLICES BY ANCHOR, AND HANDS BACK BOTH FORMS ───────────────────────────────────
// A spanning regex matched NOTHING against correct code on 08-27 and took five asserts red with it.
{
  const src = [
    "if (space.current === 'plot') {",
    "  ring.tick(",
    "    // it used to read restingSpirits",
    "    party.current.map(s => s.id),",
    "  )",
    "}",
  ].join('\n')
  const b = blockAt(src, 'ring.tick(', '\n  )')
  ok(b.at > 0, 'the anchor is found')
  ok(b.raw.includes('restingSpirits'), 'raw keeps the prose — what the file SAYS')
  ok(!b.code.includes('restingSpirits'), '★★ code does not — so a negative assert cannot be defeated by a comment')
  ok(b.code.includes('party.current.map'), 'while the call itself survives in both')

  const missing = blockAt(src, 'nothing.like.this(', '\n)')
  ok(missing.at === -1 && missing.raw === '', 'a missing anchor reports -1 rather than silently returning the file')
}

// ── 9. justBefore WINDOWS, IT DOES NOT SEARCH ───────────────────────────────────────────────────
// A condition appears many times in a big file; a bare match is satisfied by being ANYWHERE. That
// shape got past a guard on 08-27 — it could discriminate, it just did not CONSTRAIN the line.
{
  const src = "if (x === 'plot') { }\n\n\n// far away\nif (y) {\n  ring.tick(\n  )\n}"
  const at = src.indexOf('ring.tick(')
  ok(!justBefore(src, at, 30).includes("x === 'plot'"), 'a match 60 chars away is outside a 30-char window')
  ok(justBefore(src, at, 30).includes('if (y) {'), 'while the statement actually guarding it is inside it')
  ok(justBefore(src, 0) === '', 'and an anchor at the start has nothing before it')
}

console.log(`guard: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
