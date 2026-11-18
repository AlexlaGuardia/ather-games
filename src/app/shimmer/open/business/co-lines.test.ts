// Run: npx tsx src/app/shimmer/open/business/co-lines.test.ts
// The Co. clerk (business/co-lines.ts): every CLERK line is VERBATIM in the signed script (read from canon here, so an edit on
// either side fails), and the talk/board/bye choices pick the right one.
import { readFileSync, existsSync } from 'node:fs'
import { CO_SIGN, CO_SIGN_SMALL, CO_GREETING, CO_BARK, CO_FLAVOUR, CO_ASK, coTalk, boardLine, refusalLine, paidLine, byeLine, adoptCoSeen } from './co-lines'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SCRIPT = '/root/athernyx/CANON/game/co-citadel-office-script.md'
if (existsSync(SCRIPT)) {
  const s = readFileSync(SCRIPT, 'utf8')
  ok(/SIGNED by Alex/.test(s), 'the script is marked SIGNED')
  for (const l of [CO_SIGN, CO_SIGN_SMALL, ...CO_GREETING, ...Object.values(CO_BARK), ...CO_FLAVOUR]) ok(s.includes(l), `not verbatim in the signed script: "${l}"`)
  ok(s.includes("CLERK: Delivered. Here's your pay."), 'B4 is the signed variant')
} else console.log('  (canon repo not on this box: verbatim leg skipped)')
ok(CO_GREETING.length === 4 && Object.keys(CO_BARK).length === 10 && CO_FLAVOUR.length === 3, 'counts: 4 greeting, 10 barks, 3 flavour')

// talk
const calls: string[] = []
const a = { board: () => calls.push('board'), bye: () => calls.push('bye'), next: () => calls.push('next') }
const g0 = coTalk(0, 0, a)
ok(g0.line === CO_GREETING[0] && g0.options.length === 1 && g0.options[0].label === CO_ASK.next, 'greeting step 1: one line, one "…"')
const g3 = coTalk(3, 0, a)
ok(g3.line === CO_GREETING[3] && g3.options[0].label === CO_ASK.board, 'greeting last: the answer opens the board')
g3.options[0].pick(); ok(calls.at(-1) === 'board', 'greeting last picks board')
for (let v = 0; v < 6; v++) ok(coTalk(null, v, a).line === CO_FLAVOUR[v % 3], `visit ${v}: flavour cycles`)
const later = coTalk(null, 1, a)
ok(later.options.map(o => o.label).join('|') === `${CO_ASK.board}|${CO_ASK.bye}`, 'later visit: board, goodbye')
later.options[1].pick(); ok(calls.at(-1) === 'bye', 'goodbye picks bye')
// board + refusals + pay + bye
ok(boardLine(false, 5) === "Board's up. Have a look." && boardLine(true, 5) === "You've still got one out. Finish it first." && boardLine(false, 0) === 'Nothing posted. Come back later.', 'board lines B1/B3/B6')
ok(boardLine(true, 0) === CO_BARK.holding, 'holding wins over empty')
ok(refusalLine(true) === "One at a time. That's the rule." && refusalLine(false) === "Won't fit. Find a lighter one, or a bigger load.", 'refusals B7/B8')
ok(paidLine(1) === "Delivered. Here's your pay." && paidLine(2) === 'Good. The Co. likes a clean haul.' && paidLine(3) === CO_BARK.paid, 'pay alternates B4/B5')
ok(byeLine(false) === 'Safe roads.' && byeLine(true) === "It won't deliver itself.", 'bye B9/B10')
// save
ok(adoptCoSeen(null).greeted === false && adoptCoSeen({ v: 1, greeted: true, visits: 4.7 }).visits === 4 && adoptCoSeen({ v: 1, visits: -2 }).visits === 0, 'adopt')

console.log(`co-lines: ${pass}/${fails.length}`)
if (fails.length) { for (const f of fails) console.log('  FAIL ' + f); process.exit(1) }
