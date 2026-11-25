// BETA M162: the named Moglins' bench, shot (front / side / back each, the line, a phone line) + draw calls.
//   npx tsx scripts/moglin-looks.mts <outdir> [--url https://ather.games] [--quick]
import puppeteer from 'puppeteer-core'
import { existsSync, readFileSync } from 'fs'
import { MOGLIN_LOOKS, MOGLIN_LOOK_CALLS } from '../src/app/shimmer/open/shared/moglin-figure'
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)   // the bench is owner-gated
const out = process.argv[2], i = process.argv.indexOf('--url'), url = i > 0 ? process.argv[i + 1] : 'https://ather.games', quick = process.argv.includes('--quick')
const b = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
if (KEY) { const p = await b.newPage(); await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {}); await p.close() }
const shot = async (name: string, q: string, w = 1300, h = 640) => {
  const p = await b.newPage(); await p.setViewport({ width: w, height: h }); p.on('pageerror', e => errs.push(`${name}: ${String(e).slice(0, 200)}`))
  await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  await p.goto(`${url}/shimmer/dev/moglin-looks?${q}`, { waitUntil: 'domcontentloaded', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__moglinBench, { timeout: 240000 }); await new Promise(r => setTimeout(r, 2500))
  const calls = await p.evaluate(() => (window as any).__moglinBench.calls())
  await p.screenshot({ path: `${out}/${name}.png` as `${string}.png` }); console.log(`${name}: ${calls} draw calls`)
  if (calls !== 1 + 3 * MOGLIN_LOOK_CALLS) errs.push(`${name}: ${calls} calls, not the ground + 3 x ${MOGLIN_LOOK_CALLS}`)
  await p.close()
}
for (const who of MOGLIN_LOOKS) await shot(`${who}-front-side-back`, `who=${who}`)
if (!quick) { for (const who of MOGLIN_LOOKS) await shot(`${who}-front-side-back-phone`, `who=${who}`, 390, 844); for (const a of ['waddle', 'wave']) await shot(`line-${a}`, `action=${a}`); await shot('line-up', ''); await shot('line-up-back', 'turn=180') }
console.log(errs.length ? errs.join('\n') : 'no page errors'); await b.close(); process.exit(errs.length ? 1 : 0)
