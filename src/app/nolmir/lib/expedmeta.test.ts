// EXPEDITIONS garrison idle — run with: npx tsx src/app/nolmir/lib/expedmeta.test.ts
import {
  defaultExpedMeta,
  garrisonRatePerHour,
  garrisonPending,
  settleGarrison,
  GARRISON_CAP_MS,
  type ExpedMeta,
  type TierRecord,
} from './expedmeta'

let pass = 0, fail = 0
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name}`) }
}
const HR = 3600_000
const rec = (tier: number, wave: number): TierRecord => ({ tier, wave, roster: [], doctrine: '', at: 0 })
const withRecords = (...rs: TierRecord[]): ExpedMeta => ({ ...defaultExpedMeta(), records: rs })

// 1. rate scales with progress; zero with no cleared breaches
{
  ok('no records → rate 0', garrisonRatePerHour(defaultExpedMeta()) === 0)
  const r1 = garrisonRatePerHour(withRecords(rec(1, 12)))
  ok('tier1 wv12 → positive rate', r1 > 0)
  const r2 = garrisonRatePerHour(withRecords(rec(1, 12), rec(2, 12)))
  ok('adding a deeper tier raises the rate', r2 > r1)
  ok('deeper wave pays more', garrisonRatePerHour(withRecords(rec(1, 20))) > garrisonRatePerHour(withRecords(rec(1, 10))))
  // calibration: a full 48h haul on a modest board ≈ one solid run (a few hundred marks)
  const haul48 = garrisonPending({ ...withRecords(rec(1, 12)), garrisonTick: 0 }, GARRISON_CAP_MS).marks
  ok('48h haul is a nudge, not a grind (100–600 marks on tier1 wv12)', haul48 >= 100 && haul48 <= 600)
}

// 2. first settle just arms the clock — no retroactive windfall
{
  const m = withRecords(rec(1, 12))
  const r = settleGarrison(m, 1_000_000)
  ok('first settle banks 0', r.marks === 0)
  ok('first settle arms garrisonTick', r.meta.garrisonTick === 1_000_000)
}

// 3. accrues over time; immediate re-settle banks ~0 (idempotent)
{
  const armed: ExpedMeta = { ...withRecords(rec(1, 12), rec(2, 8)), garrisonTick: 0 }
  const rate = garrisonRatePerHour(armed)
  const r = settleGarrison(armed, 10 * HR)
  ok('10h banks ≈ 10×rate', Math.abs(r.marks - Math.floor(rate * 10)) <= 1)
  const again = settleGarrison(r.meta, 10 * HR)
  ok('immediate re-settle banks 0', again.marks === 0)
}

// 4. the sub-mark remainder is not lost across short visits
{
  const armed: ExpedMeta = { ...withRecords(rec(1, 12)), garrisonTick: 0 }
  // one big settle vs many tiny settles over the same span should agree (±1)
  const big = settleGarrison(armed, 24 * HR).marks
  let acc = 0
  let cur = armed
  for (let h = 1; h <= 24; h++) { const r = settleGarrison(cur, h * HR); acc += r.marks; cur = r.meta }
  ok('tiny settles sum to the big settle (no leak)', Math.abs(acc - big) <= 1)
}

// 5. cap at 48h — beyond that, overflow is discarded
{
  const armed: ExpedMeta = { ...withRecords(rec(1, 12)), garrisonTick: 0 }
  const at48 = settleGarrison(armed, GARRISON_CAP_MS).marks
  const at100 = settleGarrison(armed, 100 * HR).marks
  ok('haul caps at 48h', at100 === at48)
  const past = settleGarrison(armed, 100 * HR)
  ok('past-cap settle resets tick to now (overflow discarded)', past.meta.garrisonTick === 100 * HR)
}

// 6. preview matches the settle
{
  const armed: ExpedMeta = { ...withRecords(rec(1, 12), rec(3, 6)), garrisonTick: 0 }
  ok('garrisonPending marks == settleGarrison marks', garrisonPending(armed, 7 * HR).marks === settleGarrison(armed, 7 * HR).marks)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
