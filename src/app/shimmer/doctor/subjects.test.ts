/**
 * EVERY DOCTOR CHECK MUST STILL BE ABLE TO SEE ITS SUBJECT.
 *
 * ★★★ WHY THIS EXISTS (2026-09-02, hub lane). Deleting `BeastEditor.tsx` left TWO doctor checks
 * reading a file that no longer exists, and neither of them would have said so. `read()` catches
 * ENOENT and returns null; every check opens with `if (!route || !editor) return`. So a check whose
 * subject has been deleted returns **silently, in the pass direction**, and the doctor stays green
 * while quietly having fewer checks than it claims.
 *
 * ⚠⚠ THAT IS THE FAILURE THIS TREE KEEPS RE-LEARNING, and PATTERNS states it outright: *"I found no
 * drift" and "I could not look" must not share an exit code.* The early return is correct as
 * ERROR HANDLING and catastrophic as a CONTRACT — it is the difference between a guard that is
 * quiet because the code is clean and a guard that is quiet because it is blind. One of the two
 * checks was found by hand while cleaning up; the other was found only because the first prompted a
 * grep. Nothing would have surfaced either one.
 *
 * ⚠ AND THE CHEAPEST WRONG ANSWER THAT STILL SATISFIES THIS FILE is a `read()` call the regex cannot
 * see — a computed path, a variable. That is why the count of parsed subjects is asserted to be
 * plural and to include a file known to exist: if the parse breaks, this guard fails rather than
 * reporting an empty set as clean. Same shape as every other reader in this tree.
 *
 * Run: `npx tsx src/app/shimmer/doctor/subjects.test.ts`
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

let pass = 0
const fails: string[] = []
function ok(cond: boolean, label: string) {
  if (cond) pass++
  else fails.push(label)
}

const SHIMMER = join(process.cwd(), 'src/app/shimmer')
const CHECKS = join(SHIMMER, 'doctor/checks.ts')

ok(existsSync(CHECKS), `BLIND: ${CHECKS} is missing — this guard has no subject of its own`)
const src = existsSync(CHECKS) ? readFileSync(CHECKS, 'utf8') : ''

/** Every literal path the doctor hands to `read()`. */
const subjects = [...new Set([...src.matchAll(/\bread\(\s*'([^']+)'\s*\)/g)].map(m => m[1]))].sort()

// ── BLIND CHECKS ──────────────────────────────────────────────────────────────────────────────
ok(subjects.length > 1, `BLIND: parsed ${subjects.length} read() subjects out of checks.ts — the regex has drifted and an empty set would read as "all fine"`)
ok(subjects.includes('save-sprite/route.ts'), 'CONTROL FAILED: save-sprite/route.ts is not among the parsed subjects, but the doctor reads it — the parse is wrong')

// ── THE RULE ──────────────────────────────────────────────────────────────────────────────────
for (const rel of subjects) {
  ok(
    existsSync(join(SHIMMER, rel)),
    `DOCTOR IS BLIND: checks.ts reads '${rel}', which does not exist. read() returns null and the check returns EARLY — so it reports nothing wrong rather than reporting that it cannot look. Delete the check with its subject, or point it at the file that replaced it.`,
  )
}

// ── AND EVERY REGISTERED CHECK MUST STILL BE DEFINED ──────────────────────────────────────────
// Removing a check function while leaving its row (or the reverse) is a compile error today, but the
// row list is also what the panel counts — so assert the two agree rather than trusting the count.
// ⚠ THE CHARACTER CLASS HERE WAS `[a-z-]+` AND IT MISSED A ROW ON THE FIRST RUN.
// `sprite-file:furniture` contains a colon, so the guard silently covered 7 of 8 registered checks
// and reported clean — this file's own failure mode, in this file, within a minute of writing it.
// Caught only by counting the rows a second way and refusing to accept the disagreement. The count
// is therefore cross-checked below against a deliberately dumber pattern; if the two ever disagree
// the guard fails rather than quietly covering a subset.
const registered = [...src.matchAll(/\[\s*'([^']+)'\s*,\s*\(\)\s*=>\s*(\w+)\(/g)]
const rowCount = [...src.matchAll(/\[\s*'[^']+'\s*,\s*\(\)\s*=>/g)].length
ok(registered.length === rowCount, `PARSE SHORT: matched ${registered.length} registered checks but there are ${rowCount} rows — the registration regex is covering a subset, which is this guard's own failure mode`)
ok(registered.length > 1, `BLIND: parsed ${registered.length} registered checks — the registration regex has drifted`)
for (const [, id, fn] of registered) {
  ok(new RegExp(`async function ${fn}\\b`).test(src), `CHECK REGISTERED BUT UNDEFINED: '${id}' points at ${fn}(), which checks.ts does not define`)
}

console.log(`doctor-subjects: ${pass} pass, ${fails.length} fail`)
console.log(`  ${subjects.length} files read by ${registered.length} registered checks, all present`)
if (fails.length) {
  for (const f of fails) console.error(`  ✗ ${f}`)
  process.exit(1)
}
