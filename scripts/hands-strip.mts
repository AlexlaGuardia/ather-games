// ── HANDS STRIP (11-21, sprites): the right mitt at Hold weight 0 / 0.5 / 1 on /shimmer/dev/hands (owner page), for Alex's eye on
// the idle -> HOLD turn (fp-hands-pose holdTurn: slerped on one fixed arc). Pins the weight with ?hold=, holds a sample item.
//   OWNER_KEY=... npx tsx scripts/hands-strip.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/hands-strip'), KEY = process.env.OWNER_KEY
if (!KEY) { console.log('OWNER_KEY not set'); process.exit(2) }
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
let fails = 0
try {
  const p = await br.newPage(); await p.setViewport({ width: 1100, height: 680 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 160)))
  await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'networkidle2', timeout: 60000 })
  for (const w of ['0', '0.25', '0.5', '0.75', '1']) {
    await p.goto(`${url}/shimmer/dev/hands?preview=hold&hold=${w}`, { waitUntil: 'load', timeout: 120000 })
    await p.waitForSelector('canvas', { timeout: 60000 }); await sleep(4000)
    const pressed = await p.evaluate(() => getComputedStyle(document.querySelector('[data-preview="hold"]')!).opacity === '1')
    if (!pressed) { console.log(`✗ hold ${w}: the Hold preview did not come up`); fails++ }
    await p.screenshot({ path: `${out}/hold-${w}.png` }); console.log(`✓ hold ${w} -> ${out}/hold-${w}.png`)
  }
  if (errs.length) { console.log(`✗ page errors: ${errs.slice(0, 3).join(' | ')}`); fails++ }
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
