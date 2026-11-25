// M149 s1: what the prism's picture costs in the Ather at phone size. DEV SERVER ONLY (the preview hook is not in a production build).
//   npx tsx scripts/m149-lens-cost.mts --url http://localhost:3202
import puppeteer from 'puppeteer-core'
import { v2Model } from '../src/app/shimmer/open/shared/gun-kit-v2'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'http://localhost:3202'), out = flag('--out', '/tmp')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await br.newPage(); await p.setViewport({ width: 390, height: 844 }); p.setDefaultTimeout(240000)
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.loadout.v1', JSON.stringify({ v: 1, guns: ['repeater', 'backbone'], primary: 'backbone', secondary: 'repeater', kael: true, vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: null }], tactical: 'starter-bracelet', signature: 'starter-glove' })) })
  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather && !!(window as any).__fpGun?.preview, { timeout: 120000 }); await sleep(6000)
  await p.mouse.click(195, 300); await sleep(500)
  await p.keyboard.down('KeyR'); await sleep(200); await p.keyboard.up('KeyR'); await sleep(2500)
  console.log('gun', await p.evaluate(() => (window as any).__fpGun.key()))
  const frames = () => p.evaluate(() => new Promise<number>(res => { let n = 0, t0 = 0; const f = (t: number) => { if (!t0) t0 = t; else n++; if (t - t0 > 8000) res((t - t0) / n); else requestAnimationFrame(f) }; requestAnimationFrame(f) }))
  await p.mouse.down({ button: 'right' })
  for (const s of ['holo', 'prism', 'holo', 'prism'] as const) {
    const m = JSON.parse(JSON.stringify(v2Model('backbone', s))); m.optic = 'reddot'   // same view fov for both: the only difference is the picture
    await p.evaluate((m: unknown) => (window as any).__fpGun.preview('backbone', m), m)
    await p.waitForFunction(() => (window as any).__fpGun.ads() > 0.99, { timeout: 30000 }).catch(() => console.log('not aimed')); await sleep(1000)
    const ms = await frames(); console.log(s, 'frame ms', ms.toFixed(1), JSON.stringify(await p.evaluate(() => ({ lens: (window as any).__fpGun.lens(), frame: (window as any).__fpGun.info() }))))
    await p.screenshot({ path: `${out}/ather-phone-${s}.png` })
  }
} catch (e) { console.log('ERR', String(e)) } finally { await br.close() }
