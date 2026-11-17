// business/deed-pointer.ts: the deeds line (BETA M6d) shows only once a town was reached, and is struck once a place is owned.
import { deedPointerEntries, DEED_LINE, DEEDS_TOLD_KEY } from './deed-pointer'
import { GARDEN_KEY_SPECS } from '@/lib/keeper-key-specs'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }
ok(deedPointerEntries(false, false).length === 0, 'no town reached: no line')
ok(deedPointerEntries(false, true).length === 0, 'owning without being told cannot post it either')
const e = deedPointerEntries(true, false)
ok(e.length === 1 && e[0].id === 'deeds' && e[0].title === DEED_LINE.title && !e[0].struck, 'town reached: the line, open')
ok(deedPointerEntries(true, true)[0].struck === true, 'a place owned: struck, kept as a record')
ok(!/—/.test(DEED_LINE.title + DEED_LINE.note), 'cozy register: no em dash')
ok(GARDEN_KEY_SPECS.some(k => k.base === DEEDS_TOLD_KEY), 'the told flag is a registered garden key (cloud save carries it)')
console.log(`deed-pointer ${pass}/${fail}`)
if (fail) process.exit(1)
