// BETA M249 s2 (sprites, 2026-11-28): ALEX'S GALLERY SIZE PASS IS IN THE TABLES. His 100 slider values (open:gallery-size.v1,
// docs/looks/m249-sizes-2026-11-28/alex-gallery-sizes.json) were MULTIPLIERS on the table value of the day (sizeLines prints
// `was x scale`). tables-before.json = the table value each form had when he tuned (HEAD 7f35dc1c). Every form/awakened key must now
// read exactly what 'Copy values' printed for his slider then. The four BASE keys are GROWN (creature-size.ts), which canon rules
// (npm run canon grown-sizes): they wait on a Magii ruling and stay as canon has them; this test names them and fails if that set moves.
// Run: npx tsx src/app/shimmer/dev/editors/gallery-size-m249.test.ts
import { readFileSync } from 'fs'
import { join } from 'path'
import { tableValue, awakenedSlot, type SizeForm } from './gallery-size'
import { GROWN } from '../../sprites/creature-size'
import type { Species } from '../../spirits/spirit'

let fails = 0
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.error('FAIL ' + m) } }
const dir = join(process.cwd(), 'docs/looks/m249-sizes-2026-11-28')
const sizes: Record<string, number> = JSON.parse(readFileSync(join(dir, 'alex-gallery-sizes.json'), 'utf8'))
const before: Record<string, number> = JSON.parse(readFileSync(join(dir, 'tables-before.json'), 'utf8'))
const r2 = (n: number) => Math.round(n * 100) / 100

const PENDING_CANON = ['base:firefly', 'base:rabbit', 'base:hummingbird', 'base:bat']
const formOf = (k: string): SizeForm => {
  const [kind, name] = k.split(':')
  return kind === 'base' ? { kind: 'base', sp: name as Species } : { kind: kind as 'form' | 'awakened', name }
}

ok(Object.keys(sizes).length === 100, `100 entries (got ${Object.keys(sizes).length})`)
const unmapped: string[] = [], pending: string[] = []
let written = 0
for (const [k, s] of Object.entries(sizes)) {
  const f = formOf(k), now = tableValue(f), was = before[k]
  if (now == null || was == null) { unmapped.push(k); continue }
  if (f.kind === 'base') { pending.push(k); ok(now === was, `${k}: GROWN unchanged until canon rules (${now} vs ${was})`); continue }
  ok(now === r2(was * s), `${k}: table ${now}, Copy values printed ${r2(was * s)} (${was} x ${s})`)
  written++
}
ok(unmapped.length === 0, `keys with no table slot: ${unmapped.join(', ')}`)
ok(written === 96, `96 form/awakened values written (got ${written})`)
ok(pending.sort().join() === [...PENDING_CANON].sort().join(), `canon-pending set is exactly the four bases (got ${pending.join(', ')})`)
ok(GROWN.firefly.height === 0.1 && GROWN.bat.height === 0.45, 'GROWN still canon values')
// hub call 2 (11-28): the awakened lines Alex did NOT size keep their look against their 2nd form: each dial x that form's factor
// (Arclotl x1.61, Aurmere x1.39, Craglotl x2.0). tables-before.json 'follow:<TABLE>:<name>' = the dial before.
const FOLLOW_FORM: Record<string, string> = { ARCLOTL_AW_DIAL: 'arclotl', AURMERE_AW_DIAL: 'aurmere', CRAGLOTL_AW_DIAL: 'craglotl' }
let followed = 0
for (const [k, was] of Object.entries(before)) {
  if (!k.startsWith('follow:')) continue
  const [, table, name] = k.split(':'), a = awakenedSlot(name), f = sizes[`form:${FOLLOW_FORM[table]}`]
  ok(!sizes[`awakened:${name}`] && a?.table === table && a.was === r2(was * f), `${name}: follows ${FOLLOW_FORM[table]} x${f}: ${a?.was} = ${r2(was * f)} (${was})`)
  followed++
}
ok(followed === 12, `12 unsized awakened dials follow their 2nd form (got ${followed})`)
// the awakened lines on their own dials are now visible to Copy values (they printed nothing before)
ok(awakenedSlot('mesamun')?.table === 'MESAMERE_AW_DIAL' && awakenedSlot('croakarkor')?.table === 'CROAK_AW_DIAL', 'dial lookup')
ok(awakenedSlot('vulnitar')?.table === 'AWAKEN_GROW', 'AWAKEN_GROW lookup')

if (fails) { console.error(`${fails} failed`); process.exit(1) }
console.log(`gallery-size-m249: PASS (96 sizes written, 4 base sizes canon-pending: ${PENDING_CANON.join(', ')})`)
