// ── Prod check for Wilds forestry (2026-11-15, world): zones grow the Ather's four trees and E prunes one ───────────
// Picks a real goldwood + shimmeroak off the start tile (the same parser the page runs), walks up to each on prod,
// presses E: the goldwood must land a plank in the bag and a timer in open.pruned.v1; the shimmeroak must refuse at
// Forestry 1. Screenshots to --out.   npx tsx scripts/forestry-check.mts [--out dir]
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'fs'
import { parseWilds, type WildsMeta } from '../src/app/shimmer/open/ather/wilds'
import { TRUNK, type Zone } from '../src/app/shimmer/open/ather/forestry'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = flag('--out', '/tmp'), url = flag('--url', 'https://ather.games')
const D = 'public/open/wilds/', idx = JSON.parse(readFileSync(D + 'tiles.json', 'utf8'))
const zm = new Map<string, Zone>(idx.tiles.find((t: { name: string }) => t.name === 'first-wilds').nodes.map((n: { i: number; j: number; zone: Zone }) => [`${n.i},${n.j}`, n.zone]))
const b = readFileSync(D + 'first-wilds.bin'), bio = readFileSync(D + 'first-wilds.biome')
const W = parseWilds(JSON.parse(readFileSync(D + 'first-wilds.json', 'utf8')) as WildsMeta, new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), new Uint8Array(bio), (i, j) => zm.get(`${i},${j}`) ?? 'meadows')
// a tree with open ground beside it (no other trunk within 3 m), so the walker can stand at it
const lone = (k: string) => W.trees.find(t => t.kind === k && !W.trees.some(o => o !== t && Math.hypot(o.x - t.x, o.z - t.z) < 3) && Math.abs(t.x) < 400 && Math.abs(t.z) < 400)!
const gold = lone('goldwood'), oak = lone('shimmeroak')
const res: Record<string, unknown> = { gold: gold?.id, oak: oak?.id }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const p = await br.newPage(); await p.setViewport({ width: 1100, height: 680 })
await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.removeItem('open.pruned.v1'); localStorage.removeItem('open.skills.v1'); localStorage.removeItem('open.inv.v1') })
await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 120000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 120000 }); await sleep(2000)
await p.evaluate(() => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } }))
await sleep(9000)
const standBy = async (t: { x: number; z: number; kind: string }) => {
  const d = TRUNK[t.kind as keyof typeof TRUNK] + 1.1
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z, Math.PI / 2), t.x + d, t.z); await sleep(3500)
}
await p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
await standBy(gold)
try { await p.screenshot({ path: `${out}/forestry-1-goldwood.png` }) } catch { /* slow frame */ }
await p.keyboard.press('KeyE'); await sleep(1500)
res.afterGold = await p.evaluate(() => ({ pruned: Object.keys(JSON.parse(localStorage.getItem('open.pruned.v1') ?? '{}')), inv: (JSON.parse(localStorage.getItem('open.inv.v1') ?? '{"slots":[]}').slots as ({ id: string; n: number } | null)[]).filter(Boolean).map(s => s!.id) }))
try { await p.screenshot({ path: `${out}/forestry-2-pruned.png` }) } catch { /* slow frame */ }
await standBy(oak)
await p.keyboard.press('KeyE'); await sleep(1500)
res.afterOak = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('open.pruned.v1') ?? '{}')))
try { await p.screenshot({ path: `${out}/forestry-3-shimmeroak.png` }) } catch { /* slow frame */ }
console.log(JSON.stringify(res))
const a = res.afterGold as { pruned: string[]; inv: string[] }
const pass = a.pruned.includes(gold.id) && a.inv.includes('goldwood_plank') && !(res.afterOak as string[]).includes(oak.id)
console.log(pass ? 'PASS' : 'FAIL'); await br.close(); process.exit(pass ? 0 : 1)
