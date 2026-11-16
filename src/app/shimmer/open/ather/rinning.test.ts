// Rinning (Alex 11-15: bait, the rinstick, cast, a give-and-take reel, recast). Run: npx tsx src/app/shimmer/open/ather/rinning.test.ts
import { RINN, rollRinn, newReel, stepReel, landed, CAST_RANGE, BAIT, type Reel } from './rinning'

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

// ★ the reel cannot be lost (canon: "you are asking a rinn, not tricking one")
const run = (tier: number, play: (r: Reel) => boolean, maxS = 600) => {
  let r = newReel(tier, rng), t = 0, min = 1
  while (!landed(r) && t < maxS) { r = stepReel(r, 0.05, play(r), rng); t += 0.05; min = Math.min(min, r.progress) }
  return { r, t, min }
}
for (const tier of [1, 2, 3, 4]) {
  const good = run(tier, r => r.mood === 'rest')            // take when it rests, give when it pulls
  const greedy = run(tier, () => true)                      // reel the whole time
  ok(landed(good.r) && good.t < 60, `reel: a well-played tier ${tier} took ${good.t.toFixed(1)} s`)
  ok(landed(greedy.r), `reel: reeling the whole time never landed a tier ${tier} (a clumsy reel must only be slower)`)
  ok(greedy.t > good.t, `reel: reeling against the pulls was not slower at tier ${tier}`)
  ok(greedy.r.slips > 0 && good.min > 0, `reel: no slips when pulling against it, or progress fell to nothing (tier ${tier})`)
}
const idle = run(2, () => false, 120)
ok(!landed(idle.r) && idle.r.progress > 0, 'reel: doing nothing landed it, or lost it (it should only wait)')
ok(run(4, r => r.mood === 'rest').t > run(1, r => r.mood === 'rest').t, 'reel: a crystal rinn is not a longer reel than a shimmerscale')

if (fails.length) { console.error(`rinning: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`rinning: ${pass}/0`)
