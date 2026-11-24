// npx tsx src/app/shimmer/open/ather/lines-batch-24a.test.ts
// ★ Lark batch 11-24a, SIGNED by Alex (athernyx 1be3a9f): every MAIN line that changed a placeholder ships word for word.
import { readFileSync } from 'fs'
import { SETTLER_BYE } from './first-settlement'
import { M70SIDE_TEXT } from './m70-alchemist'
import { GROWTH_LABEL, grownLine } from './spirit-growth'
import { HOLLOW_NAMES } from './hollow-names'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  x', m) } }
const canon = readFileSync('/root/athernyx/CANON/game/shimmer-lines-batch-2026-11-24a.md', 'utf8')
ok(/✅ SIGNED 2026-11-24/.test(canon), 'the batch is signed')
const row = (key: string) => canon.split('\n').find(l => l.startsWith(`| ${key}`)) ?? ''
const bold = (l: string) => /\*\*([^*]+)\*\*/.exec(l)?.[1] ?? null
ok(bold(row('`SETTLER_BYE`')) === SETTLER_BYE, `B SETTLER_BYE: game "${SETTLER_BYE}" vs canon "${bold(row('`SETTLER_BYE`'))}"`)
ok(bold(row("keeper's give-bottle answer")) === M70SIDE_TEXT.handLabel, `C handLabel: game "${M70SIDE_TEXT.handLabel}" vs canon "${bold(row("keeper's give-bottle answer"))}"`)
const main = (sec: string) => { const i = canon.indexOf(sec); const l = canon.slice(i).split('\n').find(x => x.startsWith('| **Main**')) ?? ''; return bold(l.slice('| **Main**'.length)) }
ok(main('**The bar\'s name**') === GROWTH_LABEL, `D bar: game "${GROWTH_LABEL}" vs canon "${main("**The bar's name**")}"`)
ok(main('**The moment') === grownLine('{name}'), `D moment: game "${grownLine('{name}')}" vs canon "${main('**The moment')}"`)
ok(main('## E. The merging Hollow') === HOLLOW_NAMES.crawler, `E merging Hollow: game "${HOLLOW_NAMES.crawler}" vs canon "${main('## E. The merging Hollow')}"`)
ok(main('**Optional: the insect-silhouette flier**') === HOLLOW_NAMES.floater, `E flier: game "${HOLLOW_NAMES.floater}" vs canon "${main('**Optional: the insect-silhouette flier**')}"`)
console.log(`lines-batch-24a: ${pass}/${fail}`)
if (fail) process.exit(1)
