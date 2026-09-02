/**
 * A TOOL WITH NO NAME IS ADVICE, AND A NAME THAT DOES NOT RUN IS WORSE THAN NO NAME.
 *
 * ★★★ WHY (2026-09-01, hub lane). This directory held **73 scripts and 9 npm names** — everything
 * else invoke-by-full-path, reachable only by someone who already knew it was there. PATTERNS had
 * written the lesson down weeks earlier, after `sweep.mts` shipped with no npm script and two
 * windows hand-rolled their own runners that failed in OPPOSITE directions (one reported a KILLED
 * suite as FAILED, the other had no timeout at all): *"a shared runner only helps if it has a name
 * people reach for."* The same session gave the dev PAGES a front door; this is the layer under it.
 *
 * ── WHAT THIS GUARDS ─────────────────────────────────────────────────────────────────────────
 * Not "are enough things named" — that is a judgement, and a count guard invites the cheapest lie
 * that makes it green. It guards that every name which EXISTS still works: the file is there, it
 * is invoked in a way that runs on a machine other than the one it was written on, and it can
 * describe itself so `npm run tools` is never a list of blanks.
 *
 * ⚠ THE `tsx` ASSERT IS NOT STYLE. `holds` was declared as bare `tsx scripts/board-holds.mts`,
 * which works only where `tsx` happens to be on PATH — every other entry uses `npx tsx`. That is
 * the hand-rolled-runner problem in miniature: a command that works in its author's shell and
 * nowhere else, which is exactly how two windows ended up with two different sweep runners.
 *
 * Run: `npx tsx scripts/tools.test.ts` (repo convention — there is no vitest).
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

let pass = 0
const fails: string[] = []
function ok(cond: boolean, label: string) {
  if (cond) pass++
  else fails.push(label)
}

const ROOT = process.cwd()
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const scripts: Record<string, string> = pkg.scripts ?? {}

const SCRIPT_RE = /scripts\/[A-Za-z0-9_.-]+\.(mts|mjs|py|ts)/
const named: [string, string][] = []
for (const [name, cmd] of Object.entries(scripts)) {
  const m = SCRIPT_RE.exec(cmd)
  if (m) named.push([name, m[0]])
}

// ── BLIND CHECK ───────────────────────────────────────────────────────────────────────────────
// ⚠ If the regex or package.json shape ever changes, every loop below iterates nothing and this
// file reports a clean bill for a repo it can no longer see. That is the failure mode this whole
// session was about, so it gets an assert before anything else.
ok(named.length > 10, `BLIND: only ${named.length} npm scripts point at scripts/ — expected many more, so the reader is broken rather than the repo`)

// ── 1. EVERY NAME STILL POINTS AT A FILE ──────────────────────────────────────────────────────
// Catches a renamed or deleted script leaving behind a name that fails at the moment someone
// reaches for it — which is the moment they are least able to afford it.
for (const [name, rel] of named) {
  ok(existsSync(join(ROOT, rel)), `DEAD NAME: "npm run ${name}" runs ${rel}, which does not exist`)
}

// ── 2. EVERY NAME RUNS OFF PATH, NOT OUT OF SOMEBODY'S SHELL ──────────────────────────────────
for (const [name, rel] of named) {
  const cmd = scripts[name]
  const runner = /\.py$/.test(rel) ? /^python3?\s/ : /\.mjs$/.test(rel) ? /^node\s/ : /^(npx tsx|node)\s/
  ok(runner.test(cmd.trim()),
    `UNPORTABLE RUNNER: "npm run ${name}" is declared as \`${cmd}\` — a bare runner resolves only where it happens to be on PATH. Use \`npx tsx\` (or \`node\`/\`python3\` to match the file).`)
}

// ── 3. EVERY NAMED TOOL CAN DESCRIBE ITSELF ───────────────────────────────────────────────────
// `npm run tools` reads these headers rather than keeping its own copy of what each tool does, so
// a tool with no header line makes the catalogue lie by omission instead of by being wrong.
for (const [name, rel] of named) {
  if (!existsSync(join(ROOT, rel))) continue
  const src = readFileSync(join(ROOT, rel), 'utf8')
  let described = false
  for (const raw of src.split('\n').slice(0, 40)) {
    if (/^#!/.test(raw)) continue
    const line = raw.replace(/^\s*(\/\/|#|\*|\/\*\*?)\s?/, '').trim()
    if (!line) continue
    if (/^(Run|Usage):/i.test(line)) continue
    if (/^[─═━\-=]{4,}/.test(line)) continue
    if (/^(import|const|let|export|'use)/.test(line)) continue
    if (line.replace(/^──+\s*/, '').trim().length > 3) { described = true; break }
  }
  ok(described, `NO DESCRIPTION: ${rel} has no header line, so "npm run tools" lists "npm run ${name}" with nothing beside it`)
}

// ── 4. THE CATALOGUE ITSELF IS REACHABLE ──────────────────────────────────────────────────────
// ★ A front door nobody can open is the problem this session started with. If `tools` ever loses
// its name, the fix for the unnamed-script problem becomes an unnamed script.
ok(scripts.tools !== undefined, 'THE CATALOGUE HAS NO NAME: `npm run tools` is gone, so the list of tools is itself only reachable by full path')
ok(existsSync(join(ROOT, 'scripts/tools.mts')), 'scripts/tools.mts is missing')

console.log(`tools: ${pass} pass, ${fails.length} fail  (${named.length} named tools)`)
if (fails.length) {
  for (const f of fails) console.error(`  ✗ ${f}`)
  process.exit(1)
}
