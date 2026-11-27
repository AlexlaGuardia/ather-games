// M152 s1: the DB2 Twins look-sheet shots (off in the game), from /shimmer/dev/gun-kit?twins=<view>. Also the prod check of the dev
// bench (owner): every view draws a canvas, the model reports both guns, no page errors.
//   OWNER_KEY=... npx tsx scripts/m152-twins-shots.mts --url http://localhost:3202 --out dir
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'http://localhost:3202'), out = flag('--out', '/tmp/m152')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const KEY = process.env.OWNER_KEY; if (!KEY) { console.log('OWNER_KEY not set'); process.exit(2) }
const br = await puppeteer.launch({ protocolTimeout: 120000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
let bad = 0
try {
  await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'load', timeout: 120000 })
  const VIEWS: [string, number, number][] = [['side', 1000, 520], ['top', 1000, 520], ['34', 1000, 600], ['core', 700, 520], ['hip', 1280, 760], ['ads', 1280, 760], ['hip', 390, 844], ['ads', 390, 844]]
  for (const [v, w, h] of VIEWS) {
    await p.setViewport({ width: w, height: h }); await p.goto(`${url}/shimmer/dev/gun-kit?twins=${v}`, { waitUntil: 'load', timeout: 240000 })
    const drawn = await p.waitForFunction((v: string) => (window as any).__twins?.view === v && !!document.querySelector('canvas'), { timeout: 120000 }, v).then(() => true).catch(() => false)
    if (!drawn) { bad++; console.log('NOT DRAWN', v, w); continue }
    await p.addStyleTag({ content: 'nextjs-portal,a[href="/shimmer/dev"]{display:none!important}' }); await sleep(2000)
    const info = await p.evaluate(() => (window as any).__twins)
    if (!(info.tris.left > 500 && info.tris.right === info.tris.left)) { bad++; console.log('MODEL', JSON.stringify(info)) }
    await p.screenshot({ path: `${out}/${v}-${w}.png` }); console.log('shot', v, w, JSON.stringify(info))
  }
} catch (e) { bad++; console.log(String(e)) } finally { await br.close() }
console.log('page errors', errs.length, errs.slice(0, 3).join(' | ')); console.log(bad || errs.length ? 'FAIL' : 'PASS'); process.exit(bad || errs.length ? 1 : 0)
