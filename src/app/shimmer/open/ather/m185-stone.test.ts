// M185 s3: STONE IN CHAINS (Alex 11-26: "stone nodes apear near the other nodes like chains so a player can find groups of
// nodes"). prospecting.ts › stoneChain / STONE_DIAL / minePlan, wilds.ts places them. Run: npx tsx src/app/shimmer/open/ather/m185-stone.test.ts
import { readFileSync, existsSync } from 'fs'
import { parseWilds, type WildsMeta } from './wilds'
import { stoneChain, idRoll, STONE_CHAIN, STONE_BLANKS, minePlan, mine, isMined, crystalDial, crystalFor, TIER, CRYSTAL_NAME, CRYSTAL_ITEM, BLANKSTONE, _resetProspecting, type CrystalKind } from './prospecting'
import { STONE_DIAL } from './gather-dials'
import { _resetForestry, type Zone } from './forestry'
import { NODE_CRYSTALS } from './glade-nodes'
import { SCENERY } from './scenery'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
let seed = 7; const rng = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296 }

// ── the chain itself (pure) ──────────────────────────────────────────────────────────────────────────────────
let have = 0
const N = 4000
for (let i = 0; i < N; i++) {
  const id = `t${i % 7}:c${i}`, ch = stoneChain(idRoll(id))
  ok(JSON.stringify(ch) === JSON.stringify(stoneChain(idRoll(id))), `${id}: chain not deterministic`)
  if (!ch.length) continue
  have++
  ok(ch.length >= STONE_CHAIN.min && ch.length <= STONE_CHAIN.max, `${id}: chain of ${ch.length}`)
  ok(Math.abs(Math.hypot(ch[0].dx, ch[0].dz) - STONE_CHAIN.first) < 1e-9, `${id}: first stone ${Math.hypot(ch[0].dx, ch[0].dz)} m off the node`)
  for (let k = 1; k < ch.length; k++) {
    const d = Math.hypot(ch[k].dx - ch[k - 1].dx, ch[k].dz - ch[k - 1].dz)
    ok(d >= STONE_CHAIN.step[0] - 1e-9 && d <= STONE_CHAIN.step[1] + 1e-9, `${id}: step ${k} is ${d} m`)
  }
}
ok(Math.abs(have / N - STONE_CHAIN.p) < 0.03, `share of nodes with a chain ${have / N} (want ~${STONE_CHAIN.p})`)
// a blocked step bends round: wall off everything east of the node, the chain still walks (west) and never through the wall
{ let full = 0, through = 0, cnt = 0
  for (let i = 0; i < 400; i++) {
    const r = idRoll(`w:c${i}`), all = stoneChain(r), ch = stoneChain(r, dx => dx < -0.5)
    if (!all.length) continue
    cnt++; if (ch.length === all.length) full++
    if (ch.some(p => p.dx >= -0.5)) through++
    ok(ch.every((p, k) => k === 0 || p.k > ch[k - 1].k), 'stone index k not increasing')
  }
  ok(through === 0 && full / cnt > 0.6, `walled chains: ${full} of ${cnt} kept every stone, ${through} through the wall`) }
ok(new Set(Array.from({ length: 50 }, (_, i) => stoneChain(idRoll(`x:c${i}`)).length)).size > 1, 'every chain the same length')

// ── what a stone is and pays ─────────────────────────────────────────────────────────────────────────────────
ok(CRYSTAL_NAME.stone === 'Stone' && CRYSTAL_ITEM.stone === BLANKSTONE && TIER.stone === 1, 'stone name / item / grade')
ok(crystalDial('stone') === STONE_DIAL && STONE_DIAL.need === 1, 'stone: its own dial, any spike')
for (let i = 0; i < 300; i++) {
  const p = minePlan('stone', rng)
  const bl = p.drops.find(d => d.id === BLANKSTONE)?.n ?? 0
  ok(bl >= STONE_BLANKS[0] && bl <= STONE_BLANKS[1] + 1, `stone gave ${bl} blankstone`)
  ok(p.found === 'stone' && !p.drops.some(d => /shard|crystal|core/.test(d.id)), `stone gave ${JSON.stringify(p.drops)}`)
}
_resetForestry(); _resetProspecting()
const v = mine('stone', 'test:c1s0', rng, 1_000_000)
ok(v.ok && isMined('test:c1s0', 1_000_000 + 1000) && !isMined('test:c1s0', 1_000_000 + STONE_DIAL.respawnMs + 1), 'a worked stone grows back on its dial')
// stone is the Wilds' own (no placed model): not in the glade's keeper nodes nor the scenery palette; never rolled as a crystal
ok(!(NODE_CRYSTALS as string[]).includes('stone') && !SCENERY.some(s => s.k === 'crystal:stone'), 'stone leaked into glade nodes / scenery')
{ let s = false; for (const z of ['meadows', 'springs', 'arid', 'caverns', 'trails', 'thicket'] as Zone[]) for (const b of [1, 2, 3, 4]) for (let r = 0; r < 1; r += 0.01) if (crystalFor(z, b, r)?.kind === 'stone') s = true
  ok(!s, 'crystalFor rolls a lone stone (stones only come in chains)') }

// ── on the real continent ────────────────────────────────────────────────────────────────────────────────────
const D = 'public/open/wilds/'
const index = JSON.parse(readFileSync(D + 'tiles.json', 'utf8')) as { tiles: { name: string; nodes: { i: number; j: number; zone?: Zone }[] }[] }
let stones = 0, lonely = 0, chains = 0, longChains = 0, wet = 0, close = 0, thicket = 0, maxTile = 0
for (const t of index.tiles) {
  if (!existsSync(D + t.name + '.bin')) continue
  const meta = JSON.parse(readFileSync(D + t.name + '.json', 'utf8')) as WildsMeta
  const b = readFileSync(D + t.name + '.bin'), bio = readFileSync(D + t.name + '.biome')
  const zm = new Map(t.nodes.map(n => [`${n.i},${n.j}`, n.zone ?? 'meadows']))
  const W = parseWilds(meta, new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), new Uint8Array(bio), (i, j) => (zm.get(`${i},${j}`) ?? 'meadows') as Zone)
  const byId = new Map(W.crystals.map(c => [c.id, c]))
  const st = W.crystals.filter(c => c.kind === 'stone')
  stones += st.length; maxTile = Math.max(maxTile, st.length)
  const per = new Map<string, number>()
  for (const s of st) {
    const m = /^(.*)s(\d+)$/.exec(s.id), parent = m && byId.get(m[1])
    ok(!!parent && parent.kind !== 'stone', `${s.id}: no node it chains off`)
    if (!parent) continue
    per.set(parent.id, (per.get(parent.id) ?? 0) + 1)
    ok(Math.hypot(s.x - parent.x, s.z - parent.z) <= STONE_CHAIN.first + (STONE_CHAIN.max - 1) * STONE_CHAIN.step[1] + 1e-6, `${s.id}: too far from its node`)
    // a chain: the nearest other node (stone or crystal) is within one step
    const nn = Math.min(...W.crystals.filter(c => c !== s && Math.abs(c.x - s.x) < 5 && Math.abs(c.z - s.z) < 5).map(c => Math.hypot(c.x - s.x, c.z - s.z)), Infinity)
    if (nn > STONE_CHAIN.step[1] + 0.01) lonely++
    if (nn < 1.6) close++
    if (s.y < meta.waterY + 0.4) wet++
    if (W.trees.some(tr => Math.abs(tr.x - s.x) < 1.8 && Math.abs(tr.z - s.z) < 1.8)) close++
    const zone = zm.get(`${Math.min(4, Math.floor((s.x + 500) / 200))},${Math.min(4, Math.floor((s.z + 500) / 200))}`) ?? 'meadows'
    if (zone === 'thicket') thicket++
  }
  for (const n of per.values()) { chains++; if (n >= STONE_CHAIN.min) longChains++ }
  ok(new Set(W.crystals.map(c => c.id)).size === W.crystals.length, `${t.name}: duplicate node ids`)
}
console.log(`  ${stones} stones in ${chains} chains (${longChains} of ${STONE_CHAIN.min}+), max ${maxTile} on one tile, ${lonely} with no node within ${STONE_CHAIN.step[1]} m`)
ok(stones > 1500 && maxTile < 500, `stone count ${stones}, busiest tile ${maxTile}`)
ok(longChains / chains > 0.6, `only ${longChains} of ${chains} chains are ${STONE_CHAIN.min}+ long (groups, not one-offs)`)
ok(lonely / stones < 0.05, `${lonely} of ${stones} stones stand alone`)
ok(wet === 0 && close === 0 && thicket === 0, `stones in water ${wet}, on a node or trunk ${close}, in the Thicket ${thicket}`)

console.log(`m185-stone: ${pass} pass, ${fails.length} FAIL`)
if (fails.length) { for (const f of fails.slice(0, 20)) console.log('  ✗ ' + f); process.exit(1) }
