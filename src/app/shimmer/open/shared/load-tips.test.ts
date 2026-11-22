// M95 load-screen tip picker. Run: npx tsx src/app/shimmer/open/shared/load-tips.test.ts
import { LOAD_TIPS, pickTip, tipPool } from './load-tips'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
ok(LOAD_TIPS.length === 30, `30 tips (${LOAD_TIPS.length})`)
for (const side of ['ather', 'nyx'] as const) {
  const pool = tipPool(side)
  ok(pool.length > 1, `${side} has tips`)
  ok(pool.every(i => LOAD_TIPS[i].side === 'both' || LOAD_TIPS[i].side === side), `${side} pool respects tags`)
  let last: number | null = null, rep = 0
  for (let n = 0; n < 200; n++) { const i = pickTip(side, last); if (i === last) rep++; ok(pool.includes(i), `${side} pick in pool`); last = i }
  ok(rep === 0, `${side} never repeats (${rep})`)
  ok(new Set(Array.from({ length: 300 }, () => pickTip(side, null))).size > 3, `${side} varies`)
}
ok(LOAD_TIPS.every(t => t.text.length > 0 && t.text.length <= 110), 'all tips <= 110 chars')
console.log(fails.length ? `FAIL ${fails.length}: ${fails.join(' | ')}` : `PASS ${pass} checks`)
process.exit(fails.length ? 1 : 0)
