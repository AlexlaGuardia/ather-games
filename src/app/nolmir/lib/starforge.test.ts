// NOLMIR economy — the Starforge core. Guards the idle math: production,
// accrual/idempotency, heat + supply-line upkeep, transmute, research, costs,
// and the warp (prestige carry). Run: npx tsx src/app/nolmir/lib/starforge.test.ts
import {
  defaultForge,
  settleForge,
  forgeRate,
  oreRates,
  forgeHeat,
  settleConnections,
  cutConnection,
  upkeepRate,
  transmute,
  transmuteValue,
  doResearch,
  researchCost,
  canResearch,
  researchLevel,
  rigCost,
  conduitCost,
  depthCost,
  beaconCost,
  planetLevelCost,
  genSystem,
  doWarp,
  canWarp,
  revealedRooms,
  nextSystemSeed,
  echoMult,
  forgeMods,
  RESEARCH,
  ORE_VALUE,
  HEAT_SAFE,
  type ForgeState,
} from './starforge'

let pass = 0, fail = 0
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name}`) }
}
const HR = 3600_000
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps

// ── production + accrual ────────────────────────────────────────────────────
{
  const f = defaultForge(0)
  ok('default core rate is 1 corelight/s', near(forgeRate(f), 1))
  ok('settle at t=lastTick banks nothing', settleForge(f, 0).corelight === 0)

  const s10 = settleForge(f, 10_000) // 10s
  ok('10s accrues ~10 corelight', near(s10.corelight, 10, 1e-4))
  ok('settle advances lastTick', s10.lastTick === 10_000)

  // idempotency: settling the SAME now twice must not double-bank
  const twice = settleForge(s10, 10_000)
  ok('re-settle at same now banks nothing (idempotent)', near(twice.corelight, s10.corelight))

  // many tiny settles == one big settle (no leak across visits)
  let cur = f, acc = 0
  for (let s = 1; s <= 60; s++) { const r = settleForge(cur, s * 1000); acc = r.corelight; cur = r }
  ok('60 tiny settles == one 60s settle', near(acc, settleForge(f, 60_000).corelight, 1e-4))

  // offline cap at 48h — a week away banks the same as two days
  const cap = settleForge(f, 48 * HR).corelight
  ok('offline haul caps at 48h', settleForge(f, 168 * HR).corelight === cap)

  ok('corelight is monotonic in time', settleForge(f, 20_000).corelight > s10.corelight)
}

// ── rates scale with upgrades ───────────────────────────────────────────────
{
  const base = defaultForge(0)
  ok('conduit raises the core rate (×1.5)', near(forgeRate({ ...base, conduit: 1 }), 1.5))
  ok('depth raises the core rate (×2.2)', near(forgeRate({ ...base, depth: 1 }), 2.2))
  ok('more rigs, more rate', forgeRate({ ...base, rigs: 3 }) > forgeRate(base))
  ok('echoes sharpen everything', forgeRate({ ...base, echoes: 5 }) > forgeRate(base))
}

// ── planet ore + supply lines ───────────────────────────────────────────────
{
  const f: ForgeState = { ...defaultForge(0), planets: [1, 0, 0, 0, 0, 0, 0, 0] }
  ok('a worked planet ships ore (Cinder → ferrite)', oreRates(f).ferrite > 0)
  ok('locked planets ship nothing', oreRates(defaultForge(0)).ferrite === 0)

  const s = settleForge(f, 10_000)
  ok('10s of Cinder ≈ 5 ferrite (0.5/s)', near(s.stock.ferrite, 5, 1e-4))

  // a cut line ships nothing even though the planet is worked
  const cut: ForgeState = { ...f, connections: [0, 100, 100, 100, 100, 100, 100, 100] }
  ok('a cut supply line ships no ore', oreRates(cut).ferrite === 0)
}

// ── heat + upkeep ───────────────────────────────────────────────────────────
{
  const f = defaultForge(0)
  ok('a quiet forge runs cold (heat 0)', forgeHeat(f) === 0)
  ok('depth burns loud', forgeHeat({ ...f, depth: 3 }) > forgeHeat(f))
  ok('beacon tuning adds heat', forgeHeat({ ...f, beaconTuning: 4 }) > forgeHeat(f))
  ok('below the safe line there is no upkeep', upkeepRate(f) === 0)

  // hot + worked planets → mana drains, never below zero
  const hot: ForgeState = { ...f, depth: 10, planets: [5, 5, 0, 0, 0, 0, 0, 0], connections: f.connections, connTick: 0 }
  ok('a hot forge with worked planets has upkeep', upkeepRate(hot) > 0)
  const drainOk = settleConnections(hot, 1000, 48 * HR)
  ok('upkeep drains mana', drainOk.mana < 1000)
  ok('mana never goes negative', drainOk.mana >= 0)
  ok('draining the same window twice is idempotent', settleConnections(drainOk.forge, drainOk.mana, 48 * HR).drained === 0)

  // no mana to pay → the lines fray
  const starved = settleConnections(hot, 0, 48 * HR)
  ok('unpaid upkeep decays the supply lines', starved.decayed === true)
  ok('a decayed line drops below 100', (starved.forge.connections?.[0] ?? 100) < 100)
}

// ── cut connection (a lost vault severs a line) ─────────────────────────────
{
  const f: ForgeState = { ...defaultForge(0), planets: [1, 1, 0, 0, 0, 0, 0, 0], connections: [100, 100, 100, 100, 100, 100, 100, 100] }
  const r = cutConnection(f, 3)
  const zeroed = (r.forge.connections ?? []).filter((c) => c === 0).length
  ok('a vault loss cuts exactly one worked line', zeroed === 1)
  ok('cutConnection is deterministic by seed', cutConnection(f, 3).planet === cutConnection(f, 3).planet)
}

// ── transmute (ore → corelight) ─────────────────────────────────────────────
{
  const f: ForgeState = { ...defaultForge(0), stock: { ...defaultForge(0).stock, ferrite: 10.7, voidsteel: 3.2 } }
  const expect = Math.floor(10.7) * ORE_VALUE.ferrite + Math.floor(3.2) * ORE_VALUE.voidsteel
  ok('transmute value sells whole units at ore value', transmuteValue(f) === expect)
  const t = transmute(f)
  ok('transmute credits corelight', near(t.corelight, f.corelight + expect))
  ok('transmute keeps the fractional dust', Math.floor(t.stock.ferrite) === 0 && t.stock.ferrite > 0)
}

// ── research (castings → nodes) ─────────────────────────────────────────────
{
  const def = RESEARCH.find((r) => r.id === 'deep-veins')!
  const cost = researchCost(def, 0) // { steelglass: 4 }
  const broke = defaultForge(0)
  ok('cannot research with no castings', canResearch(broke, def) === false)
  ok('doResearch returns null when unaffordable', doResearch(broke, def) === null)

  const rich: ForgeState = { ...broke, castings: { ...broke.castings, steelglass: 10 } }
  ok('can research once the castings are stocked', canResearch(rich, def) === true)
  const done = doResearch(rich, def)!
  ok('research level goes up', researchLevel(done, 'deep-veins') === 1)
  ok('research spends the castings', done.castings.steelglass === 10 - (cost.steelglass ?? 0))
  ok('research cost ramps with level', (researchCost(def, 1).steelglass ?? 0) > (cost.steelglass ?? 0))
  ok('deep-veins actually lifts ore rate', oreRates({ ...done, planets: [1, 0, 0, 0, 0, 0, 0, 0] }).ferrite >
    oreRates({ ...broke, planets: [1, 0, 0, 0, 0, 0, 0, 0] }).ferrite)
}

// ── cost curves are geometric (the idle spine) ──────────────────────────────
{
  const f = defaultForge(0)
  ok('rig cost climbs with rigs', rigCost({ ...f, rigs: 6 }) > rigCost(f))
  ok('conduit cost climbs', conduitCost({ ...f, conduit: 2 }) > conduitCost(f))
  ok('depth cost climbs', depthCost({ ...f, depth: 2 }) > depthCost(f))
  ok('beacon cost climbs', beaconCost({ ...f, beaconTuning: 2 }) > beaconCost(f))
  ok('planet level cost climbs with level', planetLevelCost(f, 0, 4) > planetLevelCost(f, 0, 1))
}

// ── generated systems (warp terrain) ────────────────────────────────────────
{
  ok('a system has 8 planets', genSystem(42).length === 8)
  ok('genSystem is deterministic by seed', genSystem(42)[0].name === genSystem(42)[0].name)
  ok('different seeds give different terrain', JSON.stringify(genSystem(1)) !== JSON.stringify(genSystem(2)))
}

// ── the warp (prestige — sheds heat, carries knowledge) ─────────────────────
{
  const f: ForgeState = {
    ...defaultForge(0),
    depth: 10, corelight: 5000, node: 1, echoes: 0,
    research: { 'hot-conduits': 2 },
    castings: { ...defaultForge(0).castings, steelglass: 9 },
  }
  ok('a hot enough forge can warp', canWarp(f) === true)
  ok('a cold forge cannot warp', canWarp(defaultForge(0)) === false)
  ok('nextSystemSeed is deterministic', nextSystemSeed(f) === nextSystemSeed(f))

  const w = doWarp(f, 1000)
  ok('warp advances the node', w.node === 2)
  ok('warp resets corelight to 0', w.corelight === 0)
  ok('warp sheds heat', forgeHeat(w) < forgeHeat(f))
  ok('warp banks echoes (heat/40)', (w.echoes ?? 0) === Math.floor(forgeHeat(f) / 40))
  ok('an echo sharpens the next node', echoMult(w) > 1)
  ok('warp carries research (knowledge in the hold)', researchLevel(w, 'hot-conduits') === 2)
  ok('warp carries castings', w.castings.steelglass === 9)
}

// ── forgeMods feed the crucible sanely ──────────────────────────────────────
{
  const f = defaultForge(0)
  const m = forgeMods(f)
  ok('base guard hp mult >= 1', m.guardHpMult >= 1)
  ok('base spike dmg mult >= 1', m.spikeDmgMult >= 1)
  ok('plating research lifts guard hp', forgeMods({ ...f, research: { 'guard-lattice': 3 } }).guardHpMult > m.guardHpMult)
}

// ── progressive disclosure: revealedRooms unfolds, never soft-locks ──────────
{
  const fresh = defaultForge(0)
  const r0 = revealedRooms(fresh)
  ok('fresh save shows exactly Orrery + Core', r0.size === 2 && r0.has('orrery') && r0.has('core'))
  ok('fresh save hides Refinery/Armory/Gate', !r0.has('refinery') && !r0.has('armory') && !r0.has('gate'))

  const one = { ...fresh, planets: [1, 0, 0, 0, 0, 0, 0, 0] }
  ok('first planet unfolds the Refinery', revealedRooms(one).has('refinery'))
  ok('one planet is not yet the Armory', !revealedRooms(one).has('armory'))

  const two = { ...fresh, planets: [1, 1, 0, 0, 0, 0, 0, 0] }
  ok('second planet unfolds the Armory', revealedRooms(two).has('armory'))

  // mana-bought armory investment reveals it even at one planet (never hide what you own)
  ok('guard investment unfolds the Armory early', revealedRooms({ ...one, guardPlating: 1 }).has('armory'))

  // the Gate stays noise until the ship can actually warp
  ok('Gate hidden below warp heat', !revealedRooms(fresh).has('gate'))
  const hot = { ...fresh, depth: 20, beaconTuning: 20 }
  ok('warp-ready forge reveals the Gate', canWarp(hot) === revealedRooms(hot).has('gate') && revealedRooms(hot).has('gate'))

  // monotonic across the warp: node 2 resets planets to 0 but keeps the full deck
  const veteran = { ...fresh, node: 2, planets: [0, 0, 0, 0, 0, 0, 0, 0] }
  const rv = revealedRooms(veteran)
  ok('a veteran (node>1) keeps all five rooms after warp', rv.size === 5)
}

console.log(`\nSTARFORGE economy: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
