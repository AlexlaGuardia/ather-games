// BETA M26 (Alex 11-18): TALKERS STAND OUTSIDE THEIR DOORS. On the continent every door that talks (a runesmith's counter,
// Idony at the Enchant Temple, the Co.'s clerk) has the Alkin rig (shared/folk-model.tsx) standing a step out from it.
// The Citadel's Co. door: walk up (movement hooks), the clerk's body is drawn (__doorFolk) where door-folk.ts puts it,
// the real E opens the clerk's talk (the bubble), and the screenshot shows the body under the bubble. 0 page errors.
//   npx tsx scripts/door-folk-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { readFileSync, mkdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { doorsCached } from '../src/app/shimmer/open/business/doors'
import { shopDoorPoint } from '../src/app/shimmer/open/towns/shop-door'
import { talkersOf, standOf } from '../src/app/shimmer/open/continent/door-folk'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/door-folk')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
const door = doorsCached(R, 'citadel').find(d => d.key === 'front:trade-co')!
const at = shopDoorPoint(door.b), stand = standOf(door), all = talkersOf(R)
const res: Record<string, unknown> = { url, talkers: all.length, kinds: [...new Set(all.map(t => t.key.split(':')[0] + ':' + (t.key.startsWith('smith:') ? '*' : t.key.split(':')[1])))] }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1000, height: 640 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(500) } return false }
let pass = false
try {
  await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  await p.goto(`${url}/shimmer/open/continent?hour=12`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__drive?.state && !!(window as any).__market && !!(window as any).__doorFolk, { timeout: 240000, polling: 1000 }); await sleep(3000)
  await p.mouse.click(500, 320).catch(() => {}); await sleep(500)
  // the page and the check agree on where every talker stands
  const pageAll = await p.evaluate(() => (window as any).__doorFolk.all()) as { key: string; x: number; z: number }[]
  const pc = pageAll.find(t => t.key === 'front:trade-co')
  res.samePlace = !!pc && Math.hypot(pc.x - stand.x, pc.z - stand.z) < 0.01 && pageAll.length === all.length
  // to the Co.'s door in the Citadel, on foot, facing it
  const b = door.b, fx = Math.cos(b.yaw), fz = Math.sin(b.yaw), yaw = Math.atan2(fx, fz)
  await p.evaluate((x, z) => (window as any).__drive.tp(x + 30, z + 30, 0, 0), door.at.x, door.at.z); await sleep(6000)
  await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, -0.08), at.x + fx * 3.6, at.z + fz * 3.6, yaw)   // the same yaw trade-co-check faces the door with; await sleep(4000)
  res.drawn = await poll(async () => ((await p.evaluate(() => (window as any).__doorFolk.drawn())) as string[]).includes('front:trade-co'), 30000)
  try { await p.screenshot({ path: `${out}/door-folk-1-clerk.png` }) } catch { /* slow frame */ }
  await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, -0.08), at.x + fx * 0.8, at.z + fz * 0.8, yaw); await sleep(3000)
  res.reach = await poll(async () => await p.evaluate(() => (window as any).__market.reach()) === 'front:trade-co', 30000)
  await p.keyboard.press('KeyE')
  res.bubble = await poll(async () => !!(await p.evaluate(() => document.querySelector('[data-talk-bubble]')?.textContent)), 15000)
  await sleep(1500); try { await p.screenshot({ path: `${out}/door-folk-2-talk.png` }) } catch { /* slow frame */ }
  pass = res.samePlace === true && res.drawn === true && res.reach === true && res.bubble === true && errs.length === 0 && (res.talkers as number) > 0
} catch (e) { res.error = String(e).slice(0, 300) }
res.pageErrors = errs
console.log(JSON.stringify(res)); console.log(pass ? 'PASS' : 'FAIL'); await br.close(); process.exit(pass ? 0 : 1)
