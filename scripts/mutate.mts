/**
 * MUTATE — apply one deliberate bug, run a check, always put the file back.
 *
 * Usage:
 *   npx tsx scripts/mutate.mts <file> <find> <replace> -- <command...>
 *
 * ★★★ WHY THIS IS A TOOL AND NOT A SHELL ONE-LINER. A guard you have not watched fail is a guard
 * you have not tested, so every new oracle in this tree gets swept with the bug it exists to catch.
 * That sweep has failed THREE ways in this repo, and each one reports the OPPOSITE of the truth:
 *
 *   1. **The mutation does not apply and the suite prints green** — which reads as *the guard
 *      survived a real bug*. Hit 2026-08-27: an anchor that had become non-unique (two call sites
 *      grew the same expression), so the replace was a silent no-op and the "sweep" measured
 *      nothing. `String.replace` with no match returns the string UNCHANGED and throws nothing.
 *   2. **A restore that misses a file**, leaving a mutation standing in the tree for later runs.
 *      Hit the same day: a backup list of four against a sweep that touched five, and the stranded
 *      edit sat there through two more runs and a typecheck.
 *   3. **A restore from git on a dirty file**, which reverts uncommitted work instead of the
 *      mutation (PATTERNS, 08-22). The baseline is the WORKING TREE, never HEAD.
 *
 * ⚠ SO THIS REFUSES TO RUN A CHECK IT COULD NOT SET UP. If the find text is absent, or present more
 * than once, or the replacement leaves the file byte-identical, it exits non-zero and says so
 * BEFORE running anything. A sweep that cannot apply its bug must look like a failure, not a pass.
 *
 * ⚠ AND THE RESTORE IS ON EVERY EXIT PATH — normal, thrown, or signalled. The backup is taken from
 * the file as it is on disk right now.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const argv = process.argv.slice(2)
const sep = argv.indexOf('--')
if (sep < 0 || sep < 3) {
  console.error('usage: mutate.mts <file> <find> <replace> -- <command...>')
  process.exit(2)
}
const [file, find, replace] = argv.slice(0, 3)
const cmd = argv.slice(sep + 1)

const before = readFileSync(file, 'utf8')

// ── the three refusals, all BEFORE anything runs ──
const hits = before.split(find).length - 1
if (hits === 0) {
  console.error(`MUTATION NOT APPLIED: "${find.slice(0, 60)}" appears 0 times in ${file}`)
  console.error('  A no-op replace would have printed a PASS. Refusing.')
  process.exit(3)
}
if (hits > 1) {
  console.error(`MUTATION AMBIGUOUS: "${find.slice(0, 60)}" appears ${hits} times in ${file}`)
  console.error('  Replacing all of them measures something other than the guard under test. Refusing.')
  console.error('  (This is the 08-27 case: two call sites grew the same expression.)')
  process.exit(3)
}
const after = before.split(find).join(replace)
if (after === before) {
  console.error('MUTATION IS A NO-OP: find and replace produce an identical file. Refusing.')
  process.exit(3)
}

let restored = false
const restore = () => {
  if (restored) return
  restored = true
  writeFileSync(file, before)          // ⚠ the WORKING TREE, never `git checkout`
}
process.on('exit', restore)
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.on(sig, () => { restore(); process.exit(130) })
}

writeFileSync(file, after)
console.log(`mutated ${file} (1 site, verified changed) — running: ${cmd.join(' ')}`)

const { spawnSync } = await import('node:child_process')
const r = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit' })
restore()

// ⚠ THE EXIT CODE IS INVERTED ON PURPOSE. A mutation sweep PASSES when the check FAILS: the guard
// noticed the bug. A check that stays green under a real defect is the finding.
if (r.status === 0) {
  console.error('⚠ THE GUARD DID NOT NOTICE — the check passed with the bug in place.')
  process.exit(1)
}
console.log(`✓ caught (check exited ${r.status}) — file restored`)
