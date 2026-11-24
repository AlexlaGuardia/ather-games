// npx tsx src/app/shimmer/open/ather/lines-batch-24f.test.ts
// ★ Lark batch 11-24f, SIGNED by Alex (athernyx 98e7f1c): the waymark MAIN lines (section A), word for word against the canon
// file, and the bag item 'Waymark Stone' (signed 11-24b). Morel's raid line and Greenscale (B, C) are not built here.
import { existsSync, readFileSync } from 'node:fs'
import * as WM from './waymarks'
import * as GF from './garden-fold'
import { BIOME, BIOME_NAME } from './wilds'
import { OPEN_ITEMS } from '../shared/inventory'
const DIR = '/root/athernyx/CANON/game/', F = DIR + 'shimmer-lines-batch-2026-11-24f.md', B = DIR + 'shimmer-lines-batch-2026-11-24b.md'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('  x', m) } }
ok(OPEN_ITEMS.waymark?.name === 'Waymark Stone' && OPEN_ITEMS.waymark.stack === 12, `the bag item (id waymark) is "${OPEN_ITEMS.waymark?.name}"`)
if (!existsSync(F)) { console.log('SKIP the rest: athernyx canon not on this machine'); process.exit(fail ? 1 : 0) }
const canon = readFileSync(F, 'utf8')
ok(/✅ SIGNED 2026-11-24 by Alex: waymark MAIN lines/.test(canon), '24f is signed (waymark MAIN)')
ok(readFileSync(B, 'utf8').includes('**Waymark Stone · in your bag.'), "24b's bag line names the item")
const sec = canon.slice(canon.indexOf('## A.'), canon.indexOf('Notes\n'))
const rows = new Map(sec.split('\n').filter(l => /^\| /.test(l) && !/^\| key|^\|---/.test(l)).map(l => { const c = l.split('|').map(x => x.trim()); return [c[1], { built: c[2], main: /\*\*(.+?)\*\*/.exec(c[3])?.[1] ?? '', alt: c[4].replace(/\s*\*\([^)]*\)\*$/, '') }] as const }))
ok(rows.size === 11, `11 rows (${rows.size})`)
const used = new Set<string>()
const is = (starts: string, game: string) => { const k = [...rows.keys()].find(x => x.startsWith(starts)); if (k) used.add(k); ok(!!k && rows.get(k)!.main === game, `${starts}: game "${game}" vs canon "${k && rows.get(k)!.main}"`) }
// canPlant itself refuses with them
const at = { tile: 't', x: 0, z: 0, biome: BIOME.woods, grounded: true, swimming: false, settlement: null, ground: 'cleared' as const, folded: true }
const why = (o: object, list: WM.Waymark[] = []) => { const v = WM.canPlant(list, { ...at, ...o }); return v.ok ? '(plants)' : v.why }
const wm = (k: number, o: object = {}): WM.Waymark => ({ id: `w${k}`, tile: `far${k}`, x: 0, y: 0, z: 0, biome: BIOME.meadow, made: 0, ...o })
is('not grounded', why({ grounded: false })); is('not grounded', why({ swimming: true })); is('water', why({ biome: BIOME.water }))
is('cap', why({}, Array.from({ length: WM.MAX_WAYMARKS }, (_, k) => wm(k))).replace(String(WM.MAX_WAYMARKS), '{max}'))
is('per biome', why({}, Array.from({ length: WM.PER_BIOME }, (_, k) => wm(k, { biome: BIOME.woods }))).replace(String(WM.PER_BIOME), '{n}').replace(BIOME_NAME[BIOME.woods], '{biome}'))
is('spacing', why({}, [wm(1, { tile: 't', x: 41 })]).replace('41', '{m}'))
is('one per settlement', why({ settlement: 's1' }, [wm(1, { settlement: 's1' })]))
is('planted toast', WM.WAY_TEXT.planted('{place}')); is('lifted toast', WM.WAY_TEXT.lifted); is('lifted, bag full', WM.WAY_TEXT.liftedFull); is('none in bag', WM.WAY_TEXT.none)
is('garden folded', GF.FOLD_TEXT.folded(77).replace('77', '{grey}'))
ok(used.size === 11, `every row spoken (${used.size})`)
// the build speaks them, no old line or alt left
const read = (f: string) => readFileSync(new URL(`./${f}`, import.meta.url), 'utf8')
const page = read('page.tsx'), all = [page, read('waymarks.ts'), read('garden-fold.ts'), read('panels.tsx')].join('\n')
for (const k of ['WAY_TEXT.planted(', 'WAY_TEXT.lifted', 'WAY_TEXT.liftedFull', 'WAY_TEXT.none', 'FOLD_TEXT.folded(']) ok(page.includes(k), `the page says ${k}`)
for (const old of ['binds ground', 'hold a binding', 'as many as the fold will carry', 'Find other country', ' m). Walk on.', 'You already hold a waymark in this settlement', 'Waymark bound in', 'it went back to the fold.', 'No waymarks in your bag', 'Garden folded.']) if (old !== 'it went back to the fold.') ok(!all.includes(old), `gone: "${old}"`); else ok(!all.includes('full: it went'), 'gone: the old bag-full line')
for (const [k, r] of rows) if (r.alt && r.alt !== r.main && r.alt !== '') ok(!all.includes(r.alt.replace(/\{.*/, '')) || r.alt.startsWith('Waymark lifted'), `${k}: alt not shipped`)
console.log(`lines-batch-24f: ${pass}/${pass + fail}`)
if (fail) process.exit(1)
