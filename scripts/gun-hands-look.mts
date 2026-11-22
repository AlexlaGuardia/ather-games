// THE SPITTER + BACKBONE IN HAND (Alex's 11-22 per-gun hands, fp-gun.tsx GUN_BAKED): each gun drawn at the hip, in the sights,
// and fired once, screenshots for the LOOK. SETUP (stated): loadout = Spitter primary, Backbone secondary. Real input (R, right
// click, left click); reading __fpGun. Zero page errors.
//   npx tsx scripts/gun-hands-look.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/gun-hands')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1280, height: 760 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
await p.evaluateOnNewDocument(() => {
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  localStorage.setItem('open.loadout.v1', JSON.stringify({ v: 1, guns: ['spitter', 'backbone'], primary: 'spitter', secondary: 'backbone', kael: true,
    vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: null }], tactical: 'starter-bracelet', signature: 'starter-glove' }))
})
const res: Record<string, unknown> = { url }
const G = () => p.evaluate(() => { const g = (window as any).__fpGun; return g ? { shown: g.shown(), key: g.key(), ads: +g.ads().toFixed(2) } : null })
const poll = async (fn: () => Promise<boolean>, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(150) } return false }
const tapR = async () => { await p.keyboard.down('KeyR'); await sleep(80); await p.keyboard.up('KeyR'); await sleep(500) }
await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__fpGun, { timeout: 240000 }); await sleep(4000)
await p.mouse.click(640, 380); await sleep(800)
for (const [i, gun] of (['spitter', 'backbone'] as const).entries()) {
  await tapR(); await poll(async () => !!(await G())?.shown && String((await G())?.key).startsWith(gun))
  res[`${gun}Hip`] = await G(); await sleep(600); await p.screenshot({ path: `${out}/${i * 3 + 1}-${gun}-hip.png` })
  await p.mouse.down({ button: 'right' }); res[`${gun}Ads`] = await poll(async () => ((await G())?.ads ?? 0) >= 0.99)
  await sleep(300); await p.screenshot({ path: `${out}/${i * 3 + 2}-${gun}-ads.png` })
  await p.mouse.down({ button: 'left' }); await sleep(60); await p.screenshot({ path: `${out}/${i * 3 + 3}-${gun}-shot.png` }); await sleep(200); await p.mouse.up({ button: 'left' })
  await p.mouse.up({ button: 'right' }); await poll(async () => ((await G())?.ads ?? 1) <= 0.01); await sleep(600)
}
res.errs = errs
console.log(JSON.stringify(res))
const pass = String((res.spitterHip as any)?.key).startsWith('spitter') && String((res.backboneHip as any)?.key).startsWith('backbone') && res.spitterAds === true && res.backboneAds === true && errs.length === 0
console.log(pass ? 'PASS: Spitter + Backbone drawn, aimed and fired (shots in --out for the look)' : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
