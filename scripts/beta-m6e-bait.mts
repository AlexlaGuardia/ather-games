// ── BETA M6e: BAIT REFILLS (2026-11-17, play / Jin 2 95f19652) ────────────────────────────────────────────────────────
// A keeper who has spent every bait and landed nothing (the dead end: a rinn can get away) makes more without a guide.
// SETUP (stated, not hidden): the bag starts with NO bait and the starting-bait gift already handed (a keeper who ran out).
// Hooks are used for MOVEMENT (tp beside a goldwood) and for the prune itself (__ather.prune = the click's own path, as
// forestry-check does); NEVER to grant an item. The bag opens on the real I key; the mast slot and "Make bait" are real
// mouse clicks. PASS = bait is back in the bag, made from mast a pruned tree dropped.
//   npx tsx scripts/beta-m6e-bait.mts [--url https://ather.games] [--out /tmp/m6e]
import { collect } from './lib/loot.mts'
import puppeteer from 'puppeteer-core'
import { readFileSync, mkdirSync } from 'fs'
import { parseWilds, type WildsMeta } from '../src/app/shimmer/open/ather/wilds'
import type { Zone } from '../src/app/shimmer/open/ather/forestry'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = flag('--out', '/tmp/m6e'), url = flag('--url', 'https://ather.games')
mkdirSync(out, { recursive: true })
const D = 'public/open/wilds/', idx = JSON.parse(readFileSync(D + 'tiles.json', 'utf8'))
const zm = new Map<string, Zone>(idx.tiles.find((t: { name: string }) => t.name === 'first-wilds').nodes.map((n: { i: number; j: number; zone: Zone }) => [`${n.i},${n.j}`, n.zone]))
const b = readFileSync(D + 'first-wilds.bin'), bio = readFileSync(D + 'first-wilds.biome')
const W = parseWilds(JSON.parse(readFileSync(D + 'first-wilds.json', 'utf8')) as WildsMeta, new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), new Uint8Array(bio), (i, j) => zm.get(`${i},${j}`) ?? 'meadow')
// goldwoods with a clear line on the east side (forestry-check's `lone` rule), so standing 6 m east puts the crosshair on it
const golds = W.trees.filter(t => t.kind === 'goldwood' && !W.trees.some(o => o !== t && (Math.hypot(o.x - t.x, o.z - t.z) < 3 || (o.x > t.x && o.x < t.x + 15 && Math.abs(o.z - t.z) < 3))) && Math.abs(t.x) < 400 && Math.abs(t.z) < 400).slice(0, 14)
const res: Record<string, unknown> = { url, golds: golds.length }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 680 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument(() => {
  if (sessionStorage.getItem('m6e')) return; sessionStorage.setItem('m6e', '1')   // set up once, never on a reload
  localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.tutorial.v1', JSON.stringify({ v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null }));   /* M68 s3a: past the tutorial, so the worn pruner + spike are lit */  localStorage.removeItem('open.pruned.v1'); localStorage.removeItem('open.skills.v1')
  const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[1] = { id: 'waymark', n: 12 }
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))   // out of bait, nothing landed
})
const bag = () => p.evaluate(() => { const r: Record<string, number> = {}; for (const s of (JSON.parse(localStorage.getItem('open.inv.v1') ?? '{"slots":[]}').slots as ({ id: string; n: number } | null)[])) if (s) r[s.id] = (r[s.id] ?? 0) + s.n; return r })
await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 120000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 120000 }); await sleep(2000)
await p.evaluate(() => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } }))
await sleep(9000)
await p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
res.before = await bag()
const frame = async () => { try { await p.screenshot({ path: `${out}/_frame.png` }) } catch { /* slow frame */ } }
let prunes = 0
for (const t of golds) {
  if (((await bag()).mast ?? 0) > 0) break
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z, Math.PI / 2), t.x + 6, t.z); await sleep(3000); await frame(); await frame()
  if ((await p.evaluate(() => (window as any).__ather.aim())) !== t.id) continue
  await p.evaluate(() => (window as any).__ather.prune()); await sleep(500)
  for (let i = 0; i < 80 && await p.evaluate(() => !!(window as any).__ather.chan?.()); i++) { try { await p.screenshot({ path: `${out}/_frame.png` }) } catch { /* slow frame */ } }   // gathering is a CHANNEL now (channel.ts): wait for the last chip
  await sleep(1500); await collect(p, frame); prunes++   // M141: walk over what fell
}
res.prunes = prunes; res.afterPrunes = await bag()
// the bag: real I key, real click on the mast slot, real click on Make bait
await p.keyboard.press('i'); await sleep(1200)
const box = (sel: string) => p.evaluate((s: string) => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel)
const slot = await box('[data-panel="bag"] [data-slot][title^="Mast"], [data-slot][title^="Mast"]')
res.mastSlot = !!slot
if (slot) { await p.mouse.click(slot.x, slot.y); await sleep(600) }
try { await p.screenshot({ path: `${out}/m6e-1-card.png` }) } catch { /* slow frame */ }
const make = await box('[data-act="make-bait"]')
res.makeButton = !!make
if (make) { await p.mouse.click(make.x, make.y); await sleep(800) }
try { await p.screenshot({ path: `${out}/m6e-2-made.png` }) } catch { /* slow frame */ }
res.after = await bag(); res.errs = errs
console.log(JSON.stringify(res))
const pass = !((res.before as Record<string, number>).bait) && ((res.after as Record<string, number>).bait ?? 0) > 0
console.log(pass ? 'PASS: a keeper out of bait pruned a tree, got mast, and made bait in the bag' : 'FAIL: a keeper out of bait has no way to make more')
await br.close(); process.exit(pass ? 0 : 1)
