// M150 family pass (11-28): shots of the bench guns. Side on from /shimmer/dev/gun-kit?family=bench (one gun, or `all` = every bench
// gun), and in hand on the Gun Tuner (/shimmer/dev/guns, New model, hip) at desk 1280 and phone 390. Owner pages. Asserts: every page
// drew (window.__bench / __fpGun keyed to the gun) and 0 page errors.
//   OWNER_KEY=... npx tsx scripts/m150-family-pass-shots.mts URL OUTDIR all,spitter,twins [--side-only]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { dismissStartCard } from './lib/start-card.mts'
const url = process.argv[2] ?? 'https://ather.games', out = process.argv[3] ?? '/tmp/m150fp', guns = (process.argv[4] ?? 'all').split(',').filter(Boolean)
const sideOnly = process.argv.includes('--side-only')
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY; if (!KEY) { console.log('OWNER_KEY not set'); process.exit(2) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
let bad = 0
const say = (ok: boolean, m: string) => { if (!ok) bad++; console.log(ok ? 'ok  ' : 'FAIL', m) }
const HIDE = 'nextjs-portal,a[href="/shimmer/dev"]{display:none!important}'
try {
  await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'load', timeout: 240000 })
  const L = Math.PI / 2
  for (const a of guns) {
    const g = a === 'all' ? '' : a
    await p.setViewport(g ? { width: 900, height: 420 } : { width: 1400, height: 1240 })
    await p.goto(`${url}/shimmer/dev/gun-kit?family=bench&yaw=${L}${g ? `&gun=${g}` : ''}`, { waitUntil: 'load', timeout: 300000 })
    const drew = await p.waitForFunction(() => !!(window as any).__bench && !!document.querySelector('canvas'), { timeout: 240000 }).then(() => true).catch(() => false)
    const ids = drew ? await p.evaluate(() => (window as any).__bench.ids as string[]) : []
    say(drew && (g ? ids.length === 1 && ids[0] === g : ids.length === 8), `side ${a}: drew ${ids.join(',')}`)
    await p.addStyleTag({ content: HIDE }); await sleep(2000)
    await p.screenshot({ path: `${out}/${a}-side.png` })
    if (!g || sideOnly) continue
    for (const [tag, vp] of [['desk', { width: 1280, height: 760 }], ['390', { width: 390, height: 844, isMobile: true, hasTouch: true }]] as const) {
      await p.setViewport(vp)
      await p.goto(`${url}/shimmer/dev/guns?gun=${g}&set=new&preview=hip`, { waitUntil: 'load', timeout: 300000 })
      await dismissStartCard(p).catch(() => false)
      const held = await p.waitForFunction((g: string) => { const f = (window as any).__fpGun; return !!f && String(f.key()).startsWith(g + ':') }, { timeout: 240000 }, g).then(() => true).catch(() => false)
      say(held, `${a} in hand (${tag}): ${held ? await p.evaluate(() => (window as any).__fpGun.key()) : 'not drawn'}`)
      await p.addStyleTag({ content: HIDE }); await sleep(1800)
      await p.screenshot({ path: `${out}/${a}-hand-${tag}.png` })
    }
  }
} catch (e) { bad++; console.log(String(e)) } finally { await br.close() }
console.log('page errors', errs.length, errs.slice(0, 3).join(' | ')); console.log(bad || errs.length ? 'FAIL' : 'PASS'); process.exit(bad || errs.length ? 1 : 0)
