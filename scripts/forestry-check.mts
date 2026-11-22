// ── Prod check for Wilds forestry (2026-11-15, world): zones grow the Ather's four trees and E prunes one ───────────
// Picks a real goldwood + shimmeroak off the start tile (the same parser the page runs). From 6 m it aims at the goldwood
// and prunes through the click's own path (__ather.prune): logs land in the bag, a timer in open.pruned.v1, mana is spent.
// From 14 m nothing is aimed. A shimmeroak refuses at Forestry 1. Screenshots to --out.   npx tsx scripts/forestry-check.mts [--out dir]
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
// a tree with a CLEAR LINE on its east side (no trunk within 15 m east and 3 m either side, none within 3 m), so the
// walker can stand 6 or 14 m east of it and the crosshair meets it first. ⚠ The first cut only checked 3 m round the
// tree and stood the camera inside a neighbouring shimmeroak's trunk (11-15).
const lone = (k: string) => W.trees.find(t => t.kind === k && !W.trees.some(o => o !== t && (Math.hypot(o.x - t.x, o.z - t.z) < 3 || (o.x > t.x && o.x < t.x + 15 && Math.abs(o.z - t.z) < 3))) && Math.abs(t.x) < 400 && Math.abs(t.z) < 400)!
const gold = lone('goldwood'), oak = lone('shimmeroak')
const res: Record<string, unknown> = { gold: gold?.id, oak: oak?.id }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const p = await br.newPage(); await p.setViewport({ width: 1100, height: 680 })
await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.tutorial.v1', JSON.stringify({ v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null }));   /* M68 s3a: past the tutorial, so the worn pruner + spike are lit */  localStorage.removeItem('open.pruned.v1'); localStorage.removeItem('open.skills.v1'); localStorage.removeItem('open.inv.v1') })
await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 120000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 120000 }); await sleep(2000)
await p.evaluate(() => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } }))
await sleep(9000)
// stand `d` metres east of a tree, facing it (yaw π/2 looks west), so the crosshair sits on the trunk
// ⚠ headless renders a frame only when asked (a screenshot forces one): the aim is computed IN the frame loop, so read it
// after a forced frame or it is the PREVIOUS spot's answer (the first runs read every aim one view late, 11-15)
const frame = async () => { try { await p.screenshot({ path: `${out}/_frame.png` }) } catch { /* slow frame */ } }
const aimFrom = async (t: { x: number; z: number }, d: number) => { await p.evaluate((x, z) => (window as any).__ather.tp(x, z, Math.PI / 2), t.x + d, t.z); await sleep(3000); await frame(); await frame() }
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
// the gate: a shimmeroak at Forestry 1 refuses
await aimFrom(oak, 5)
res.aimOak = await p.evaluate(() => (window as any).__ather.aim())
await p.evaluate(() => (window as any).__ather.prune()); await sleep(2000)
res.afterOak = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('open.pruned.v1') ?? '{}')))
console.log(JSON.stringify(res))
const a = res.afterGold as { pruned: string[]; inv: string[] }
// the mana check allows for the refill over the ~4 s between the two readings
const pass = res.aimGold === gold.id && a.pruned.includes(gold.id) && a.inv.some(x => x.startsWith('goldwood_log')) && !a.inv.some(x => x.startsWith('worn_blade'))   /* tools live in the sockets now (stance, 11-15), never the bag */
  && (res.manaSpent as number) > -2 && res.aimFar === null && res.aimOak === oak.id && !(res.afterOak as string[]).includes(oak.id)
console.log(pass ? 'PASS' : 'FAIL'); await br.close(); process.exit(pass ? 0 : 1)
