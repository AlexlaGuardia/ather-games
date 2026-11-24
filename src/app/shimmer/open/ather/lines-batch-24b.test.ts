// npx tsx src/app/shimmer/open/ather/lines-batch-24b.test.ts
// ★ Lark batch 11-24b, SIGNED by Alex (athernyx c1d5903): training pool UI, waymarks, Greg's fold, MAIN word for word against the
// canon file; plus 11-24d (addf90b): the map's fourth state word, Charted, and the four-word legend. No alt ships.
import { existsSync, readFileSync } from 'node:fs'
import * as TL from './training-lines'
import * as WM from './waymarks'
import * as GF from './garden-fold'
import * as SM from './spread-map'
import { BIOME } from './wilds'
const DIR = '/root/athernyx/CANON/game/', B = DIR + 'shimmer-lines-batch-2026-11-24b.md', D = DIR + 'shimmer-lines-batch-2026-11-24d.md'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('  x', m) } }
// the plural (runs without canon too)
const T = TL.TRAIN_UI
ok(T.play(1, 'AGI', 10, 11) === 'One play: 1 point, AGI 10 → 11', `1 point ("${T.play(1, 'AGI', 10, 11)}")`)
ok(T.play(2, 'AGI', 10, 12) === 'One play: 2 points, AGI 10 → 12', `2 points ("${T.play(2, 'AGI', 10, 12)}")`)
ok(/: 0 points,/.test(T.play(0, 'AGI', 1, 1)), '0 points')
if (!existsSync(B)) { console.log('SKIP the rest: athernyx canon not on this machine'); process.exit(fail ? 1 : 0) }
const canon = readFileSync(B, 'utf8'), canonD = readFileSync(D, 'utf8')
ok(/✅ SIGNED 2026-11-24 by Alex[^\n]*MAIN ships everywhere/.test(canon), '24b is signed (MAIN)')
ok(/✅ SIGNED 2026-11-24 by Alex \("Charted"\)/.test(canonD), '24d is signed (Charted)')
// every table row: key -> { main, alt }. A Main is the bold text, or the plain text marked *(kept...)*
const sec = (a: string, b: string) => canon.slice(canon.indexOf(a), canon.indexOf(b))
const A = sec('## A.', '## B.'), Bx = sec('## B.', '## C.'), C = sec('## C.', '## Counts')
type Row = { main: string; alt: string }
const rows = (s: string) => new Map(s.split('\n').filter(l => /^\| /.test(l) && !/^\| key|^\|---/.test(l)).map(l => {
  const c = l.split('|').map(x => x.trim()); return [c[1], { main: (/^\*\*(.+)\*\*$/.exec(c[3])?.[1] ?? c[3]).replace(/\s*\*\([^)]*(\([^)]*\))?[^)]*\)\*$/, '').trim(), alt: c[4].replace(/\s*\*\([^)]*\)\*$/, '').trim() }] as [string, Row] }))
const a = rows(A), b = rows(Bx), c = rows(C), used = new Set<string>()
ok(a.size === 9 && b.size === 10 && c.size === 6, `9 + 10 + 6 rows (${a.size} + ${b.size} + ${c.size})`)
const is = (m: Map<string, Row>, startsWith: string, game: string) => { const k = [...m.keys()].find(x => x.startsWith(startsWith)); if (k) used.add(k); const main = k && m.get(k)!.main; ok(main === game, `${startsWith}: game "${game}" vs canon "${main}"`) }
// A
is(a, 'species-unknown', T.unknown); is(a, 'pool header', T.header); is(a, 'preview, stat capped', T.cap('AGI')); is(a, 'preview, pool empty', T.empty)
is(a, 'toggle, off', T.allow); is(a, 'toggle, on', T.allowed); is(a, 'footer', T.footer); is(a, 'empty state', T.none)
is(a, 'preview, can play', T.play(2, 'AGI', 1, 2).replace('2 points', 'N point(s)').replace('1 → 2', 'a → b'))
// B
const at = { tile: 't', x: 0, z: 0, biome: BIOME.woods, grounded: true, swimming: false, settlement: null } as const
const why = (o: object) => { const v = WM.canPlant([], { ...at, ...o }); return v.ok ? '(plants)' : v.why }
is(b, 'still grey', why({ ground: 'infected', folded: true })); is(b, 'not kept ground', why({ ground: null, folded: true })); is(b, 'not folded yet', why({ folded: false }))
is(b, 'fold-map hint', WM.PLANT_HINT); is(b, 'dark refusal', WM.DARK_WHY); is(b, 'map label', WM.UNLIT_LABEL)
const F = GF.FOLD_TEXT, have = (f: (n: number) => string) => f(77).replace('77', '{have}')
is(b, '`buyAsk`', F.buyAsk); is(b, '`buyShort`', have(F.buyShort)); is(b, '`buyDone`', F.buyDone); is(b, 'HUD bag line', F.buyBag(77).replace('77', 'N'))
// C
is(c, '`offer`', F.offer); is(c, '`ask`', F.ask); is(c, '`short`', have(F.short)); is(c, '`done`', F.done); is(c, '`go`', F.go)
ok(used.size === 24 && [...c.keys()].includes("the keeper's \"Not yet.\""), `24 lines + the untouched signed one (${used.size})`)
// 24d
const word = /\| 1 \| `spread\.map\.legend`[^\n]*?\*\*([^*]+)\*\*/.exec(canonD)?.[1], legend = /signed words unchanged: \*\*([^*]+)\*\*/.exec(canonD)?.[1]
ok(SM.LEGEND().join(' · ') === legend, `legend "${SM.LEGEND().join(' · ')}" vs canon "${legend}"`)
ok(SM.STATE_WORD.charted === word, `the state word "${SM.STATE_WORD.charted}" vs canon "${word}"`)
ok(readFileSync('/root/athernyx/CANON/glossary.md', 'utf8').includes(`map legend: ${SM.LEGEND().join(' · ')};`), 'the glossary says the same legend')
// the build speaks them: no inline copy, no old placeholder, no alt
const read = (f: string) => readFileSync(new URL(`./${f}`, import.meta.url), 'utf8')
const panel = read('spirit-talk.tsx'), page = read('page.tsx'), panels = read('panels.tsx'), wm = read('waymarks.ts'), gf = read('garden-fold.ts'), all = [panel, page, panels, wm, gf, read('training-lines.ts')].join('\n')
for (const k of ['header', 'play(', 'cap(', 'empty', 'allow ', 'allowed', 'footer', 'none']) ok(panel.includes(`TRAIN_UI.${k}`) || panel.includes(`TRAIN_UI.${k.trim()}}`), `the panel says TRAIN_UI.${k}`)
ok(page.includes('TRAIN_UI.unknown'), 'the grown toast falls back to TRAIN_UI.unknown')
ok(page.includes('FOLD_TEXT.buyBag(grey)'), 'the bag line is FOLD_TEXT.buyBag'); ok(panels.includes('{PLANT_HINT}'), 'the fold map says PLANT_HINT')
ok(panels.includes('AREA_STATES.map'), 'the legend is drawn from the states themselves')
for (const old of ['no training pieces on the plot<', 'Gregory has not folded', 'then bind it', 'only binds kept ground', 'Buy a waymark (', 'a waymark takes', 'Bind it where', 'I can fold you a garden of your own', 'That is not enough yet', 'its gate is open', '`Waymark · in your bag', 'spend} point,']) ok(!all.includes(old), `gone: "${old}"`)
for (const m of [a, b, c]) for (const [k, r] of m) if (r.alt.length > 12 && !/\bN\b|a → b/.test(r.alt)) ok(!all.includes(r.alt), `${k}: alt not shipped ("${r.alt}")`)
for (const f of [T.play(2, 'AGI', 1, 2), T.none, F.offer, F.done, F.buyDone]) ok(!/[—;]/.test(f), `no em dash or semicolon: ${f}`)
console.log(`lines-batch-24b: ${pass}/${pass + fail}`)
if (fail) process.exit(1)
