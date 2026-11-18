// ── Check for Wilds PROSPECTING (2026-11-16, sprites; Alex: the crystal ladder by zone). Finds a level-1 node (raw mana)
// on a real tile with clear ground 5 m off it (the page's own parser + the zone layer), travels a fresh keeper there,
// stands and aims at it, prospects (stowed hands, the Worn Spike), then reads the bag (blankstone + raw shards) and that
// the node now reads as growing back. Also shoots the node close, before and after. ⚠ Headless draws a frame only when
// asked: the script forces frames with screenshots (the channel and the arrival ride frames).
//   npx tsx scripts/prospect-check.mts [--url http://localhost:3202] [--out dir]
import puppeteer from 'puppeteer-core'
import { readFileSync, existsSync } from 'fs'
import { parseWilds, BIOME, type WildsMeta } from '../src/app/shimmer/open/ather/wilds'
import type { Zone } from '../src/app/shimmer/open/ather/forestry'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = flag('--out', '/tmp'), url = flag('--url', 'https://ather.games')
const D = 'public/open/wilds/'
const index = JSON.parse(readFileSync(D + 'tiles.json', 'utf8')) as { tiles: { name: string; tx: number; ty: number; nodes: { i: number; j: number; zone?: Zone }[] }[] }
let pick: { tile: string; tx: number; ty: number; cx: number; cz: number; cy: number; s: number; sx: number; sz: number; sy: number; id: string } | null = null
for (const t of index.tiles) {
  if (pick || !existsSync(D + t.name + '.bin')) continue
  const meta = JSON.parse(readFileSync(D + t.name + '.json', 'utf8')) as WildsMeta
  const b = readFileSync(D + t.name + '.bin'), bio = readFileSync(D + t.name + '.biome')
  const zm = new Map(t.nodes.map(n => [`${n.i},${n.j}`, n.zone ?? 'meadows']))
  const W = parseWilds(meta, new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), new Uint8Array(bio), (i, j) => (zm.get(`${i},${j}`) ?? 'meadows') as Zone)
  for (const c of W.crystals) {
    if (pick || c.kind !== 'raw') continue
    for (let a = 0; a < 8 && !pick; a++) {
      const sx = c.x + Math.cos(a * Math.PI / 4) * 5, sz = c.z + Math.sin(a * Math.PI / 4) * 5, sy = W.heightAt(sx, sz)
      if (W.biomeAt(sx, sz) === BIOME.water || sy < meta.waterY + 0.6 || Math.abs(sy - c.y) > 1.2) continue
      if (W.trees.some(tr => Math.hypot(tr.x - sx, tr.z - sz) < 2.5) || W.crystals.some(o => o !== c && Math.hypot(o.x - sx, o.z - sz) < 2.5)) continue
      pick = { tile: t.name, tx: t.tx, ty: t.ty, cx: c.x, cz: c.z, cy: c.y, s: c.s, sx, sz, sy, id: c.id }
    }
  }
}
if (!pick) { console.log('no raw node with clear ground found'); process.exit(1) }
const P = pick, TM = 1000
const wx = P.sx + P.tx * TM, wz = P.sz + P.ty * TM, cwx = P.cx + P.tx * TM, cwz = P.cz + P.ty * TM
const dx = cwx - wx, dz = cwz - wz, yaw = Math.atan2(-dx, -dz), pitch = -Math.atan2(P.sy + 1.6 - (P.cy + 0.55 * P.s), Math.hypot(dx, dz))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const p = await br.newPage(); await p.setViewport({ width: 1000, height: 640 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e)))
await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star'); for (const k of ['open.inv.v1', 'open.skills.v1', 'open.mined.v1']) localStorage.removeItem(k) })
await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
await p.waitForFunction(() => !!(window as any).__ather?.mine, { timeout: 180000 }); await sleep(2000)
// __ather.mine exists at mount but the Wilds index/network/tiles load after it: a travel sent before they land only toasts
// "still loading". Re-send until the keeper is in the Wilds (never loosens an assert, just waits for the world).
for (let i = 0; i < 40 && (await p.evaluate(() => (window as any).__ather.zone())) !== 'wilds'; i++) {
  await p.evaluate((P) => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'check', tile: P.tile, x: P.sx, y: P.sy, z: P.sz, biome: 4, made: 0 } }), P)
  await sleep(4000)
}
if ((await p.evaluate(() => (window as any).__ather.zone())) !== 'wilds') { console.log('never reached the Wilds'); console.log('FAIL'); await br.close(); process.exit(1) }
await sleep(10000)
const frame = async (name = '_frame') => { try { await p.screenshot({ path: `${out}/${name}.png` }) } catch { /* slow */ } }
await p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
await p.evaluate((a) => { const A = (window as any).__ather; A.tp(a.wx, a.wz, a.yaw); A.look(a.yaw, a.pitch) }, { wx, wz, yaw, pitch }); await sleep(3000)
await p.evaluate((a) => (window as any).__ather.look(a.yaw, a.pitch), { yaw, pitch })
for (let i = 0; i < 3; i++) await frame()
await frame('prospect-1-aim')
const res: Record<string, unknown> = { pick: { tile: P.tile, id: P.id }, stance: await p.evaluate(() => (window as any).__ather.stance()?.kind), aimed: await p.evaluate(() => (window as any).__ather.crystal()) }
await p.evaluate(() => (window as any).__ather.mine())
for (let i = 0; i < 6; i++) await frame(i === 2 ? 'prospect-2-burst' : '_frame')
for (let i = 0; i < 80 && await p.evaluate(() => !!(window as any).__ather.chan?.()); i++) { try { await p.screenshot({ path: `${out}/_frame.png` }) } catch { /* slow frame */ } }   // gathering is a CHANNEL now (channel.ts): wait for the last chip
await sleep(1500); for (let i = 0; i < 4; i++) await frame()
await frame('prospect-3-after')
res.bag = await p.evaluate(() => (JSON.parse(localStorage.getItem('open.inv.v1') ?? '{"slots":[]}').slots as ({ id: string; n: number } | null)[]).filter(Boolean).map(s => `${s!.id}x${s!.n}`))
res.mined = await p.evaluate((id) => Object.keys(JSON.parse(localStorage.getItem('open.mined.v1') ?? '{}')).includes(id), P.id)
res.errors = errs.slice(0, 3)
console.log(JSON.stringify(res))
const bag = res.bag as string[], aimed = res.aimed as { id: string } | null
const pass = aimed?.id === P.id && res.stance === 'stowed' && bag.some(x => x.startsWith('blankstone')) && bag.some(x => x.startsWith('raw_mana_shard')) && res.mined === true && errs.length === 0
console.log(pass ? 'PASS' : 'FAIL'); await br.close(); process.exit(pass ? 0 : 1)
