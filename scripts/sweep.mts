// ── Run every oracle, and say WHICH KIND of not-passing each one is ────────────────────────────
// Run: npx tsx scripts/sweep.mts [pathFilter]     e.g. npx tsx scripts/sweep.mts voxel3d
//
// ── ★★★ WHY THIS EXISTS: THE SAME SUITE WAS RED AND GREEN ON ONE AFTERNOON ─────────────────────
// Two windows swept this tree on 2026-08-22 and failed in opposite directions. One judged files by
// exit code under `timeout 120` and reported a KILLED file as FAILED — the file's real runtime was
// 106s, and it is 74/74 green given room. The other had no timeout at all, where a single hanging
// file hangs the whole sweep with no output.
//
// ⚠ A MISSING ANSWER COLLAPSES INTO killed, failed, OR still-running, AND WHICH ONE IS A DESIGN
// DECISION, NOT AN OVERSIGHT. This reports the three separately and never lets one stand in for
// another. `timeout` exits 124 on the kill, which is the only reason the distinction is available
// at all — a runner that only asks "was the exit code zero" has thrown it away.
//
// ── ★★ THE CEILING IS SIZED FOR A LOADED BOX, NOT AN IDLE ONE ─────────────────────────────────
// `voxel/plot.test.ts` has been measured at 106s idle, 134s under a full sweep with three windows
// live, and 121s against a 120s default — where the kill was reported by an `&&` chain as the
// COMMIT not happening. On a shared box a timeout measures two things at once and reports only
// one of them, so the elapsed time is printed beside every verdict: a reader can then tell whether
// the code moved or the load did. 600s is the working figure here.
//
// ★ AND CONCURRENCY IS LOW ON PURPOSE. Two other lanes are usually typing and building in this
// tree. A wide fan-out wedges the box and turns "slow" into something indistinguishable from
// "hung", which is the exact ambiguity this file exists to remove.

import { execFile } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const FILTER = process.argv[2] ?? ''
const CEILING_S = Number(process.env.SWEEP_TIMEOUT ?? 600)
const LANES = Number(process.env.SWEEP_LANES ?? 2)

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.test\.tsx?$/.test(e)) out.push(p)
  }
  return out
}

type Verdict = 'PASS' | 'FAIL' | 'KILLED'
interface Result { file: string; verdict: Verdict; ms: number; tail: string }

function run(file: string): Promise<Result> {
  const started = Date.now()
  return new Promise(resolve => {
    // ⚠ `timeout` is the thing that makes KILLED distinguishable. Without it a hung file is
    // indistinguishable from a slow one and takes the whole sweep with it; with a bare kill and no
    // 124 to read, it is indistinguishable from a failure.
    execFile('timeout', [`${CEILING_S}`, 'npx', 'tsx', file], { cwd: ROOT, maxBuffer: 32 * 1024 * 1024 },
      (err, stdout, stderr) => {
        const ms = Date.now() - started
        const out = (stdout + stderr).trimEnd()
        const tail = out.split('\n').filter(Boolean).slice(-3).join(' | ').slice(0, 200)
        const code = (err as NodeJS.ErrnoException & { code?: number })?.code
        const verdict: Verdict = !err ? 'PASS' : code === 124 ? 'KILLED' : 'FAIL'
        resolve({ file: relative(ROOT, file), verdict, ms, tail })
      })
  })
}

const files = walk(join(ROOT, 'src')).filter(f => f.includes(FILTER)).sort()
console.log(`sweeping ${files.length} suites${FILTER ? ` matching '${FILTER}'` : ''} · ceiling ${CEILING_S}s · ${LANES} at a time\n`)
// ⚠ An empty sweep must not read as a clean one — same rule the guards use.
if (files.length === 0) { console.error(`❌ no suites matched '${FILTER}' — the sweep could not look, which is not a pass`); process.exit(2) }

const results: Result[] = []
let next = 0
async function lane() {
  while (next < files.length) {
    const f = files[next++]
    const r = await run(f)
    results.push(r)
    const mark = r.verdict === 'PASS' ? '✓' : r.verdict === 'KILLED' ? '⏱' : '✗'
    const slow = r.ms > 30_000 ? `  ${(r.ms / 1000).toFixed(0)}s` : ''
    console.log(`  ${mark} ${r.file}${slow}`)
    if (r.verdict !== 'PASS') console.log(`      ${r.tail}`)
  }
}
await Promise.all(Array.from({ length: LANES }, lane))

const by = (v: Verdict) => results.filter(r => r.verdict === v)
const slowest = [...results].sort((a, b) => b.ms - a.ms).slice(0, 5)
console.log(`\n── ${results.length} suites · ${by('PASS').length} pass · ${by('FAIL').length} FAIL · ${by('KILLED').length} KILLED (ceiling ${CEILING_S}s)`)
console.log(`   slowest: ${slowest.map(r => `${r.file.split('/').pop()} ${(r.ms / 1000).toFixed(0)}s`).join(' · ')}`)
for (const r of by('FAIL')) console.log(`   ✗ FAIL   ${r.file} (${(r.ms / 1000).toFixed(0)}s) — ${r.tail}`)
// ⚠ Named separately and never folded into the failures: a KILLED suite is an UNKNOWN, not a red.
for (const r of by('KILLED')) console.log(`   ⏱ KILLED ${r.file} at the ${CEILING_S}s ceiling — this is UNKNOWN, not failed. Re-run it alone before believing either.`)
process.exit(by('FAIL').length || by('KILLED').length ? 1 : 0)
