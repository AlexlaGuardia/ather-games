// ── The Ather sky at its four hours, photographed off a lane dev server ───────────────────────
// Run: npx tsx scripts/sky-shots.mts [outDir] [--port 3203]
//
// Drives `/shimmer/dev/sky` (the SHIPPED rig, clock pinned through `setTimePin`), clicks Dawn /
// Day / Dusk / Night, and shoots each, looking at the Core and then at the horizon, so canon's
// hand-off (the Core banks, the rim kindles) is judged in the pair, not one frame.
// ⚠ It FAILS on any console error: a GLSL compile error in the dome leaves a black sky, and a
// black sky at "Night" is exactly what a broken shader and a correct midnight have in common.
// Owner-gate handling is page-shot.mts's (see its header for why each waitUntil is what it is).
import puppeteer from 'puppeteer-core'
import { readFileSync, mkdirSync } from 'node:fs'

const args = process.argv.slice(2)
const flag = (n: string, d: string) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1] }
const outDir = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--port') ?? 'sky-shots'
const port = flag('--port', '3203')
mkdirSync(outDir, { recursive: true })

const key = /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim()
if (!key) { console.error('no OWNER_KEY in .env'); process.exit(1) }
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
const errors: string[] = []
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push(String(e)))
await page.setViewport({ width: 1280, height: 800 })
await page.goto(`http://localhost:${port}/owner?key=${key}`, { waitUntil: 'domcontentloaded' })
const res = await page.goto(`http://localhost:${port}/shimmer/dev/sky`, { waitUntil: 'load' })
if (!res || res.status() !== 200) { console.error(`✗ answered ${res?.status()}`); await browser.close(); process.exit(1) }
await new Promise(r => setTimeout(r, 6000))

const drag = async (dy: number) => {
  await page.mouse.move(640, 400); await page.mouse.down()
  await page.mouse.move(640, 400 + dy, { steps: 8 }); await page.mouse.up()
}
for (const label of ['Day', 'Dusk', 'Night', 'Dawn']) {
  await page.evaluate((l) => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent?.trim() === l) as HTMLButtonElement | undefined
    b?.click()
  }, label)
  await new Promise(r => setTimeout(r, 1500))
  await page.screenshot({ path: `${outDir}/${label.toLowerCase()}-core.png` })
  await drag(-160)          // tilt down to the horizon: the rim, the flecks, the ground
  await new Promise(r => setTimeout(r, 800))
  await page.screenshot({ path: `${outDir}/${label.toLowerCase()}-horizon.png` })
  await drag(160)
}
await browser.close()
if (errors.length) { console.error(`✗ ${errors.length} console error(s):\n  ` + errors.slice(0, 6).join('\n  ')); process.exit(1) }
console.log(`shot 8 frames → ${outDir}`)
