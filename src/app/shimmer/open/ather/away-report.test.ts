// 'While you were away' joins the village + station reports. Run: npx tsx src/app/shimmer/open/ather/away-report.test.ts
import { awayText, addMade } from './away-report'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
ok(awayText({}) === null && awayText({ roast_rinn: 0 }) === null, 'nothing made: no line')
const m = addMade(addMade({}, { roast_rinn: 2 }), [{ id: 'roast_rinn', n: 3 }, { id: 'plank', n: 4 }])
ok(m.roast_rinn === 5 && m.plank === 4, 'village map + station stacks add up')
const t = awayText(m)!
ok(/^While you were away, your village made 5 \S/.test(t) && t.includes(', 4 ') && t.endsWith("You will find it all in the rooms' stores."), `one line (${t})`)
console.log(`away-report: ${pass} pass, ${fails.length} fail`); for (const f of fails) console.log('  FAIL', f); if (fails.length) process.exit(1)
