// ★ PORT-BOUNDARY RULE 4, ENFORCED. Run: npx tsx src/app/shimmer/voxel/purity.test.ts
//
// VOXEL-WORLD-MODEL.md § 6 lists four rules that make the voxel core portable to Supra. Three of
// them are design choices you either made or didn't. This is the fourth, and it is the only one
// that can rot: "the voxel core lives in a folder with ZERO react/three/DOM imports."
//
// "We'll port it later" dies the day the world model quietly grows a useState — and it will, inside
// two weeks, unless something fails loudly. This is the something. It walks the import graph of
// src/app/shimmer/voxel/ and fails on any dependency that could not exist in Rust.
//
// If you are here because this test failed: do not add an exception. The offending code belongs on
// the HOST side of the boundary (the renderer, the worker plumbing, the editor), and the core should
// hand it data instead. That inversion is the entire portability strategy.

import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

const DIR = join(process.cwd(), 'src/app/shimmer/voxel')

/** Anything whose concept does not exist in a headless Rust crate. */
const BANNED = [
  { re: /\breact\b/i, why: 'react — the core must not know a UI framework exists' },
  { re: /\bthree\b/, why: 'three.js — geometry types are the renderer\'s problem, hand it arrays' },
  { re: /@react-three\//, why: 'react-three-fiber — host-side rendering' },
  { re: /\bnext\//, why: 'next.js — host-side framework' },
  { re: /\bidb\b|indexeddb/i, why: 'IndexedDB — persistence is the host\'s, the core is pure' },
]

/** Browser globals that would not exist in a Rust port (or a node worker). */
const BANNED_GLOBALS = [
  { re: /\bdocument\./, why: 'document — DOM access' },
  { re: /\bwindow\./, why: 'window — browser global' },
  { re: /\bnavigator\./, why: 'navigator — browser global' },
  { re: /\blocalStorage\b/, why: 'localStorage — browser storage' },
  { re: /\buseState\b|\buseEffect\b|\buseMemo\b|\buseRef\b/, why: 'a React hook — this is the exact rot the rule exists to catch' },
]

const CORE = readdirSync(DIR).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'bench.ts')

let pass = 0
const fails: string[] = []

for (const file of CORE) {
  const src = readFileSync(join(DIR, file), 'utf-8')
  // Strip comments so prose about React (like this file's own header) can't trip the scan.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  const imports = [...code.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)].map(m => m[1])
  for (const spec of imports) {
    const hit = BANNED.find(b => b.re.test(spec))
    if (hit) fails.push(`${file}: imports "${spec}" — ${hit.why}`)
    else pass++
    // A relative import that escapes the folder drags the whole outside world in behind it.
    if (spec.startsWith('.') && spec.includes('..')) fails.push(`${file}: imports "${spec}" from OUTSIDE the voxel core — the core may not depend upward`)
    else pass++
  }

  for (const g of BANNED_GLOBALS) {
    if (g.re.test(code)) fails.push(`${file}: uses ${g.why}`)
    else pass++
  }
}

console.log(`\nvoxel core purity: ${CORE.length} files scanned — ${pass} checks passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) {
  console.log('\n★ The voxel core has grown a host dependency. Move the offending code to the host side;')
  console.log('  do not add an exception here. See VOXEL-WORLD-MODEL.md § 6 rule 4.')
  process.exit(1)
}
console.log(`✅ the core is portable — ${CORE.join(', ')}`)
