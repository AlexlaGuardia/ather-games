// BETA M4 probe: a fresh born keeper looks around the plot; screenshots at four headings show whether Greg's beacon + trail are lit.
//   npx tsx scripts/beta-m4-look.mts <url> <outdir>
import puppeteer from 'puppeteer-core'
const [url = 'https://ather.games', out = '/tmp/m4'] = process.argv.slice(2)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ protocolTimeout: 240000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.createBrowserContext(); const p = await ctx.newPage()
await p.setViewport({ width: 960, height: 600 })
await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__ather?.look, { timeout: 240000 }); await sleep(5000)
console.log('journal prefs stored:', await p.evaluate(() => localStorage.getItem('open.journal.v1')))
for (const [i, yaw] of [0, Math.PI / 2, Math.PI, -Math.PI / 2].entries()) {
  await p.evaluate((y: number) => (window as any).__ather.look(y, -0.15), yaw); await sleep(2500)
  await p.screenshot({ path: `${out}/yaw-${i}.png` })
}
await b.close()
