// BOUND autoplay oracle — a look-ahead bot that jumps for gaps / ledges / hazards, to prove courses
// are clearable with skill and the difficulty curve is fair. Run: npx tsx src/app/bound/lib/bound.oracle.ts
import { makeWorld, tick, pressJump, releaseJump, speedAt, STEP_UP, FOE_W, type World } from './bound'

function botRun(seed: number, maxT = 90): { dist: number; cause: string; t: number } {
  const w = makeWorld(seed); pressJump(w)
  let holding = false, releaseX = -Infinity
  const dt = 1 / 60
  let t = 0
  while (w.state === 'playing' && t < maxT) {
    const dist = w.dist
    const speed = speedAt(dist)
    const cur = w.segs.find(s => dist >= s.x0 && dist <= s.x1)
    const next = w.segs.filter(s => s.x0 > dist).sort((a, b) => a.x0 - b.x0)[0]
    // candidate obstacles ahead
    const targets: { x: number; clearX: number; kind: 'gap' | 'haz'; high: boolean }[] = []
    if (cur && next && next.x0 > cur.x1 + 1) {
      targets.push({ x: cur.x1, clearX: next.x0 + 4, kind: 'gap', high: next.top < cur.top - STEP_UP })
    }
    const haz = [...w.foes.filter(f => !f.dead && f.x > dist), ...w.spikes.filter(s => s.x > dist)]
      .map(o => o.x).sort((a, b) => a - b)[0]
    if (haz != null) targets.push({ x: haz, clearX: haz + FOE_W + 18, kind: 'haz', high: false })
    targets.sort((a, b) => a.x - b.x)
    const tg = targets[0]

    if (w.grounded || w.coyote > 0) {
      // jump just before the obstacle edge; a hair earlier for gaps that need height
      const lead = Math.max(8, speed * (tg?.high ? 0.06 : 0.04))
      if (tg && tg.x - dist <= lead) {
        pressJump(w); holding = true; releaseX = tg.clearX + (tg.high ? 45 : 0)
      }
    } else if (holding) {
      // gaps/high ledges: hold the full arc until past the landing. small hazards: short hop (release at apex).
      const tgIsHaz = tg && tg.kind === 'haz'
      if (dist > releaseX || (tgIsHaz && w.vy > 0)) { releaseJump(w); holding = false }
    }
    tick(w, dt); t += dt
  }
  const cause = w.state === 'dead' ? (w.events.find(e => e.type === 'death') as any)?.cause ?? 'unknown'
    : (t >= maxT ? 'survived-cap' : 'unknown')
  return { dist: Math.round(w.dist), cause, t: Math.round(t * 10) / 10 }
}

const N = 300
const dists: number[] = []
const causes: Record<string, number> = {}
for (let s = 1; s <= N; s++) {
  const r = botRun(s)
  dists.push(r.dist)
  causes[r.cause] = (causes[r.cause] || 0) + 1
}
dists.sort((a, b) => a - b)
const median = dists[Math.floor(N / 2)]
const mean = Math.round(dists.reduce((a, b) => a + b, 0) / N)
const p10 = dists[Math.floor(N * 0.1)], p90 = dists[Math.floor(N * 0.9)]
const earlyDeaths = dists.filter(d => d < 950).length // died on/just after the runway = unfair pocket
console.log(`\nBOUND oracle — ${N} seeds, competent look-ahead bot`)
console.log(`survival dist:  p10=${p10}  median=${median}  mean=${mean}  p90=${p90}  max=${dists[N - 1]}`)
console.log(`death causes:`, causes)
console.log(`early deaths (<950, ~runway): ${earlyDeaths} (${(earlyDeaths / N * 100).toFixed(1)}%)  ← want ~0 (fair start)`)
