// BETA M166: the Greg + Blue bench, shot (Greg front / side / back standing and seated, Blue the same, the pair, a phone
// view, each action) + draw calls old and new.
//   npx tsx scripts/greg-blue-look.mts <outdir> [--url https://ather.games] [--quick]
import puppeteer from 'puppeteer-core'
import { existsSync, readFileSync } from 'fs'
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)   // the bench is owner-gated
const out = process.argv[2], i = process.argv.indexOf('--url'), url = i > 0 ? process.argv[i + 1] : 'https://ather.games', quick = process.argv.includes('--quick')
const b = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = [], calls: Record<string, number> = {}
if (KEY) { const p = await b.newPage(); await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {}); await p.close() }
const shot = async (name: string, q: string, w = 1400, h = 1000) => {
  const p = await b.newPage(); await p.setViewport({ width: w, height: h }); p.on('pageerror', e => errs.push(`${name}: ${String(e).slice(0, 200)}`))
  await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  await p.goto(`${url}/shimmer/dev/greg-blue?${q}`, { waitUntil: 'domcontentloaded', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__gregBench, { timeout: 240000 }); await new Promise(r => setTimeout(r, q.includes('blue') || q.includes('pair') ? 6000 : 2500))
  calls[name] = await p.evaluate(() => (window as any).__gregBench.calls())
  await p.screenshot({ path: `${out}/${name}.png` as `${string}.png` }); console.log(`${name}: ${calls[name]} draw calls`)
  await p.close()
}
await shot('greg-front-side-back', ''); await shot('greg-sit', 'pose=sit'); await shot('blue-front-side-back', 'who=blue'); await shot('pair', 'who=pair')
if (!quick) {
  await shot('greg-old', 'old=1'); await shot('greg-old-sit', 'old=1&pose=sit'); await shot('blue-rest', 'who=blue&clip=lie')
  for (const a of ['talk', 'wave', 'walk']) await shot(`greg-${a}`, `action=${a}`)
  await shot('greg-phone', 'turn=0', 390, 844); await shot('greg-phone-side', 'turn=90', 390, 844); await shot('greg-phone-back', 'turn=180', 390, 844); await shot('blue-phone', 'who=blue&turn=-60', 390, 844); await shot('pair-phone', 'who=pair', 390, 844)
  const per = (n: string) => (calls[n] - 1) / 3
  console.log(`a Greg: ${per('greg-old')} draw calls before, ${per('greg-front-side-back')} after (seated ${per('greg-old-sit')} -> ${per('greg-sit')}); Blue ${per('blue-front-side-back')}`)
}
console.log(errs.length ? errs.join('\n') : 'no page errors'); await b.close(); process.exit(errs.length ? 1 : 0)
