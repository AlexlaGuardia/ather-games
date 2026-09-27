// The Breach pacing model — a run to round N on paper, from the sim's own formulas.
// Not a replay of play: it answers "if a keeper lands ACC of their rounds, what does each round cost in
// time, mana and salvage, and when can they afford the critical path?" so a real run has numbers to beat.
// Usage: npx tsx scripts/breach-pace.mts [acc=0.6] [rounds=12] [weapon=repeater] [critShare=0.15]
import { HOLD_TUNING as T, roundCount, spawnEvery, kindFor, bodyStats, TUNE_TIERS } from '../src/app/shimmer/play3d/hold'
import { weaponDef } from '../src/app/shimmer/engine/weapons'

const acc = Number(process.argv[2] ?? 0.6)
const rounds = Number(process.argv[3] ?? 12)
const w0 = weaponDef(process.argv[4] ?? 'repeater')!
const critShare = Number(process.argv[5] ?? 0.15)
const CONTACT = 20        // s from a round's first spawn to first contact (hold.test.ts measures 15-28)
// critical path: A → E → M (the break room: the only place to buy hush) → G → B → K (the café, ground zero),
// then plant, then tune ×2. The font (mana) is on the roof deck, open from the start.
const PATH: [string, number][] = [['A', T.gateCost.A], ['E', T.gateCost.E], ['M', T.gateCost.M], ['G', T.gateCost.G], ['B', T.gateCost.B], ['K', T.gateCost.K],
  ['plant', T.devicePlant], ['tune1', T.tuneCost[0]], ['tune2', T.tuneCost[1]]]

let salvage = 0, t = 0, mana = T.manaPool, tier = 0, step = 0, fonts = 0, hush: number = T.hushSec, caches = 0
const buyCaches = process.argv[6] !== 'nocache'
const bought: string[] = []
console.log(`acc ${acc} · ${w0.id} · crit share ${critShare}\n`)
console.log('rnd  bodies  hp-total  shoot-s  round-s  clock    mana-need fonts  +salvage  bank    hush  bought')
for (let r = 1; r <= rounds; r++) {
  const tt = TUNE_TIERS[tier]
  const dmgHit = (w0.damage * (1 - critShare) + w0.crit * critShare) * tt.dmg
  const n = roundCount(r)
  let hp = 0, hits = 0
  for (let i = 0; i < n; i++) { const b = bodyStats(kindFor(r, i), r); hp += b.hp; hits += Math.ceil(b.hp / dmgHit) }
  // pierce 3 at re-keyed: a round through a clump — count it as 1.6 bodies a round, a guess, marked
  if (tt.pierce > 1) hits = Math.ceil(hits / 1.6)
  const shots = hits / acc
  const clips = shots / w0.clip
  const manaNeed = clips * w0.reloadMana * tt.reloadMana
  const shootS = shots * w0.fireCd + clips * w0.reloadTime
  const spawnS = n * spawnEvery(r)
  const roundS = Math.max(spawnS + 6, CONTACT + shootS) + T.breakSec
  // mana: pool + the drip over the round; the rest is fonts
  mana = Math.min(T.manaPool, mana + T.manaDrip * roundS) - manaNeed
  let f = 0
  while (mana < 0) { mana += T.manaPool; f++ }
  const got = hits * T.salvageHit + n * (T.salvageKill * (1 - critShare) + T.salvageCritKill * critShare)
  salvage += got - f * T.fontCost
  fonts += f
  t += roundS
  hush -= roundS
  let dead = false
  // the draught ran dry mid-round: LOUD never ends a round (breaks need a hush), so the run is over
  // unless a cache was bought in time. A keeper tops up BEFORE the round that would run it dry.
  if (hush < 0) dead = true
  const now: string[] = []
  // the draught first: the next round runs up to this one's +40%, top up to cover it (needs the break room open)
  while (buyCaches && bought.includes('M') && !dead && hush < roundS * 1.4 && salvage >= T.cacheCost) { salvage -= T.cacheCost; hush += T.cacheSec; caches++; now.push('cache') }
  // then the path, but never below one cache's worth in the bank once the draught is short
  const reserve = () => (bought.includes('M') && hush < roundS * 1.6 ? T.cacheCost : 0)
  while (!dead && step < PATH.length && salvage - PATH[step][1] >= reserve()) {
    salvage -= PATH[step][1]; now.push(PATH[step][0]); bought.push(PATH[step][0])
    if (PATH[step][0].startsWith('tune')) tier++
    step++
  }
  const clock = `${Math.floor(Math.round(t) / 60)}:${String(Math.round(t) % 60).padStart(2, '0')}`
  console.log(`${String(r).padStart(3)}  ${String(n).padStart(6)}  ${String(hp).padStart(8)}  ${shootS.toFixed(0).padStart(7)}  ${roundS.toFixed(0).padStart(7)}  ${clock.padStart(6)}  ${manaNeed.toFixed(0).padStart(9)}  ${String(f).padStart(4)}  ${got.toFixed(0).padStart(8)}  ${salvage.toFixed(0).padStart(6)}  ${hush.toFixed(0).padStart(4)}  ${now.join(' ')}`)
  if (dead) { console.log(`     LOUD mid-round ${r}: rounds stop advancing — the run ends here`); break }
}
console.log(`\ncaches ${caches} (${caches * T.cacheCost} salvage) · fonts ${fonts} (${fonts * T.fontCost})`)
console.log(`hush = seconds of draught left after the round. Out mid-round = LOUD: no breaks, the round never ends.`)
