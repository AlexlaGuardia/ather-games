// M81 BLOCKOUT SHOTS for Alex's look (/shimmer/dev/gun-kit): the sheet (both guns x each sight, side on), each combo on the bench
// from two sides, and each combo in hand at the hip and in the sights through the game's rig. Zero page errors, the rig drawn.
//   npx tsx scripts/gun-kit-shots.mts [--url http://localhost:3202] [--out dir] [--phone]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'http://localhost:3202'), out = flag('--out', '/tmp/gun-kit'), phone = process.argv.includes('--phone')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport(phone ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1280, height: 760 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
const COMBOS: [string, string[]][] = [['backbone', ['hood', 'lens', 'scope2']], ['charred-rifle', ['ring', 'lens', 'scope2']]]
const res: Record<string, unknown> = { url, phone }
let n = 0
const shot = async (q: string, name: string, settle = 1500) => {
  await p.goto(`${url}/shimmer/dev/gun-kit?${q}`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__gunKit && !!document.querySelector('canvas'), { timeout: 240000 })
  if (q.includes('view=hip') || q.includes('view=aim')) {
    const fp = await p.waitForFunction(() => { const g = (window as any).__fpGun; return g && g.key() ? { key: g.key(), ads: g.ads(), shown: g.shown() } : null }, { timeout: 60000 }).then(h => h.jsonValue()).catch(() => null)
    if (q.includes('view=aim')) await p.waitForFunction(() => (window as any).__fpGun?.ads() >= 0.99, { timeout: 20000 }).catch(() => {})
    res[name] = fp
  }
  await sleep(settle); n++
  await p.screenshot({ path: `${out}/${String(n).padStart(2, '0')}-${name}.png` })
}
await shot('view=sheet', 'sheet', 2500)
for (const [gun, sights] of COMBOS) for (const s of sights) {
  await shot(`view=turn&gun=${gun}&sight=${s}&yaw=-1.2`, `${gun}-${s}-right`)
  await shot(`view=turn&gun=${gun}&sight=${s}&yaw=-2.1`, `${gun}-${s}-left`)
  await shot(`view=hip&gun=${gun}&sight=${s}`, `${gun}-${s}-hip`)
  await shot(`view=aim&gun=${gun}&sight=${s}`, `${gun}-${s}-aim`)
}
res.errs = errs
const inHand = Object.entries(res).filter(([k]) => /-(hip|aim)$/.test(k))
const drawn = inHand.every(([k, v]) => !!v && String((v as any).key).includes(':p'))
console.log(JSON.stringify(res))
const pass = n === 25 && drawn && errs.length === 0
console.log(pass ? `PASS: ${n} shots in ${out}, every in-hand view drew the kit model` : 'FAIL')
await br.close(); process.exit(pass ? 0 : 1)
