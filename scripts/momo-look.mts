// BETA M155 s2: Momo's bench, shot (front / side / back, beside Bonn). npx tsx scripts/momo-look.mts <outdir> [--url]
import puppeteer from 'puppeteer-core'
const KEY = process.env.OWNER_KEY, out = process.argv[2], i = process.argv.indexOf('--url'), url = i > 0 ? process.argv[i + 1] : 'https://ather.games'
const b = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
if (KEY) { const p = await b.newPage(); await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {}); await p.close() }
for (const [n, q] of [['momo-front-side-back', 'who=momo'], ['momo-beside-bonn', 'who=bonnmomo']]) {
  const p = await b.newPage(); await p.setViewport({ width: 1200, height: 800 })
  await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  await p.goto(`${url}/shimmer/dev/friends?${q}`, { waitUntil: 'domcontentloaded', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__friendBench, { timeout: 240000 }); await new Promise(r => setTimeout(r, 2500))
  console.log(n, await p.evaluate(() => (window as any).__friendBench.calls()), 'calls (ground 1)'); await p.screenshot({ path: `${out}/${n}.png` as `${string}.png` }); await p.close()
}
await b.close()
