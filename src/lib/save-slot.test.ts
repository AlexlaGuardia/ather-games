// The save slot's own guard. Run: npx tsx src/lib/save-slot.test.ts
//
// ── ⚠ THIS FILE EXISTS BECAUSE THE KEY WAS A SCATTERED LITERAL (#682, 2026-08-23) ───────────────
// `ather:save:shimmer` was hand-written in five places across four files. Making it per-account
// meant moving all five together, and a reader left behind does not fail — it quietly keeps using
// the legacy slot while everything else moves on. That is the same silent-textual-reader shape that
// broke three rewrites and a canon gate on 2026-08-22, so the rule is enforced rather than
// remembered: NOBODY may spell the literal except this module.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  ANON_SAVE_KEY, SAVE_KEY_PREFIX, OWNER_FIELD,
  setSaveOwner, saveKey, saveOwner, slotFor, stampOwner, ownerOf, ownedBy,
} from './save-slot'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── the slot itself ─────────────────────────────────────────────────────────────────────────────
setSaveOwner(null)
ok(saveKey() === ANON_SAVE_KEY, `anonymous slot is the bare key (got ${saveKey()})`)
ok(saveOwner() === null, 'anonymous owner is null')

setSaveOwner('u_aaa')
ok(saveKey() === 'ather:save:shimmer:u_aaa', `signed-in slot carries the account (got ${saveKey()})`)
setSaveOwner('u_bbb')
ok(saveKey() === 'ather:save:shimmer:u_bbb', 'a second account gets a DIFFERENT slot')
ok(slotFor('u_aaa') !== slotFor('u_bbb'), 'two accounts never share a slot')
ok(slotFor(null) === ANON_SAVE_KEY, 'slotFor(null) is the anonymous slot')
ok(saveKey().startsWith(SAVE_KEY_PREFIX), 'every slot starts with the prefix the epoch reset sweeps')

// ── the stamp ───────────────────────────────────────────────────────────────────────────────────
const blob = JSON.stringify({ whose: 'A', pos: [1, 2, 3] })
const stampedA = stampOwner(blob, 'u_aaa')
ok(ownerOf(stampedA) === 'u_aaa', 'a stamped blob names its owner')
ok(JSON.parse(stampedA).whose === 'A', 'stamping preserves the save')
ok(ownerOf(blob) === null, 'an unstamped blob names nobody')
ok(stampOwner(blob, null) === blob, 'anonymous saves are not stamped')
ok(stampOwner('not json', 'u_aaa') === 'not json', 'an unparseable blob is passed through, not lost')
ok(JSON.parse(stampedA)[OWNER_FIELD] === 'u_aaa', 'the stamp rides in the documented field')

// ── the gate: THE BUG, both directions ──────────────────────────────────────────────────────────
ok(ownedBy(stampedA, 'u_aaa'), 'my own save is mine')
ok(!ownedBy(stampedA, 'u_bbb'), "★ #682: account B may NOT hold account A's save")
ok(ownedBy(blob, 'u_bbb'), 'an unstamped legacy save is adoptable (never delete an old garden)')
ok(ownedBy(blob, null), 'anonymous holds unstamped')
ok(!ownedBy(stampedA, null), "signing OUT does not inherit a signed-in keeper's save")

// ── ★ NO SECOND SPELLING OF THE KEY, ANYWHERE ───────────────────────────────────────────────────
// ⚠ COMMENTS ARE STRIPPED FIRST, AND THAT IS NOT TIDINESS. Several files legitimately DESCRIBE the
// old key in prose, and on 2026-08-22 a header quoting its own declaration handed a scanner a
// second match and made a canon gate report zero. A guard that matches prose either fires on honest
// documentation or gets loosened until it sees nothing. It reads code only.
const ROOT = join(process.cwd(), 'src')
const LITERAL = "'ather:save:shimmer'"
const ALLOWED = ['lib/save-slot.ts', 'lib/save-slot.test.ts']

function walk(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(ts|tsx)$/.test(e)) out.push(p)
  }
  return out
}
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const offenders: string[] = []
let scanned = 0
for (const file of walk(ROOT)) {
  const rel = file.slice(ROOT.length + 1)
  if (ALLOWED.some(a => rel === a)) continue
  scanned++
  const code = stripComments(readFileSync(file, 'utf8'))
  if (code.includes(LITERAL)) offenders.push(rel)
}
// ⚠ AND THE SCAN MUST PROVE IT COULD SEE. A walker that finds no files reports a clean sweep, which
// is the `ℹ check skipped / exit 0` shape — "I found nothing" and "I could not look" must not share
// an answer. If this ever reads 0, the guard is blind, not satisfied.
ok(scanned > 100, `the scan actually read the tree (${scanned} files) — 0 would mean BLIND, not clean`)
ok(offenders.length === 0, `★ the save key is spelled outside save-slot.ts: ${offenders.join(', ')}`)

// The module must still be the one place the literal DOES live, or the rule above is vacuous.
ok(readFileSync(join(ROOT, 'lib/save-slot.ts'), 'utf8').includes(LITERAL),
   'save-slot.ts still owns the literal — otherwise this whole guard asserts nothing')

console.log(`\nsave-slot: ${pass} passed, ${fails.length} failed  (${scanned} files scanned)`)
for (const f of fails) console.log(`  ✗ ${f}`)
process.exit(fails.length ? 1 : 0)
