// M109 s3 the party (spirit-party.ts, pure part). Run: npx tsx src/app/shimmer/open/ather/spirit-party.test.ts
import { withAsked, PARTY_MAX } from './spirit-party'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
ok(PARTY_MAX === 8, 'the party is 8 (Alex 11-23, Magii 2d9241e)')
let cur: string[] = []
for (let i = 0; i < 8; i++) { const r = withAsked(cur, `p${i}`); ok(r !== 'full', `ask along #${i + 1}`); if (r !== 'full') cur = r }
ok(cur.length === 8, 'eight asked along')
ok(withAsked(cur, 'p9') === 'full', 'the 9th is refused')
const again = withAsked(cur, 'p3'); ok(again !== 'full' && again.length === 8, 'asking one already along changes nothing, even when full')
ok(withAsked([], 'a') !== 'full' && (withAsked(['a'], 'a') as string[]).length === 1, 'no duplicates')
if (fails.length) { console.error(`spirit-party: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`spirit-party: ${pass}/0`)
