// BETA M17: BLADES + SPIKES. On the live Ather page with real E: the Carpentry bench makes a Goldwood Blade, the Stonery's bench a
// Mana Spike (both equipped, open.tools.v1). In the Wilds, a tier-2 Shimmeroak's prompt costs DOUBLE with the Worn Blade and its
// own cost with the Goldwood Blade (reach 2); pruning it pays the blade's xpBonus on top of the tree's XP and wears the blade one
// use; a blade on its last use wears out and the Worn Blade is back. SETUP (stated, not played): the two rooms stand raised, the
// bag holds the recipes, Forestry is level 4 (the Shimmeroak gate).
//   npx tsx scripts/focuses-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { readFileSync, mkdirSync } from 'fs'
import { parseWilds, type WildsMeta } from '../src/app/shimmer/open/ather/wilds'
import { type Zone } from '../src/app/shimmer/open/ather/forestry'
import { benchOf, type Room } from '../src/app/shimmer/open/ather/rooms'
import { NODE_DEFS } from '../src/app/shimmer/world/resources'
import { MANA_COST } from '../src/app/shimmer/open/ather/forestry'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/focuses')
mkdirSync(out, { recursive: true })
const D = 'public/open/wilds/', idx = JSON.parse(readFileSync(D + 'tiles.json', 'utf8'))
const zm = new Map<string, Zone>(idx.tiles.find((t: { name: string }) => t.name === 'first-wilds').nodes.map((n: { i: number; j: number; zone: Zone }) => [`${n.i},${n.j}`, n.zone]))
const b = readFileSync(D + 'first-wilds.bin'), bio = readFileSync(D + 'first-wilds.biome')
const W = parseWilds(JSON.parse(readFileSync(D + 'first-wilds.json', 'utf8')) as WildsMeta, new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), new Uint8Array(bio), (i, j) => zm.get(`${i},${j}`) ?? 'meadows')
// a tree with a clear line on its east side (channel-check's rule), so standing 6 m east puts the crosshair on it
const lone = (k: string, skip: string[] = []) => W.trees.find(t => t.kind === k && !skip.includes(t.id) && !W.trees.some(o => o !== t && (Math.hypot(o.x - t.x, o.z - t.z) < 3 || (o.x > t.x && o.x < t.x + 15 && Math.abs(o.z - t.z) < 3))) && Math.abs(t.x) < 400 && Math.abs(t.z) < 400)!
const oak = lone('shimmeroak'), oak2 = lone('shimmeroak', [oak.id])
const carp: Room = { id: 'carpentry-fc', kind: 'carpentry', x: -100, z: 100, q: 0, placedAt: 0, doneAt: 0, store: [] }
const mason: Room = { id: 'stonemason-fc', kind: 'stonemason', x: -112, z: 100, q: 0, placedAt: 0, doneAt: 0, store: [] }
const res: Record<string, unknown> = { url, oak: oak?.id, oak2: oak2?.id }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const p = await br.newPage(); await p.setViewport({ width: 1100, height: 680 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument((rooms: Room[]) => {
  if (sessionStorage.getItem('fc')) return; sessionStorage.setItem('fc', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  const slots: unknown[] = Array(32).fill(null)
  slots[8] = { id: 'goldwood_plank', n: 5 }; slots[9] = { id: 'goldwood_bark', n: 3 }; slots[10] = { id: 'raw_mana_shard', n: 8 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms, chests: [], pieces: [] }))
  localStorage.setItem('open.skills.v1', JSON.stringify([{ id: 'forestry', level: 4, xp: 0 }, { id: 'prospecting', level: 4, xp: 0 }]))
  localStorage.removeItem('open.tools.v1'); localStorage.removeItem('open.pruned.v1')
}, [carp, mason])
const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const tools = () => p.evaluate(() => (window as any).__ather.tools())
const frame = async () => { try { await p.screenshot({ path: `${out}/_f.png` }) } catch { /* slow frame */ } }
const tp = async (x: number, z: number, yaw: number) => { await p.evaluate((a, b2, c) => (window as any).__ather.tp(a, b2, c), x, z, yaw); await sleep(1500); await frame(); await frame() }
const click = (sel: string) => p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return false; e.click(); return true }, sel)
const bodyText = () => p.evaluate(() => document.body.innerText)
await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500)
// 1. the benches: Carpentry → Goldwood Blade, Stonery → Mana Spike (real E at each bench)
const bench = async (r: Room, focus: string) => {
  const at = benchOf(r); await tp(at.x, at.z - 1.2, 0)
  await aimAt(p, at.x, at.z, 0.6)
  await p.keyboard.press('e'); await sleep(1000)
  const panel = await p.evaluate(() => !!document.querySelector('[data-panel="bench"]'))
  await click('[data-bench-tab="blades"],[data-bench-tab="spikes"]'); await sleep(300)   // bench tabs (11-20): tool focuses on their own tab
  const made = await click(`[data-focus="${focus}"] button`); await sleep(800)
  await p.keyboard.press('Escape'); await sleep(500)
  return { panel, made }
}
res.carpentry = await bench(carp, 'goldwood_blade')
res.stonery = await bench(mason, 'mana_spike')
const t1 = await tools(); res.toolsMade = { forestry: t1.forestry, prospecting: t1.prospecting }
res.bagAfter = (((await read('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]).filter(Boolean).map(s => `${s!.id}x${s!.n}`)
// 2. the Wilds: the Shimmeroak's prompt with the blade, then with the Worn Blade (a re-load of the tools record)
await p.evaluate(() => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } }))
await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds', { timeout: 120000 }); await sleep(6000)
const promptMana = async (t: { x: number; z: number }) => {
  await tp(t.x + 6, t.z, Math.PI / 2)
  for (let i = 0; i < 10; i++) { const m = (await bodyText()).match(/prune the Shimmeroak \((\d+) mana\)/); if (m) return Number(m[1]); await frame(); await sleep(400) }
  return -1
}
res.manaBlade = await promptMana(oak)
const blade = t1.forestry
await p.evaluate(() => { localStorage.removeItem('open.tools.v1'); window.dispatchEvent(new Event('open:tools')) }); await sleep(800)
res.manaWorn = await promptMana(oak)
await p.evaluate((bl: unknown) => { const t = JSON.parse(localStorage.getItem('open.tools.v1') ?? '{}'); localStorage.setItem('open.tools.v1', JSON.stringify({ ...t, forestry: bl })); window.dispatchEvent(new Event('open:tools')) }, blade); await sleep(800)
// 3. prune it with the blade: XP = the tree's + the blade's bonus, and one use worn
const chan = () => p.evaluate(() => (window as any).__ather.chan?.() ?? null)
const pruneOut = async (t: { x: number; z: number }) => {
  await tp(t.x + 6, t.z, Math.PI / 2); await p.evaluate(() => (window as any).__ather.setMana(100))
  await p.evaluate(() => (window as any).__ather.prune()); await sleep(500)
  for (let i = 0; i < 160 && await chan(); i++) { await p.evaluate(() => (window as any).__ather.setMana(100)); await frame() }
  await sleep(800)
}
await pruneOut(oak)
const base = NODE_DEFS.shimmeroak.xp, want = Math.round(base * 1.1)
res.xpLine = ((await bodyText()).match(/\+(\d+) Forestry/) ?? [])[0] ?? ''
res.usesAfter = (await tools()).forestry
// 4. the last use: set the blade to 1 use left, prune another Shimmeroak, the Worn Blade is back
await p.evaluate((bl: { toolId: string }) => { const t = JSON.parse(localStorage.getItem('open.tools.v1') ?? '{}'); localStorage.setItem('open.tools.v1', JSON.stringify({ ...t, forestry: { ...bl, usesRemaining: 1 } })); window.dispatchEvent(new Event('open:tools')) }, blade); await sleep(800)
await pruneOut(oak2)
res.afterBreak = (await tools()).forestry
res.woreLine = /Goldwood Blade wore out/.test(await bodyText())
await p.screenshot({ path: `${out}/focuses-end.png` }).catch(() => {})
// (a leveled keeper's hydration mismatch, React #418, counted apart here at first, is FIXED: GameHud mounted-guard 11-18, hydration-check)
const other = errs
res.errs = other
console.log(JSON.stringify(res, null, 1))
const c = res.carpentry as { panel: boolean; made: boolean }, s = res.stonery as typeof c, u = res.usesAfter as { toolId: string; usesRemaining: number }
const pass = c.panel && c.made && s.panel && s.made && t1.forestry?.toolId === 'goldwood_blade' && t1.prospecting?.toolId === 'mana_spike'
  && res.manaWorn === MANA_COST * 2 && res.manaBlade === MANA_COST
  && res.xpLine === `+${want} Forestry` && u?.toolId === 'goldwood_blade' && u.usesRemaining === t1.forestry.usesRemaining - 1
  && (res.afterBreak as { toolId: string })?.toolId === 'worn_blade' && res.woreLine === true && other.length === 0
console.log(pass ? `PASS: blade + spike made at their benches → Shimmeroak ${res.manaWorn} mana worn vs ${res.manaBlade} with the blade → +${want} XP (×1.1) → one use worn → worn out, the Worn Blade back` : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
