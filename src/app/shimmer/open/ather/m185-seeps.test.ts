// Run: npx tsx src/app/shimmer/open/ather/m185-seeps.test.ts
// BETA M185 s2 (RULED athernyx c73ab4e; glossary 'Mana seep', world/ather.md › MANA SEEPS): mana seeps out of a gap in the
// ground, pools and crystallises into raw mana shards; small / medium / large by the leak (bigger = more shards, rarer). Named
// 'mana seep', never a spring or a well. Worked with the spike; resets like the other nodes. The four gem nodes do not move.
import { readFileSync, existsSync } from 'node:fs'
const mem = new Map<string, string>()
;(globalThis as unknown as { localStorage: unknown }).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) }
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const main = async () => {
  const P = await import('./prospecting')
  const { verdictOf, crystalRows } = await import('./tool-panel')
  const { rungOf } = await import('./focuses')
  const { SEEP_DIAL } = await import('./gather-dials')
  const S = P.SEEPS

  // 1. the ruled name, read against the canon file (the glossary row), never spring / well
  const gl = '/root/athernyx/CANON/glossary.md'
  if (existsSync(gl)) ok(/\|\s*\*\*Mana seep\*\*\s*\|[^|]*small \/ medium \/ large/.test(readFileSync(gl, 'utf8')), 'canon glossary has no Mana seep row with small / medium / large')
  ok(S.map(k => P.CRYSTAL_NAME[k]).join() === 'Small Mana Seep,Medium Mana Seep,Large Mana Seep', `names ${S.map(k => P.CRYSTAL_NAME[k])}`)
  ok(!S.some(k => /spring|well/i.test(P.CRYSTAL_NAME[k])), 'a seep is named a spring or a well')

  // 2. placement: where a raw node stood, a seep pools; every size turns up; bigger is rarer; the gems' rolls are untouched
  const zones = ['meadows', 'springs', 'arid', 'caverns', 'trails'] as const
  const ROCK = 4, N = 20000
  for (const z of zones) {
    const n: Record<string, number> = {}
    for (let i = 0; i < N; i++) { const c = P.crystalFor(z, ROCK, (i + 0.5) / N); if (c) n[c.kind] = (n[c.kind] ?? 0) + 1 }
    ok(!n.raw, `${z}: a raw node still stands in the Wilds (${n.raw})`)
    ok(S.every(k => (n[k] ?? 0) > 0), `${z}: not every seep size turns up ${JSON.stringify(n)}`)
    ok(n.seep_s > n.seep_m && n.seep_m > n.seep_l, `${z}: bigger is not rarer ${JSON.stringify(n)}`)
  }
  ok(P.crystalFor('thicket', ROCK, 0.9) === null, 'the Thicket stays stoneless')
  // the s1 gem / core / ather bands sit where they did (rolls below each zone's raw band)
  const keep: [typeof zones[number], number, string][] = [['meadows', 0.1, 'violet'], ['springs', 0.03, 'pure'], ['springs', 0.3, 'water'], ['arid', 0.2, 'storm'], ['caverns', 0.01, 'ather'], ['caverns', 0.3, 'earth'], ['trails', 0.3, 'egg']]
  for (const [z, r, k] of keep) ok(P.crystalFor(z, ROCK, r)?.kind === k, `${z} @${r}: ${P.crystalFor(z, ROCK, r)?.kind}, want ${k}`)
  ok(P.crystalFor('springs', 1, 0.9)?.kind.startsWith('seep_') === true && P.crystalFor('springs', 1, 0.9)!.p === 0.02, 'the springs\' shore stones carry seeps at their old chance')

  // 3. gathering: raw mana shards only, more from a bigger seep
  for (const k of S) {
    const [lo, hi] = P.SEEP_SHARDS[k]
    for (const r of [0, 0.5, 0.999]) {
      const d = P.minePlan(k, () => r).drops
      const sh = d.find(x => x.id === 'raw_mana_shard')
      ok(!!sh && sh.n >= lo && sh.n <= hi + 1, `${k} @${r}: shards ${JSON.stringify(d)}`)
      ok(!d.some(x => x.id === P.BLANKSTONE), `${k}: a seep paid blankstone`)
    }
    ok(P.minePlan(k, () => 0).drops[0].n === lo && P.minePlan(k, () => 0.999).drops[0].n === hi, `${k}: roll range ${lo}-${hi}`)
  }
  ok(P.SEEP_SHARDS.seep_s[1] < P.SEEP_SHARDS.seep_l[0] && P.SEEP_SHARDS.seep_m[1] <= P.SEEP_SHARDS.seep_l[0], 'a large seep does not beat the small / medium ones')

  // 4. the spike: the Goldwood spike works all three at their own mana; the worn spike the small + medium, the large slowly
  const goldwood = rungOf({ toolId: 'goldwood_spike', usesRemaining: 10 }), worn = rungOf(undefined as never)
  for (const k of S) ok(P.crystalDial(k) === SEEP_DIAL[k] && verdictOf(P.crystalDial(k), goldwood) === 'ok', `${k}: Goldwood verdict ${verdictOf(P.crystalDial(k), goldwood)}`)
  ok(verdictOf(SEEP_DIAL.seep_s, worn) === 'ok' && verdictOf(SEEP_DIAL.seep_m, worn) === 'ok' && verdictOf(SEEP_DIAL.seep_l, worn) === 'slow', 'worn spike: small + medium ok, large slow')

  // 5. the reset: a worked seep is spent for its own reset, then back (bigger leak = longer)
  ok(SEEP_DIAL.seep_s.respawnMs < SEEP_DIAL.seep_m.respawnMs && SEEP_DIAL.seep_m.respawnMs < SEEP_DIAL.seep_l.respawnMs, 'resets grow with the leak')
  P._resetProspecting()
  const t0 = 1_800_000_000_000
  for (const k of S) {
    const id = `T:${k}`
    ok(P.mineCheck(k, id, t0).ok, `${k}: fresh is not workable`)
    P.mineCommit(k, id, t0)
    const v = P.mineCheck(k, id, t0 + 1000)
    ok(!v.ok && /Mana Seep, growing back/.test(v.why), `${k}: worked, says ${JSON.stringify(v)}`)
    ok(P.isMined(id, t0 + SEEP_DIAL[k].respawnMs - 1) && !P.isMined(id, t0 + SEEP_DIAL[k].respawnMs), `${k}: reset is not its dial's`)
  }
  // the s1 kinds keep their reset (mineCommit now reads the dial: same numbers)
  ok(P.crystalDial('raw').respawnMs === P.RESPAWN_MS[1] && P.crystalDial('water').respawnMs === P.RESPAWN_MS[2] && P.crystalDial('ather').respawnMs === P.RESPAWN_MS[4], 'an s1 reset moved')

  // 6. the tool panel lists the three sizes after Raw Mana, before the gems
  const rows = crystalRows(goldwood).map(r => r.name)
  ok(rows.slice(0, 4).join() === 'Raw Mana,Small Mana Seep,Medium Mana Seep,Large Mana Seep', `panel rows ${rows}`)
  ok(rows.slice(4).join() === 'Aqual,Dinloid,Fuli,Rhyloid,Pure Mana Core,Ather Crystal', `panel gems moved ${rows}`)
  ok(crystalRows(goldwood).find(r => r.name === 'Large Mana Seep')!.drops.startsWith('Raw Mana Shard 4-7'), 'large seep drops line')

  // 7. a seep is the Wilds' only: no placed scenery / keeper node of one (no model yet)
  const { SCENERY } = await import('./scenery').catch(() => ({ SCENERY: null as unknown as { k: string }[] }))
  if (Array.isArray(SCENERY)) ok(!SCENERY.some(s => /seep/.test(s.k)), 'a seep turned up in the scenery catalog')
  const { NODE_CRYSTALS } = await import('./glade-nodes')
  ok(!NODE_CRYSTALS.some(k => k.startsWith('seep')), 'a seep turned up as a glade keeper node')

  console.log(`m185-seeps: ${pass} pass, ${fails.length} fail`)
  for (const f of fails) console.log(`  ✗ ${f}`)
  process.exit(fails.length ? 1 : 0)
}
main()
