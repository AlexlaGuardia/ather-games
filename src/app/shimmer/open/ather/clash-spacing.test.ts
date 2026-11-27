// BETA M233 v2d SPACING (Alex 11-27 watching: "each spirit should stay 4-5 meters from the opponent" between actions, closing
// only to strike). Measures the engine itself (clash-fight.ts holdMeter) over every species pair at both open tent levels.
// Run: npx tsx src/app/shimmer/open/ather/clash-spacing.test.ts
import { createFight, step, tentEntrant, holdMeter, holdOf, HOLD, MELEE, CLOSE_SLACK, KIND, type FightEvent } from './clash-fight'
import { CLASH_SPECIES } from './fair-clash'
import { ELEMENTS, type Element } from '../../spirits/spirit'
import type { ClashTier } from './fair-clash-rules'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const q = (a: number[], p: number) => { const g = [...a].sort((x, y) => x - y); return g[Math.min(g.length - 1, Math.floor(g.length * p))] }

// the hold is her kind's range clamped into 4-5 m
ok(HOLD.min === 4 && HOLD.max === 5, 'HOLD is 4-5 m')
for (const sp of CLASH_SPECIES) { const h = holdOf(KIND[sp].pref); ok(h >= 4 && h <= 5, `${sp} holds ${h} m`) }

for (const tier of ['easy', 'average'] as ClashTier[]) {
  const all: number[] = [], strikeD: number[] = []
  let fights = 0, lunges = 0, seed = tier === 'easy' ? 11 : 5011
  for (const a of CLASH_SPECIES) for (const b of CLASH_SPECIES) {
    if (a === b) continue
    for (let i = 0; i < 2; i++) {
      seed++
      const el = (sp: string): Element => (tier === 'easy' ? 'base' : ELEMENTS.filter(e => e !== 'base')[(seed + sp.length) % (ELEMENTS.length - 1)] as Element)
      const s = createFight(tentEntrant(a, el(a), tier), tentEntrant(b, el(b), tier), seed)
      const m = holdMeter()
      while (!s.over) {
        const l = step(s); m.tick(s)
        for (const e of l.ev as FightEvent[]) if (e.kind === 'start' && e.move === 'melee') { lunges++; strikeD.push(Math.hypot(s.f[0].x - s.f[1].x, s.f[0].z - s.f[1].z)) }
      }
      fights++; all.push(...m.gaps)
    }
  }
  const med = q(all, 0.5), p10 = q(all, 0.1), p90 = q(all, 0.9)
  console.log(`${tier}: ${fights} fights, ${all.length} held ticks, gap median ${med.toFixed(2)} p10 ${p10.toFixed(2)} p90 ${p90.toFixed(2)} m; melee starts ${lunges}, at median ${q(strikeD, 0.5).toFixed(2)} m`)
  ok(all.length > fights * 20, `${tier}: they hold between actions (${all.length} held ticks)`)
  ok(med >= HOLD.min && med <= HOLD.max, `${tier}: held gap median ${med.toFixed(2)} in 4-5 m`)
  ok(p10 >= HOLD.min - 0.2, `${tier}: held gap p10 ${p10.toFixed(2)} >= 3.8 m (not crowding)`)
  ok(p90 <= HOLD.max + 0.6, `${tier}: held gap p90 ${p90.toFixed(2)} <= 5.6 m`)
  // closing only to strike: a melee starts inside its reach (she lunged in)
  ok(lunges > fights, `${tier}: melee is still thrown (${lunges})`)
  ok(q(strikeD, 0.9) <= MELEE.range + CLOSE_SLACK, `${tier}: melee starts within reach (p90 ${q(strikeD, 0.9).toFixed(2)} m)`)
}

console.log(`clash-spacing.test: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  FAIL', f)
if (fails.length) process.exit(1)
