// M221 guard: fonts are self-hosted. The Google Fonts loader fetched at build time and flaked
// `coord build` (Turbopack "Can't resolve .../font/google/font"). This fails if that import
// comes back anywhere in src, if a localFont path points at a missing file, or a font folder
// loses its OFL licence.  Run: npx tsx src/fonts/fonts-local.test.ts
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'

const SRC = resolve(__dirname, '..')
const BANNED = 'next/font/' + 'google'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }

function walk(d: string, out: string[] = []): string[] {
  for (const n of readdirSync(d)) {
    const p = join(d, n)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx?|jsx?|mts|cts|css)$/.test(n)) out.push(p)
  }
  return out
}

const files = walk(SRC)
ok(files.length > 100, `walked src (${files.length} files)`)
const hits = files.filter((f) => readFileSync(f, 'utf8').includes(BANNED))
ok(hits.length === 0, `no ${BANNED} import in src; found in: ${hits.join(', ')}`)

const users = files.filter((f) => /from ['"]next\/font\/local['"]/.test(readFileSync(f, 'utf8')))
ok(users.length >= 3, `localFont modules found (${users.length})`)
const dirs = new Set<string>()
for (const f of users) {
  const paths = [...readFileSync(f, 'utf8').matchAll(/path:\s*'([^']+\.woff2)'/g)].map((m) => m[1])
  ok(paths.length > 0, `${f} names woff2 files`)
  // 11-27: a `font-family` declaration renames the @font-face, but Turbopack still names the class and
  // the CSS variable after the JS const, so every face stopped matching and prod fell back to Georgia.
  ok(!/prop:\s*['"]font-family['"]/.test(readFileSync(f, 'utf8')), `${f}: no font-family declaration (Turbopack keeps the const name)`)
  for (const p of paths) {
    const abs = resolve(dirname(f), p)
    ok(existsSync(abs), `${f}: ${p} exists`)
    dirs.add(dirname(abs))
  }
}
for (const d of dirs) ok(existsSync(join(d, 'OFL.txt')), `${d} carries OFL.txt`)

console.log(`fonts-local: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
