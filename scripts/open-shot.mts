// ── Screenshot the open-world walking slice (/shimmer/open) looking a chosen way ──────────────────────────
// Run: npx tsx scripts/open-shot.mts <out.png> [--url https://ather.games] [--yaw 1.5708] [--pitch -0.05] [--hour 13]
// yaw 0 looks north (−z), +π/2 west, −π/2 east. Software GL, so frame rates mean nothing.
import puppeteer from 'puppeteer-core'
const args = process.argv.slice(2)
const flag = (n: string, d: string) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1] }
const out = args.find(a => a.endsWith('.png')) ?? 'open-shot.png'
const b = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1280, height: 760 })
  const r = await p.goto(`${flag('--url', 'https://ather.games')}/shimmer/open?hour=${flag('--hour', '13')}`, { waitUntil: 'load', timeout: 120000 })
  if (!r || r.status() !== 200) { console.error('✗', r?.status()); process.exit(1) }
  await p.waitForFunction('!!window.__open', { timeout: 60000 })
  await p.evaluate((y: number, pt: number) => (window as unknown as { __open: { look: (a: number, b: number) => void } }).__open.look(y, pt), Number(flag('--yaw', '0')), Number(flag('--pitch', '-0.05')))
  await new Promise(res => setTimeout(res, 3500))
  await p.screenshot({ path: out })
  console.log('shot →', out)
} finally { await b.close() }
