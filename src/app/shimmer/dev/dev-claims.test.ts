/**
 * A DEV PAGE'S PROSE IS A CLAIM ABOUT A SYSTEM IT DOES NOT OWN, AND MAKING THE PAGE REACHABLE
 * RAISED WHAT THAT CLAIM COSTS.
 *
 * ★★★ WHY THIS EXISTS (2026-09-01, hub lane). `dev/moves` told the reader, in its own panel:
 * *"meltbore is still UNBUILT in the game: both halves exist, but no host holds a key down for a
 * cast."* It was accurate the day it was written and false within hours — the host wired the held
 * key that same evening. What makes that expensive rather than merely untidy is the DIRECTION it
 * fails in: **a confident note saying a thing is not in the game does not misinform, it CANCELS
 * THE LOOK.** Alex was working through a list of shipped-but-never-seen features, meltbore was on
 * it, and the bench built to show him meltbore told him not to bother.
 *
 * ⚠⚠ AND THE INDEX SHIPPED TODAY IS WHAT TURNED THIS FROM A PRIVATE NOTE INTO A BILL. Twenty-two
 * standalone dev pages just became reachable for the first time; fourteen were written between
 * 2026-08-23 and 08-31, the same fortnight the systems they describe were moving fastest. Every
 * one carries prose about somebody else's subsystem, frozen at the moment it was authored.
 * Reachability does not make those comments wrong — it makes them READ.
 *
 * ── THE RULE ─────────────────────────────────────────────────────────────────────────────────
 * A dev page may not assert that a host capability is MISSING while the host demonstrably has it.
 * Each row below pairs a retired phrase with the host symbol whose presence falsifies it. This is
 * the shape `play3d/unbuilt-premise.test.ts` proved: a reason that expires OUT LOUD, so nobody has
 * to remember the claim was provisional. Prose cannot be checked; a premise can.
 *
 * ⚠ EACH ROW ASSERTS ITS PREMISE IN BOTH DIRECTIONS. Checking only "the page lacks the phrase"
 * would pass just as happily if the host symbol vanished — the guard would go quiet at exactly the
 * moment the old claim became true again and wanted re-stating. So the host symbol must BE THERE,
 * and it is matched through `codeOnly` because the host discusses `boreStep` in prose two lines
 * from where it calls it. PATTERNS 2026-08-22: documenting a marker creates a marker.
 *
 * Run: `npx tsx src/app/shimmer/dev/dev-claims.test.ts` (repo convention — there is no vitest).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { codeOnly } from '../testing/guard'

let pass = 0
const fails: string[] = []
function ok(cond: boolean, label: string) {
  if (cond) pass++
  else fails.push(label)
}

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

interface RetiredClaim {
  /** The dev page making the claim. */
  page: string
  /** What the page used to say. Matched against the page's raw text — this is about PROSE. */
  retired: RegExp
  /** Human-readable statement of what the page was asserting. */
  claim: string
  /** The host file that falsifies it. */
  host: string
  /** The call whose presence in HOST CODE (not its comments) proves the capability exists. */
  proof: string
}

const RETIRED: RetiredClaim[] = [
  {
    page: 'src/app/shimmer/dev/moves/page.tsx',
    retired: /no host holds a key down|meltbore is still UNBUILT/i,
    claim: 'meltbore is unbuilt because no host polls a held key',
    host: 'src/app/shimmer/voxel3d/VoxelWorld.tsx',
    proof: 'boreStep(',
  },
  {
    page: 'src/app/shimmer/dev/moves/page.tsx',
    retired: /no host holds a key down/i,
    claim: 'no host sustains a channel across frames',
    host: 'src/app/shimmer/voxel3d/VoxelWorld.tsx',
    proof: 'sustainStep(',
  },
]

// ⚠ An empty table makes every loop below vacuous, which is the assert-that-cannot-fire trap.
ok(RETIRED.length > 0, 'BLIND: no retired claims registered, so this guard checks nothing')

for (const r of RETIRED) {
  const hostCode = codeOnly(read(r.host))
  const hasProof = hostCode.includes(r.proof)

  // Direction 1 — the premise still holds. If this goes red the capability was REMOVED, and the
  // page's old wording may have become true again; re-read it rather than deleting this row.
  ok(hasProof, `PREMISE GONE: ${r.host} no longer calls ${r.proof} — the claim "${r.claim}" may be true again, re-read ${r.page}`)

  // Direction 2 — given the premise, the page must not still be saying the retired thing.
  if (hasProof) {
    const pageText = read(r.page)
    ok(!r.retired.test(pageText), `STALE CLAIM: ${r.page} still says "${r.claim}", but ${r.host} calls ${r.proof}. A page that says a shipped thing is missing cancels the look.`)
  }
}

// ── AND THE POSITIVE CONTROL, because a guard that cannot match anything reports a clean bill ───
// If `codeOnly` or the reader ever stops working, every `hasProof` goes false, every direction-2
// check is skipped, and the direction-1 failures would at least be loud. This asserts the reader
// works at all against a string the host certainly contains.
{
  const hostCode = codeOnly(read('src/app/shimmer/voxel3d/VoxelWorld.tsx'))
  ok(hostCode.length > 1000, 'BLIND: codeOnly returned almost nothing for VoxelWorld.tsx — the reader is broken, not the host')
  ok(!hostCode.includes('zzz-never-present-token'), 'CONTROL: codeOnly matched a token that cannot exist, so matching proves nothing')
}

console.log(`dev-claims: ${pass} pass, ${fails.length} fail  (${RETIRED.length} retired claims watched)`)
if (fails.length) {
  for (const f of fails) console.error(`  ✗ ${f}`)
  process.exit(1)
}
