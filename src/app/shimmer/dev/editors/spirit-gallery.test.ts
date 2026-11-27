// M213 s1: the gallery roster against CANON. Run: npx tsx src/app/shimmer/dev/editors/spirit-gallery.test.ts
// Reads the stage-2 lock ledger (discovery order) and the canon base table, so a reorder or a stray name goes red here.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GALLERY, DISCOVERY, dialStep, galleryNo, FORM_ART_VER, STEEP_NONE, steepAdd, steepMeals, steepTotal } from './spirit-gallery'
import { accentOf } from '../../open/ather/spirit-accent'

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
const iconFile = (icon: string) => join(process.cwd(), 'public', icon.split('?')[0])
for (const r of GALLERY) ok(existsSync(iconFile(r.icon)), `${r.name}'s art exists: public${r.icon}`)
// M202 (11-27): each form's public art IS its locked stage-2 picture, byte for byte (the old copies were other pictures),
// and its URL carries the version that busts the year-long immutable cache.
if (existsSync(LEDGER)) {
  const locks = JSON.parse(readFileSync(LEDGER, 'utf8')).locks as { name: string; file: string }[]
  for (const r of GALLERY.slice(10)) {
    const l = locks.find(x => x.name === r.name)
    const src = l && join('/root/athernyx/assets/stage2', l.file)
    ok(!!src && existsSync(src) && existsSync(iconFile(r.icon)) && readFileSync(src).equals(readFileSync(iconFile(r.icon))), `${r.name}'s public art is the locked ${l?.file}`)
    ok(r.icon.endsWith(`?v=${FORM_ART_VER}`), `${r.name}'s art url carries the cache version (${r.icon})`)
  }
}

ok(galleryNo(7) === '#007' && galleryNo(50) === '#050', 'number label')
ok(dialStep(0, -1) === 0 && dialStep(49, 3) === 49 && dialStep(10, 2) === 12, 'dial held to its ends')

// M213 s2: the Steep mix preview feeds the game's own accentOf; none = no glow; the bar holds 10
ok(steepMeals(STEEP_NONE).length === 0 && accentOf(steepMeals(STEEP_NONE)) === null, 'no meals = no glow')
let mx = steepAdd(STEEP_NONE, 'storm', 6); mx = steepAdd(mx, 'water', 4)
ok(steepTotal(mx) === 10 && steepMeals(mx).join() === 'storm,storm,storm,storm,storm,storm,water,water,water,water', `6 storm + 4 water = her bar (${steepMeals(mx).join()})`)
ok(steepAdd(mx, 'mana', 1) === mx, 'a full bar takes no more')
ok(steepAdd(STEEP_NONE, 'earth', -1) === STEEP_NONE && steepAdd(steepAdd(STEEP_NONE, 'earth', 3), 'earth', -1).earth === 2, 'never below 0, take one away')
ok(steepAdd(steepAdd(STEEP_NONE, 'mana', 8), 'storm', 5).storm === 2, 'add is held to the room left')
{ const a = accentOf(steepMeals(mx)), b = accentOf(steepMeals(steepAdd(STEEP_NONE, 'storm', 10)))
  ok(!!a && a.locked && a.n === 10 && !!b && a.hex !== b.hex, `6 storm + 4 water glows its own mix (${a?.hex}) vs all storm (${b?.hex})`) }

console.log(`spirit-gallery: ${pass} pass, ${fails.length} fail`)
if (fails.length) { for (const f of fails) console.log('  FAIL', f); process.exit(1) }
