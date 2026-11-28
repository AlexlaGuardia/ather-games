// BETA M249: the gallery size slider's numbers. Run: npx tsx src/app/shimmer/dev/editors/gallery-size.test.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanScale, GALLERY_SIZE_KEY, loadSizes, saveSize, sizeLines, sizeSlot, tableValue, SIZE_MAX, SIZE_MIN } from './gallery-size'
import { AWAKEN_GROW, FORM_GROW, formGrow } from '../../open/ather/spirit-models'
import { GROWN } from '../../sprites/creature-size'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }

// clamp + step
ok(cleanScale(1) === 1 && cleanScale('x') === 1 && cleanScale(NaN) === 1, 'junk = 1')
ok(cleanScale(9) === SIZE_MAX && cleanScale(0) === SIZE_MIN, 'clamped')
ok(Math.abs(cleanScale(1.234) - 1.23) < 1e-9, 'stepped to 0.01')

// slots: one per form
ok(sizeSlot({ kind: 'base', sp: 'fox' }) === 'base:fox', 'base slot')
ok(sizeSlot({ kind: 'awakened', name: 'vulnarkor' }) === 'awakened:vulnarkor', 'awakened slot')
ok(sizeSlot({ kind: 'form', name: 'vulnix' }) !== sizeSlot({ kind: 'form', name: 'vulnore' }), 'forms differ')

// the lines name the table the game reads and its own key: value shape
const aw = sizeLines({ kind: 'awakened', name: 'vulnarkor' }, 1.1)
ok(aw[0].includes('AWAKEN_GROW') && aw[1] === `vulnarkor: ${Math.round(AWAKEN_GROW.vulnarkor * 1.1 * 100) / 100},`, 'awakened line ' + aw[1])
const fm = sizeLines({ kind: 'form', name: 'lepore' }, 2)
ok(fm[0].includes('FORM_GROW_BY') && fm[1] === `lepore: ${formGrow('lepore') * 2},`, 'form line ' + fm[1])
ok(sizeLines({ kind: 'form', name: 'not-listed' }, 1)[1] === `not-listed: ${FORM_GROW},`, 'unlisted form = FORM_GROW')
const bs = sizeLines({ kind: 'base', sp: 'axolotl' }, 1.5)
ok(bs[0].includes('GROWN') && bs[1] === `axolotl: { height: ${Math.round(GROWN.axolotl.height * 1.5 * 100) / 100}, length: ${Math.round(GROWN.axolotl.length! * 1.5 * 100) / 100} },`, 'base line ' + bs[1])
ok(sizeLines({ kind: 'base', sp: 'water-bear' }, 1)[1] === `'water-bear': { height: ${GROWN['water-bear'].height} },`, 'quoted key')
ok(tableValue({ kind: 'awakened', name: 'arcvex' }) === AWAKEN_GROW.arcvex && tableValue({ kind: 'base', sp: 'fox' }) === GROWN.fox.height, 'table values')

// the pasted line parses back into the source's record: the AWAKEN_GROW line in spirit-models.ts carries the same `name: n` shape
const src = readFileSync(join(process.cwd(), 'src/app/shimmer/open/ather/spirit-models.ts'), 'utf8')
ok(new RegExp(`AWAKEN_GROW[^\\n]*vulnarkor: ${AWAKEN_GROW.vulnarkor}[,} ]`).test(src), 'AWAKEN_GROW source shape = the line shape')

// storage round trip (a fake localStorage), Reset clears the slot
const mem = new Map<string, string>()
;(globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
ok(Object.keys(loadSizes()).length === 0, 'empty')
saveSize('awakened:vulnarkor', 1.37)
ok(loadSizes()['awakened:vulnarkor'] === 1.37 && mem.has(GALLERY_SIZE_KEY), 'saved')
saveSize('base:fox', 0.8); ok(Object.keys(loadSizes()).length === 2, 'two forms')
saveSize('awakened:vulnarkor', null); ok(!('awakened:vulnarkor' in loadSizes()) && loadSizes()['base:fox'] === 0.8, 'reset clears one')
saveSize('base:fox', 1); ok(!('base:fox' in loadSizes()), 'scale 1 = no slot')
mem.set(GALLERY_SIZE_KEY, '{bad'); ok(Object.keys(loadSizes()).length === 0, 'bad json = empty')

console.log(`gallery-size: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
