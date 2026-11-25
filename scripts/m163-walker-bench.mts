// BETA M163 s1: pictures of the Walker off its bench (/shimmer/dev/walker): front / side / back, and each state, 390 + desktop.
//   OWNER_KEY=... npx tsx scripts/m163-walker-bench.mts --url http://localhost:3203 [--out docs/looks/m163-2026-11-25]
import puppeteer from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'http://localhost:3203'), out = flag('--out', 'docs/looks/m163-2026-11-25'), only = flag('--only', '')
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
let fails = 0
try {
  const p = await br.newPage(); p.on('pageerror', e => { fails++; console.log('pageerror', String(e).slice(0, 200)) })
  const KEY = process.env.OWNER_KEY   // the bench is owner-gated
  if (KEY) await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {})
  const shot = async (name: string, q: string, w: number, h: number) => { if (only && !name.includes(only)) return
    await p.setViewport({ width: w, height: h }); await p.goto(`${url}/shimmer/dev/walker?${q}`, { waitUntil: 'domcontentloaded', timeout: 240000 })
    await p.waitForFunction(() => (window as any).__walkerBench?.calls() > 0, { timeout: 120000 }); await new Promise(r => setTimeout(r, 1800))
    const calls = await p.evaluate(() => (window as any).__walkerBench.calls()); console.log(name, 'calls', calls)
    await p.screenshot({ path: `${out}/${name}.png` as `${string}.png` }) }
  await shot('rest-desk', '', 1100, 760)
  for (const a of ['tell', 'fall', 'walk', 'knock']) await shot(`${a}-desk`, `act=${a}`, 1100, 760)
  await shot('grey-desk', 'ground=77797c', 1100, 760)
  for (const [n, t] of [['front', 0], ['side', -90], ['back', 180]] as const) await shot(`${n}-390`, `turns=${t}`, 390, 844)
  for (const a of ['tell', 'fall']) await shot(`${a}-390`, `act=${a}&turns=-60`, 390, 844)
} finally { await br.close() }
process.exit(fails ? 1 : 0)
