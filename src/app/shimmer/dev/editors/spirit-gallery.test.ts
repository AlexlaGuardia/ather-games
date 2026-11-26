// M213 s1: the gallery roster against CANON. Run: npx tsx src/app/shimmer/dev/editors/spirit-gallery.test.ts
// Reads the stage-2 lock ledger (discovery order) and the canon base table, so a reorder or a stray name goes red here.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GALLERY, DISCOVERY, dialStep, galleryNo } from './spirit-gallery'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, label: string) => { if (c) pass++; else fails.push(label) }

const LEDGER = '/root/athernyx/assets/stage2/grimoire-ledger.json'
const CANON = '/root/athernyx/CANON/world/spirits-species.md'
ok(existsSync(LEDGER), `ledger present (${LEDGER})`)
ok(existsSync(CANON), `canon base table present (${CANON})`)

ok(GALLERY.length === 50, `50 rows (got ${GALLERY.length})`)
GALLERY.forEach((r, i) => ok(r.num === i + 1, `row ${i} numbered ${i + 1} (got ${r.num})`))
ok(GALLERY.slice(0, 10).every(r => r.el === null) && GALLERY.slice(10).every(r => r.el !== null), 'base 10 first, then the 40 forms')
ok(new Set(GALLERY.map(r => r.name)).size === 50, 'every name unique')
ok(new Set(DISCOVERY.map(([s, e]) => `${s}/${e}`)).size === 40, 'every species x element once')

if (existsSync(LEDGER)) {
  const locks = (JSON.parse(readFileSync(LEDGER, 'utf8')).locks as { n: number; name: string }[]).slice().sort((a, b) => a.n - b.n)
  ok(locks.length === 40, `ledger has 40 locks (got ${locks.length})`)
  locks.forEach((l, i) => ok(GALLERY[10 + i]?.name === l.name, `form #${String(11 + i).padStart(3, '0')} = ledger n${l.n} ${l.name} (got ${GALLERY[10 + i]?.name})`))
}
if (existsSync(CANON)) {
  const md = readFileSync(CANON, 'utf8'), start = md.indexOf('## The 10 Base Forms'), table = md.slice(start, md.indexOf('## ', start + 5))
  const names = [...table.matchAll(/^\| \*\*([A-Za-z]+)\*\* \|/gm)].map(m => m[1])
  ok(names.length === 10, `canon base table has 10 rows (got ${names.length})`)
  names.forEach((n, i) => ok(GALLERY[i]?.name === n, `base #${String(i + 1).padStart(3, '0')} = canon ${n} (got ${GALLERY[i]?.name})`))
}
for (const r of GALLERY) ok(existsSync(join(process.cwd(), 'public', r.icon)), `${r.name}'s art exists: public${r.icon}`)

ok(galleryNo(7) === '#007' && galleryNo(50) === '#050', 'number label')
ok(dialStep(0, -1) === 0 && dialStep(49, 3) === 49 && dialStep(10, 2) === 12, 'dial held to its ends')

console.log(`spirit-gallery: ${pass} pass, ${fails.length} fail`)
if (fails.length) { for (const f of fails) console.log('  FAIL', f); process.exit(1) }
