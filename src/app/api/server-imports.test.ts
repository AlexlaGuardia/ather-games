// Server-import oracle — run: npx tsx src/app/api/server-imports.test.ts
//
// ★ WHY (2026-11-17, serb): /api/saves/open imported KEEPER_KEY_SPECS from `lib/keeper-local.ts`, which starts with
// 'use client'. Under tsx and tsc that import is a plain module and every test passed. Under `next build` a server
// module importing a 'use client' file gets a CLIENT-REFERENCE STUB, so `KEEPER_KEY_SPECS.map` was not a function and
// two coord builds failed (fixed in 6b364278). The test runners cannot see that boundary, so this walks it: every
// API route's import graph (relative + '@/' imports, transitively) must contain no 'use client' module.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'

const SRC = resolve(__dirname, '..', '..')
const EXTS = ['.ts', '.tsx', '/index.ts', '/index.tsx']

function routes(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) routes(p, out)
    else if (/^route\.tsx?$/.test(n)) out.push(p)
  }
  return out
}

function resolveImport(from: string, spec: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2))
  else if (spec.startsWith('.')) base = resolve(dirname(from), spec)
  else return null                                   // a package, not ours
  if (existsSync(base) && statSync(base).isFile()) return base
  for (const e of EXTS) if (existsSync(base + e)) return base + e
  return null
}

const isClient = (src: string) => /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*\s*['"]use client['"]/.test(src)
// `import type` is erased at build time and cannot pull a client module into the server bundle
const IMPORT_RE = /^\s*(?:import|export)\s+(?!type\b)[^'"]*?from\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/gm

let failures = 0
const allRoutes = routes(join(SRC, 'app', 'api'))
for (const route of allRoutes) {
  const seen = new Map<string, string | null>()     // file -> the file that imported it
  const stack: string[] = [route]
  seen.set(route, null)
  while (stack.length) {
    const f = stack.pop()!
    const src = readFileSync(f, 'utf8')
    if (f !== route && isClient(src)) {
      const chain: string[] = [f]
      for (let p = seen.get(f); p; p = seen.get(p) ?? null) chain.unshift(p)
      failures++
      console.log(`  FAIL  ${route.slice(SRC.length + 1)} reaches a 'use client' module:\n        ${chain.map(c => c.slice(SRC.length + 1)).join('\n     -> ')}`)
      continue
    }
    for (const m of src.matchAll(IMPORT_RE)) {
      const r = resolveImport(f, m[1] ?? m[2])
      if (r && !seen.has(r)) { seen.set(r, f); stack.push(r) }
    }
  }
}
if (allRoutes.length < 5) { failures++; console.log(`  FAIL  only ${allRoutes.length} routes found: the walker is not seeing src/app/api`) }
console.log(failures ? `server-imports: ${failures} FAILED` : `server-imports: ${allRoutes.length} routes clean`)
process.exit(failures ? 1 : 0)
