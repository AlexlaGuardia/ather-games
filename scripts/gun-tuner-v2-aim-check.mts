// Gun Tuner, New model: Iron chip exists and is each v2 gun's default; the Aim preview lays the sight's aim point on the view centre
// for iron, holo and prism (and today's model is read for comparison). Owner-only page.
//   OWNER_KEY=... npx tsx scripts/gun-tuner-v2-aim-check.mts [--url http://localhost:3204]
import puppeteer from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'http://localhost:3204')
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1280, height: 760 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
const KEY = process.env.OWNER_KEY; if (!KEY) { console.log('OWNER_KEY not set'); process.exit(2) }
await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'load', timeout: 120000 })
let bad = 0
const say = (ok: boolean, m: string) => { if (!ok) bad++; console.log(ok ? 'ok  ' : 'FAIL', m) }
const load = async (q: string) => {
  await p.goto(`${url}/shimmer/dev/guns?${q}`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__fpGun && !!(window as any).__fpGun.key(), { timeout: 240000 })
  await p.waitForFunction(() => (window as any).__fpGun.ads() >= 0.99, { timeout: 30000 }).catch(() => {})
  await new Promise(r => setTimeout(r, 600))
}
const px = async () => p.evaluate(() => { const a = (window as any).__fpGun.aim(), c = document.querySelector('canvas')!.getBoundingClientRect(); return { ads: (window as any).__fpGun.ads(), dx: a[0] * c.width / 2, dy: a[1] * c.height / 2 } })
// the chips: Iron exists and is the one lit by default
await load('gun=backbone&set=new&preview=aim')
const chips = await p.evaluate(() => [...document.querySelectorAll('[data-sight]')].map(e => [e.getAttribute('data-sight'), (e as HTMLElement).style.opacity]))
say(chips.some(c => c[0] === 'iron'), `Iron chip exists (${JSON.stringify(chips)})`)
say(chips.find(c => c[1] === '1')?.[0] === 'iron', 'Iron is the lit (default) chip')
const R: Record<string, any> = {}
for (const [g, s] of [['backbone', 'iron'], ['backbone', 'holo'], ['backbone', 'prism'], ['lance', 'iron'], ['lance', 'prism'], ['charred-rifle', 'ring'], ['spitter', 'iron'], ['spitter', 'holo']]) {
  await load(`gun=${g}&set=new&preview=aim&sight=${s}`); const r = await px(); R[`${g}:${s}`] = r
  say(r.ads >= 0.99 && Math.hypot(r.dx, r.dy) < 4, `${g} new ${s}: aim point ${r.dx.toFixed(1)},${r.dy.toFixed(1)} px from centre (ads ${r.ads.toFixed(2)})`)
}
await load('gun=backbone&preview=aim'); const t = await px(); console.log('today backbone aim:', t.dx.toFixed(1), t.dy.toFixed(1))
say(Math.hypot(t.dx, t.dy) < 4, 'today backbone aim point on centre')
say(errs.length === 0, `page errors: ${errs.join(' | ')}`)
console.log(bad ? 'FAIL' : 'PASS'); await br.close(); process.exit(bad ? 1 : 0)
