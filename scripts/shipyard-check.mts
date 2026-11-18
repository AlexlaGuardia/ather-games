// THE SHIPYARD (Alex 11-18): a fresh keeper has no gun; Kael's chest in Rune Hold hands over the Charred Rifle + the Repeater.
//   npx tsx scripts/shipyard-check.mts [--url https://ather.games]
import puppeteer from 'puppeteer-core'
import { readFileSync, mkdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { doorsCached } from '../src/app/shimmer/open/business/doors'
import { shopDoorPoint } from '../src/app/shimmer/open/towns/shop-door'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/shipyard')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
const door = doorsCached(R, 'rune-hold').find(d => d.key === 'front:shipyard')
if (!door) { console.log('FAIL: no shipyard door in Rune Hold'); process.exit(1) }
const at = shopDoorPoint(door.b)
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await br.createBrowserContext()
const p = await ctx.newPage(); await p.setViewport({ width: 1000, height: 640 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
const res: Record<string, unknown> = { url, door: door.key }
const text = () => p.evaluate(() => (document.body?.innerText ?? '').replace(/\s*\n\s*/g, ' | ').slice(0, 900)).catch(() => '?')
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(500) } return false }
const done = async (pass: boolean, line: string) => { res.pageErrors = errs; console.log(JSON.stringify(res, null, 1)); console.log(line); await br.close(); process.exit(pass ? 0 : 1) }
const tapText = async (re: RegExp) => {
  const box = await p.evaluate((src: string) => {
    const rx = new RegExp(src, 'i'); let best: DOMRect | null = null, area = Infinity
    for (const e of document.querySelectorAll<HTMLElement>('button, a, [role="button"], div, span')) {
      const t = (e.innerText ?? '').trim(); if (!t || !rx.test(t) || t.length > 60) continue
      const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue
      if (r.width * r.height < area) { area = r.width * r.height; best = r }
    }
    return best && { x: best.x + best.width / 2, y: best.y + best.height / 2 }
  }, re.source)
  if (!box) return false
  await p.mouse.click(box.x, box.y); return true
}
// 1 · born through the real tap, then the continent
await p.goto(`${url}/shimmer/open/ather`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(4000)
res.born = await tapText(/^BE BORN/); await sleep(5000)
res.noGunInBag = await p.evaluate(() => !JSON.stringify(localStorage).includes('"repeater"'))
await p.goto(`${url}/shimmer/open/continent?hour=12`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__drive?.state && !!(window as any).__market, { timeout: 240000 }); await sleep(2000)
await p.keyboard.press('KeyW'); await sleep(500)
// 2 · to the shipyard door (movement hooks), then the real E
const b = door.b, fx = Math.cos(b.yaw), fz = Math.sin(b.yaw), yaw = Math.atan2(fx, fz)
await p.evaluate((x, z) => (window as any).__drive.tp(x + 30, z + 30, 0, 0), door.at.x, door.at.z); await sleep(6000)
await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, -0.08), at.x + fx * 0.8, at.z + fz * 0.8, yaw); await sleep(5000)
res.reach = await poll(async () => await p.evaluate(() => (window as any).__market.reach()) === 'front:shipyard')
if (!res.reach) await done(false, 'FAIL: the shipyard door is not in reach')
await p.keyboard.press('KeyE')
res.panel = await poll(async () => !!(await p.$('[data-panel="shipyard"]')), 15000)
await p.screenshot({ path: `${out}/shipyard.png` })
if (!res.panel) await done(false, 'FAIL: E did not open the shipyard')
res.opened = await p.evaluate(() => { const bt = [...document.querySelectorAll<HTMLButtonElement>('[data-panel="shipyard"] button')].find(x => /Kael/.test(x.textContent ?? '')); if (!bt) return false; bt.click(); return true })
await sleep(1000)
const lo = await p.evaluate(() => { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; if (k.endsWith('open.loadout.v1')) return JSON.parse(localStorage.getItem(k)!) } return null })
res.loadout = lo && { guns: lo.guns, primary: lo.primary, secondary: lo.secondary, kael: lo.kael }
res.empty = !!(await p.$('[data-panel="shipyard"] [data-chest="empty"]'))
const pass = !!res.born && !!res.noGunInBag && !!res.opened && lo?.kael === true && lo?.primary === 'charred-rifle' && lo?.secondary === 'repeater' && !!res.empty && errs.length === 0
await done(pass, pass ? 'PASS' : 'FAIL')
