// ── Prod check for Wilds forestry (2026-11-15, world): zones grow the Ather's four trees and E prunes one ───────────
// Picks a real goldwood + shimmeroak off the start tile (the same parser the page runs). From 6 m it aims at the goldwood
// and prunes through the click's own path (__ather.prune): logs land in the bag, a timer in open.pruned.v1, mana is spent.
// From 14 m nothing is aimed. A shimmeroak takes a Forestry 1 keeper (M136: no level gate). Screenshots to --out.   npx tsx scripts/forestry-check.mts [--out dir]
import puppeteer from 'puppeteer-core'
import { aimAt } from './lib/aim.mts'
import { loneTree } from './lib/lone-tree.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = flag('--out', '/tmp'), url = flag('--url', 'https://ather.games')
// M133: the pick reads the GAME'S ground (lib/lone-tree.mts): the old one stood the keeper in a cloud void pit
const gold = loneTree('goldwood'), oak = loneTree('shimmeroak')
const res: Record<string, unknown> = { gold: gold?.id, oak: oak?.id }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const p = await br.newPage(); await p.setViewport({ width: 1100, height: 680 })
await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.tutorial.v1', JSON.stringify({ v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null }));   /* M68 s3a: past the tutorial, so the worn pruner + spike are lit */  localStorage.removeItem('open.pruned.v1'); localStorage.removeItem('open.skills.v1'); localStorage.removeItem('open.inv.v1') })
await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 120000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 120000 }); await sleep(2000)
for (let i = 0; i < 20 && (await p.evaluate(() => (window as any).__ather.zone())) !== 'wilds'; i++) { await p.evaluate(() => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } })); await sleep(4000) }   // the index can still be loading: re-send
await sleep(9000)
// stand `d` metres east of a tree, facing it (yaw π/2 looks west), so the crosshair sits on the trunk
// ⚠ headless renders a frame only when asked (a screenshot forces one): the aim is computed IN the frame loop, so read it
// after a forced frame or it is the PREVIOUS spot's answer (the first runs read every aim one view late, 11-15)
const frame = async () => { try { await p.screenshot({ path: `${out}/_frame.png` }) } catch { /* slow frame */ } }
const aimFrom = async (t: { x: number; z: number }, d: number) => { await p.evaluate((x, z) => (window as any).__ather.tp(x, z, Math.PI / 2), t.x + d, t.z); await sleep(3000); for (let i = 0; i < (d < 10 ? 25 : 2); i++) { await aimAt(p, t.x, t.z, 1.0); await frame(); if (await p.evaluate(() => (window as any).__ather.aim())) break; await sleep(500) } }
await p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
// FROM A DISTANCE (Alex 11-15: "click a tree from about 10 blocks out"): 6 m off, aim, prune (the click's own path)
await aimFrom(gold, 6)
res.aimGold = await p.evaluate(() => (window as any).__ather.aim())
try { await p.screenshot({ path: `${out}/forestry-1-aim.png` }) } catch { /* slow frame */ }
const mana0 = await p.evaluate(() => (window as any).__ather.mana())
await p.evaluate(() => (window as any).__ather.prune()); await sleep(450)
try { await p.screenshot({ path: `${out}/forestry-2-channel.png` }) } catch { /* slow frame */ }
res.chanStarted = await p.evaluate(() => (window as any).__ather.chan?.())
for (let i = 0; i < 80 && await p.evaluate(() => !!(window as any).__ather.chan?.()); i++) { try { await p.screenshot({ path: `${out}/_frame.png` }) } catch { /* slow frame */ } }   // gathering is a CHANNEL now (channel.ts): wait for the last chip
try { await p.screenshot({ path: `${out}/forestry-3-drops.png` }) } catch { /* slow frame */ }
await sleep(1500)
res.manaSpent = +(mana0 - (await p.evaluate(() => (window as any).__ather.mana()))).toFixed(1)
res.afterGold = await p.evaluate(() => ({ pruned: Object.keys(JSON.parse(localStorage.getItem('open.pruned.v1') ?? '{}')), inv: (JSON.parse(localStorage.getItem('open.inv.v1') ?? '{"slots":[]}').slots as ({ id: string; n: number } | null)[]).filter(Boolean).map(s => `${s!.id}x${s!.n}`) }))
// out of reach: 14 m off, nothing is aimed
await aimFrom(gold, 14)
res.aimFar = await p.evaluate(() => (window as any).__ather.aim())
// M136: no level gate, a shimmeroak at Forestry 1 is worked (it leaves a record: its reset timer runs)
await aimFrom(oak, 5)
res.aimOak = await p.evaluate(() => (window as any).__ather.aim())
await p.evaluate(() => (window as any).__ather.prune())
res.afterOak = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('open.gather.v1') ?? '{}')))
console.log(JSON.stringify(res))
const a = res.afterGold as { pruned: string[]; inv: string[] }
// the mana check allows for the refill over the ~4 s between the two readings
const pass = res.aimGold === gold.id && a.pruned.includes(gold.id) && a.inv.some(x => x.startsWith('goldwood_log')) && !a.inv.some(x => x.startsWith('worn_blade'))   /* tools live in the sockets now (stance, 11-15), never the bag */
  && (res.manaSpent as number) > -2 && res.aimFar === null && res.aimOak === oak.id && (res.afterOak as string[]).includes(`tree:${oak.id}`)
console.log(pass ? 'PASS' : 'FAIL'); await br.close(); process.exit(pass ? 0 : 1)
