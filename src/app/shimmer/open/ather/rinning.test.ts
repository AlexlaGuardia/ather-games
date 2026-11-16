// Rinning in the Wilds: the catch table (Alex 11-15: bait, the rinstick, cast, recast). Run: npx tsx src/app/shimmer/open/ather/rinning.test.ts
import { RINN, rollRinn, CAST_RANGE, BAIT } from './rinning'
import { PATTERNS } from '../shared/reel'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
let seed = 7; const rng = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296 }

// canon's catch: eight names, four tiers, canon XP
ok(RINN.length === 7 && RINN.filter(r => r.tier === 4).map(r => r.id).join() === 'crystal_rinn', 'catch: not canon\'s rinn')
ok(RINN.every(r => r.xp === [0, 15, 45, 120, 350][r.tier]), 'catch: XP is not canon\'s 15 / 45 / 120 / 350')
ok(BAIT === 'bait' && CAST_RANGE >= 10, 'cast: no bait id or a short reach')
// what a level can hook
const roll = (level: number, zone: 'meadows' | 'springs', n = 4000) => { const c: Record<number, number> = {}; for (let i = 0; i < n; i++) { const t = rollRinn(level, zone, rng).tier; c[t] = (c[t] ?? 0) + 1 } return c }
const l1 = roll(1, 'meadows')
ok(Object.keys(l1).join() === '1', `catch: level 1 hooked tiers ${Object.keys(l1)}`)
const l10 = roll(10, 'meadows')
ok(l10[4] > 0 && l10[1] > l10[2] && l10[2] > l10[3] && l10[3] > l10[4], `catch: level 10's table does not lean common (${JSON.stringify(l10)})`)
const sp = roll(10, 'springs')
ok((sp[3] ?? 0) + (sp[4] ?? 0) > (l10[3] ?? 0) + (l10[4] ?? 0), 'catch: the Mana Springs do not tip the table toward rarer rinn')

// every rinn has a habit the reel can run (the reel itself: shared/reel.test.ts)
ok(RINN.every(r => PATTERNS.includes(r.pattern)), 'catch: a rinn without a reel pattern')
ok(new Set(RINN.map(r => r.pattern)).size >= 5, 'catch: the Ather rinn share too few habits to tell apart')

if (fails.length) { console.error(`rinning: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`rinning: ${pass}/0`)
