// ── `npm run tools` — every named tool in this repo, and what it is for ────────────────────────
//
// Run: npx tsx scripts/tools.mts [--all]
//
// ★★★ WHY THIS EXISTS (2026-09-01, hub lane). The same day the dev pages got a front door, this
// directory had **73 scripts and 9 npm names**. Everything else was invoke-by-full-path, which
// means reachable only by someone who already knew it existed — and PATTERNS had already written
// the lesson down after `sweep.mts` shipped with no npm script and two windows hand-rolled their
// own runners that failed in OPPOSITE directions: *"a shared runner only helps if it has a name
// people reach for; without one, 'use the shared runner' is advice, and advice loses to whatever
// is already in a shell history."*
//
// ⚠ THE DESCRIPTIONS ARE READ OUT OF THE SCRIPTS, NEVER RETYPED HERE. A catalogue that keeps its
// own copy of what each tool does is a mirror, and a mirror agrees with its source right up until
// it does not (PATTERNS 2026-08-22). Every line below comes from the target file's own header, so
// a tool whose purpose changes describes itself correctly the next time this is run.
//
// ⚠ AND IT NAMES WHAT IS *NOT* REACHABLE. `--all` lists the scripts with no npm name at all, which
// is the gap this tool exists to shrink and the number that should keep going down. Reporting only
// the tools that ARE named would make the catalogue look complete at any level of coverage.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const showAll = process.argv.includes('--all')

/** The first line of a script that says what it is, taken from its own header. */
function describe(rel: string): string {
  let src: string
  try { src = readFileSync(join(ROOT, rel), 'utf8') } catch { return '(file missing)' }
  for (const raw of src.split('\n').slice(0, 40)) {
    // ⚠ Strip a shebang BEFORE the comment prefix, or `#!/usr/bin/env node` loses its `#` to the
    // `#` branch and arrives here as `!/usr/bin/env node`, which then reads as a description.
    if (/^#!/.test(raw)) continue
    const line = raw.replace(/^\s*(\/\/|#|\*|\/\*\*?)\s?/, '').trim()
    if (!line) continue
    if (/^(Run|Usage):/i.test(line)) continue
    if (/^[─═━\-=]{4,}/.test(line)) continue
    if (/^(import|const|let|export|'use|#!)/.test(line)) continue
    // Strip a leading box-drawing title fence, keep the words inside it.
    const cleaned = line.replace(/^──+\s*/, '').replace(/\s*──+$/, '').trim()
    if (cleaned.length > 3) return cleaned.replace(/\s*[─]+\s*$/, '')
  }
  return '(no description in its header)'
}

/** The `Run:` / `Usage:` line, so the arguments are visible without opening the file. */
function usage(rel: string): string | null {
  let src: string
  try { src = readFileSync(join(ROOT, rel), 'utf8') } catch { return null }
  for (const raw of src.split('\n').slice(0, 40)) {
    const line = raw.replace(/^\s*(\/\/|#|\*|\/\*\*?)\s?/, '').trim()
    const m = /^(?:Run|Usage):\s*(.+)$/i.exec(line)
    if (m && m[1].trim().length > 3) return m[1].trim()
    if (/^(?:Run|Usage):$/i.test(line)) continue
    if (/^npx tsx scripts\//.test(line)) return line
  }
  return null
}

const SCRIPT_RE = /scripts\/[A-Za-z0-9_.-]+\.(mts|mjs|py|ts)/

/** npm name -> the script file it runs. Derived from package.json, never listed here. */
const named = new Map<string, string>()
for (const [name, cmd] of Object.entries(pkg.scripts as Record<string, string>)) {
  const m = SCRIPT_RE.exec(cmd)
  if (m) named.set(name, m[0])
}

// Group by the part before the colon, so related tools sit together without a hand-kept grouping.
const groups = new Map<string, string[]>()
for (const name of [...named.keys()].sort()) {
  const g = name.includes(':') ? name.split(':')[0] : 'run'
  if (!groups.has(g)) groups.set(g, [])
  groups.get(g)!.push(name)
}

const BOLD = '[1m', DIM = '[2m', OFF = '[0m'
console.log(`\n${BOLD}ather-games tools${OFF}  ${DIM}${named.size} named of ${readdirSync(join(ROOT, 'scripts')).filter(f => /\.(mts|mjs|py)$/.test(f)).length} scripts${OFF}\n`)

for (const [g, names] of [...groups.entries()].sort()) {
  console.log(`${BOLD}${g}${OFF}`)
  for (const name of names) {
    const rel = named.get(name)!
    console.log(`  ${`npm run ${name}`.padEnd(24)} ${describe(rel)}`)
    const u = usage(rel)
    if (u) console.log(`  ${' '.repeat(24)} ${DIM}${u}${OFF}`)
  }
  console.log('')
}

if (showAll) {
  const reachable = new Set([...named.values()].map(v => v.replace('scripts/', '')))
  const orphans = readdirSync(join(ROOT, 'scripts'))
    .filter(f => /\.(mts|mjs|py)$/.test(f) && !reachable.has(f))
    .sort()
  console.log(`${BOLD}no npm name${OFF} ${DIM}(reachable only by full path)${OFF}`)
  for (const f of orphans) console.log(`  ${f.padEnd(28)} ${DIM}${describe('scripts/' + f).slice(0, 78)}${OFF}`)
  console.log(`\n  ${orphans.length} unnamed. Add the ones you reach for; leave one-off repros alone.\n`)
} else {
  console.log(`${DIM}  npm run tools -- --all   also lists the scripts with no npm name${OFF}\n`)
}
