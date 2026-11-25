// M149 s1: the look-sheet shots of the new gun family (off in the game), from /shimmer/dev/gun-kit?family and the tuner.
//   OWNER_KEY=... npx tsx scripts/m149-gun-shots.mts --url http://localhost:3202 --out dir [--only bench|desk|phone]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'http://localhost:3202'), out = flag('--out', '/tmp/m149'), only = flag('--only', '')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const KEY = process.env.OWNER_KEY; if (!KEY) { console.log('OWNER_KEY not set'); process.exit(2) }
const br = await puppeteer.launch({ protocolTimeout: 120000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
let bad = 0
try {
  await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'load', timeout: 120000 })
  const bench = async (q: string, name: string, w: number, h: number) => {
    await p.setViewport({ width: w, height: h }); await p.goto(`${url}/shimmer/dev/gun-kit?family=${q}`, { waitUntil: 'load', timeout: 240000 })
    await p.waitForFunction(() => !!(window as any).__family && !!document.querySelector('canvas'), { timeout: 120000 }); await p.addStyleTag({ content: 'nextjs-portal,a[href="/shimmer/dev"]{display:none!important}' }); await sleep(1800)
    await p.screenshot({ path: `${out}/${name}.png` })
  }
  if (!only || only === 'bench') {
    const L = Math.PI / 2   // muzzle left
    await bench(`side&yaw=${L}`, 'side', 1000, 640)
    console.log('tris', JSON.stringify(await p.evaluate(() => (window as any).__family)))
    for (const g of ['backbone', 'charred-rifle', 'lance']) await bench(`one&gun=${g}&yaw=${L - 0.45}`, `${g}-34`, 1000, 460)
    await bench('sights', 'sights', 1000, 360)
    for (const g of ['backbone', 'charred-rifle', 'lance']) await bench(`third&gun=${g}&yaw=0`, `${g}-third`, 520, 520)
    await bench('third&gun=backbone&today=1&yaw=0', 'today-third', 520, 520)
  }
  const COMBOS: [string, string, string][] = [['backbone', 'holo', 'bb-holo'], ['backbone', 'prism', 'bb-prism'], ['lance', 'prism', 'lance-prism'], ['charred-rifle', 'ring', 'charred-ring'], ['backbone', '', 'bb-today'], ['charred-rifle', '', 'charred-today'], ['lance', '', 'lance-today']]
  for (const [tag, w, h] of [['desk', 1280, 760], ['phone', 390, 844]] as [string, number, number][]) {
    if (only && only !== tag) continue
    await p.setViewport(tag === 'phone' ? { width: w, height: h, isMobile: true, hasTouch: true } : { width: w, height: h })
    for (const [g, s, n] of COMBOS) for (const v of ['hip', 'aim']) {
      await p.goto(`${url}/shimmer/dev/guns?gun=${g}&preview=${v}${s ? `&set=new&sight=${s}` : ''}`, { waitUntil: 'load', timeout: 240000 })
      await p.addStyleTag({ content: 'nextjs-portal,a[href="/shimmer/dev"]{display:none!important}aside[data-panel]{display:none!important}' })
      const want = s ? ':p' : ''
      const okk = await p.waitForFunction((k: string, g: string) => { const f = (window as any).__fpGun; return f && f.key().startsWith(g + ':') && f.key().includes(k) }, { timeout: 60000 }, want, g).then(() => true).catch(() => false)
      if (v === 'aim') await p.waitForFunction(() => (window as any).__fpGun?.ads() >= 0.99, { timeout: 40000 }).catch(() => { bad++ })
      await sleep(1500); if (!okk) { bad++; console.log('NOT DRAWN', n, v) }
      if (v === 'aim' && s === 'prism') console.log(tag, n, 'lens', JSON.stringify(await p.evaluate(() => (window as any).__fpGun.lens())))
      await p.screenshot({ path: `${out}/${tag}-${n}-${v}.png` })
    }
  }
} catch (e) { bad++; console.log(String(e)) } finally { await br.close() }
console.log('page errors', errs.length, errs.slice(0, 3).join(' | ')); console.log(bad || errs.length ? 'FAIL' : 'PASS'); process.exit(bad || errs.length ? 1 : 0)
