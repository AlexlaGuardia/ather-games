// The build rules: parts only help, the dial only trades, and the DRIVEN car matches the sheet.
// Run: npx tsx src/app/shimmer/open/courser-build.test.ts

import { buildSpec, statBars, STOCK_BUILD, type CourserBuild, type Slot, type Tier } from './courser-build'
import { DARTER_STOCK, tuneFromSpec, createCourser, tickCourser, bodySpeeds } from './courser'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const B = (o: Partial<CourserBuild> = {}): CourserBuild => ({ ...STOCK_BUILD, ...o })
const spec = (o: Partial<CourserBuild> = {}) => buildSpec(DARTER_STOCK, B(o))

// stock build = the stock sheet
{
  const s = spec()
  ok(JSON.stringify(s) === JSON.stringify({ ...DARTER_STOCK }), 'the stock build must BE the stock sheet')
}

// every tier of every part improves its own stat, strictly, and leaves the others alone
{
  const stat: Record<Slot, (s: ReturnType<typeof spec>) => number> = {
    core: s => -s.zeroTo60, trim: s => s.topMph, rune: s => s.grip * s.handling,
  }
  const slots: Slot[] = ['core', 'trim', 'rune']
  for (const slot of slots) {
    for (let t = 1; t <= 3; t++) {
      const lo = spec({ [slot]: (t - 1) as Tier }), hi = spec({ [slot]: t as Tier })
      ok(stat[slot](hi) > stat[slot](lo), `${slot} ${t - 1}→${t} must improve its stat`)
      for (const other of slots.filter(x => x !== slot)) {
        ok(Math.abs(stat[other](hi) - stat[other](lo)) < 1e-9, `${slot} ${t} must not touch ${other}`)
      }
    }
  }
}

// the dial TRADES: speed-side is faster + quicker but grips less; handling-side the reverse; neither wins everything
{
  const fast = spec({ balance: 1 }), mid = spec(), grippy = spec({ balance: -1 })
  ok(fast.topMph > mid.topMph && fast.zeroTo60 < mid.zeroTo60, 'speed-side must be faster and quicker')
  ok(fast.grip * fast.handling < mid.grip * mid.handling, 'speed-side must give up handling')
  ok(grippy.grip * grippy.handling > mid.grip * mid.handling, 'handling-side must handle better')
  ok(grippy.topMph < mid.topMph && grippy.zeroTo60 > mid.zeroTo60, 'handling-side must give up speed')
  // no free lunch: summed bars stay within a whisker of stock at either end of the dial
  const sum = (s: ReturnType<typeof spec>) => { const b = statBars(s); return b.speed + b.accel + b.handling + b.braking }
  ok(Math.abs(sum(fast) - sum(mid)) < 0.8 && Math.abs(sum(grippy) - sum(mid)) < 0.8,
    `the dial must trade, not upgrade (bar sums ${sum(grippy).toFixed(2)} / ${sum(mid).toFixed(2)} / ${sum(fast).toFixed(2)})`)
}

// ★ the DRIVEN car matches the sheet: a maxed, speed-dialled build really is quicker and faster on the road
{
  const drive = (s: ReturnType<typeof spec>) => {
    const tune = tuneFromSpec(s)
    const c = createCourser(0, 0, 0, () => 0)
    let t60 = -1, t = 0
    for (let i = 0; i < 90 * 120; i++) {
      tickCourser(c, { throttle: 1, steer: 0, handbrake: false, dt: 1 / 120 }, () => 0, tune); t += 1 / 120
      if (t60 < 0 && bodySpeeds(c).fwd >= 26.8224) t60 = t
    }
    return { t60, top: bodySpeeds(c).fwd / 0.44704 }
  }
  const maxed = spec({ core: 3, trim: 3, rune: 3, balance: 1 })
  const d = drive(maxed), st = drive(spec())
  ok(Math.abs(d.t60 - maxed.zeroTo60) < 0.2, `maxed build 0-60 drove ${d.t60.toFixed(2)} s vs sheet ${maxed.zeroTo60.toFixed(2)}`)
  ok(Math.abs(d.top - maxed.topMph) < maxed.topMph * 0.03, `maxed build top drove ${d.top.toFixed(1)} vs sheet ${maxed.topMph.toFixed(1)} mph`)
  ok(d.t60 < st.t60 - 1 && d.top > st.top + 25, `maxed must clearly beat stock (${d.t60.toFixed(2)} s / ${d.top.toFixed(0)} mph vs ${st.t60.toFixed(2)} s / ${st.top.toFixed(0)} mph)`)
  console.log(`  stock ${st.t60.toFixed(2)} s · ${st.top.toFixed(0)} mph   maxed+speed ${d.t60.toFixed(2)} s · ${d.top.toFixed(0)} mph`)
}

console.log(`courser-build: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗', f)
process.exit(fails.length ? 1 : 0)
