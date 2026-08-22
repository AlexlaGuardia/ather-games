// ★ EVERY CONSTANT THE MAP EDITOR REWRITES BY HAND MUST STILL EXIST WHERE IT LOOKS FOR IT.
// Run: npx tsx src/app/shimmer/save-map/targets.test.ts
//
// `save-map/route.ts` tunes the game by REWRITING SOURCE TEXT — it regex-matches a const or a block
// in a .ts file and substitutes a new value. That works right up until somebody moves the constant,
// and then it fails in the worst available shape: `String.replace` with a pattern that matches
// nothing returns the string UNCHANGED and throws nothing, so the editor saves, answers 200, and
// the value silently never moves. The user watches a successful save do nothing.
//
// ⚠ THIS IS NOT HYPOTHETICAL AND IT IS NOT ONE BUG. When this file was written:
//   · CYCLE_MS, DAWN_START and DUSK_START had just moved from engine/day-cycle.ts into the voxel
//     core (voxel/clock.ts) to satisfy the port-boundary rule. Three live rewrites went dead in one
//     commit, and every test in the repo stayed green, because no test reads this route.
//   · DAY_START, NIGHT_START and MIDNIGHT had ALREADY been dead for far longer — the phase names are
//     derived from the light curve now (`getPhase`), so those constants were retired and the editor
//     kept writing to them. Nobody noticed, because nothing looked.
//
// So the guard is not "did the split break it". It is: a hand-written rewrite is a standing claim
// about a file the claimer does not own, and a claim like that needs something that re-checks it.
import { readFileSync } from 'fs'
import { join } from 'path'

const SHIMMER = join(process.cwd(), 'src/app/shimmer')
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

/**
 * The rewrite targets, as (file, pattern) pairs mirroring route.ts.
 *
 * ⚠ `required: false` means "route.ts knows this one is gone and reports it instead of writing it".
 * A retired target is asserted ABSENT, not merely allowed to be — so if DAY_START is ever brought
 * back, this goes red and the editor's dead write becomes live code again on purpose rather than by
 * accident.
 */
const TARGETS: { file: string; re: RegExp; label: string; required?: boolean }[] = [
  { file: 'voxel/clock.ts', re: /const CYCLE_MS = .+/, label: 'CYCLE_MS' },
  { file: 'voxel/clock.ts', re: /const DAWN_START\s*=.+/, label: 'DAWN_START' },
  { file: 'voxel/clock.ts', re: /const DUSK_START\s*=.+/, label: 'DUSK_START' },
  { file: 'voxel/clock.ts', re: /const DAY_START\s*=.+/, label: 'DAY_START', required: false },
  { file: 'voxel/clock.ts', re: /const NIGHT_START\s*=.+/, label: 'NIGHT_START', required: false },
  { file: 'voxel/clock.ts', re: /const MIDNIGHT\s*=.+/, label: 'MIDNIGHT', required: false },
  { file: 'engine/day-cycle.ts', re: /export const RESPAWN_TRIGGERS = \{[\s\S]*?\} as const/, label: 'RESPAWN_TRIGGERS' },
  { file: 'voxel/crops.ts', re: /^export const CROP_DEFS: Record<string, CropDef> = \{[\s\S]*?\n\}/m, label: 'CROP_DEFS' },
]

/**
 * ★★ MATCHING IS NOT ENOUGH — IT HAS TO MATCH THE TABLE AND NOTHING ELSE.
 * A comment that spells out the declaration gives the reader a SECOND match, and the rewrite then
 * starts in the prose and eats everything between there and the real block. That is not a worry, it
 * happened: crops.ts's own header quoted `CROP_DEFS`'s declaration to explain that its shape was
 * load-bearing, canon-drift split on the comment and parsed zero crops, and the gate reported the
 * check as skipped rather than as broken. Documenting a marker created a marker.
 *
 * So the anchored patterns below are asserted to match EXACTLY ONCE per file. A guard that only asks
 * "did it match" survives this bug's own shape — which is the trap that ate a whole afternoon on
 * 08-22 and is written up in PATTERNS.md.
 */
const SINGLE: { file: string; re: RegExp; label: string }[] = [
  { file: 'voxel/crops.ts', re: /^export const CROP_DEFS: Record<string, CropDef> = \{/gm, label: 'CROP_DEFS' },
  { file: 'voxel/crops.ts', re: /^export const ELEMENT_HERBS/gm, label: 'ELEMENT_HERBS (canon-drift reads this)' },
  { file: 'voxel/crops.ts', re: /^export const CROP_IDS/gm, label: 'CROP_IDS (canon-drift stops here)' },
  { file: 'engine/day-cycle.ts', re: /^export const RESPAWN_TRIGGERS/gm, label: 'RESPAWN_TRIGGERS' },
]

for (const t of SINGLE) {
  const src = readFileSync(join(SHIMMER, t.file), 'utf-8')
  const n = [...src.matchAll(t.re)].length
  ok(n === 1, `★ ${t.label} must appear exactly once at line start in ${t.file} — found ${n}. `
    + (n > 1 ? 'A comment quoting the declaration is enough to do this, and it fools the reader before it fools you.'
             : 'The block a rewrite depends on is gone or renamed.'))
}

for (const t of TARGETS) {
  const src = readFileSync(join(SHIMMER, t.file), 'utf-8')
  const hit = t.re.test(src)
  if (t.required === false) {
    ok(!hit, `${t.label} is marked retired in route.ts but EXISTS in ${t.file} — the editor is refusing to write a live constant`)
  } else {
    ok(hit, `★ ${t.label} not found in ${t.file} — the map editor's rewrite is a silent no-op, and saving will report success while changing nothing`)
  }
}

// ── ★ THE ROUTE MUST NOT REACH FOR A PLAIN `.replace` ON THESE AGAIN ───────────────────────────
// The guard above catches a target that moved. This one catches the habit that made a moved target
// invisible: a bare `content.replace(/const X/...)` re-introduces the silent path even if every
// constant is exactly where this file says it is.
{
  const route = readFileSync(join(SHIMMER, 'save-map/route.ts'), 'utf-8')
  for (const t of TARGETS) {
    const bare = new RegExp(`(content|clock)\\s*=\\s*(content|clock)\\.replace\\([^)]*${t.label}`)
    ok(!bare.test(route), `route.ts rewrites ${t.label} with a bare .replace — use sub(), which reports a miss`)
  }
  ok(/function sub\(/.test(route), 'route.ts still has the reporting sub() helper')
  ok(/status: 500/.test(route) && /nothing was written/.test(route),
    '★ a required target that goes missing REFUSES the write rather than answering 200')
}

console.log(`\nsave-map rewrite targets: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
