// M178 (Alex 11-25: "a fan of the iron sights minimilistic feel"): EVERY GUN AIMS DOWN A PAIR OF IRONS BY DEFAULT. A FRESH test keeper
// (new browser context, never Alex's save) holding every gun, desktop, in the Wilds: for each gun, draw it, shoot the hip, aim (right
// mouse) to full ADS, then assert: the gun is on irons (key + optic), the model stays up (no scope ring takes the screen, no
// [data-hud="scope"] overlay), and the FRONT POST's tip projects to within POST_PX px of screen centre. Shots (hip + ADS per gun) to
// --out, then one sheet. Zero page errors.
//   npx tsx scripts/m178-irons-check.mts [--url https://ather.games] [--out docs/looks/m178-2026-11-27]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { dismissStartCard } from './lib/start-card.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m178-irons')
mkdirSync(out, { recursive: true })
const W = 1280, H = 760, POST_PX = 3
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const PAIRS: [string, string][] = [['backbone', 'repeater'], ['charred-rifle', 'spitter'], ['lance', 'roar']]
const ALL = PAIRS.flat()
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const rows: Record<string, any> = {}
for (const [prim, sec] of PAIRS) {
  const ctx = await br.createBrowserContext()   // a fresh keeper every time: nothing carries over, nothing of Alex's
  const p = await ctx.newPage(); await p.setViewport({ width: W, height: H })
  p.on('pageerror', e => errs.push(`${prim}: ${String(e).slice(0, 200)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((prim: string, sec: string, all: string[]) => {
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.loadout.v1', JSON.stringify({ v: 1, guns: all, primary: prim, secondary: sec, kael: true,
      vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: null }], tactical: 'starter-bracelet', signature: 'starter-glove' }))
  }, prim, sec, ALL)
  const G = () => p.evaluate(() => { const g = (window as any).__fpGun; return g ? { shown: g.shown(), key: g.key(), ads: +g.ads().toFixed(2), optic: g.optic(), irons: g.irons?.() ?? null, post: g.post?.() ?? null, aim: g.aim() } : null })
  const ring = () => p.$('[data-hud="scope"]').then(Boolean)
  const poll = async (fn: () => Promise<boolean>, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(150) } return false }
  const tapR = async () => { await p.keyboard.down('KeyR'); await sleep(80); await p.keyboard.up('KeyR'); await sleep(600) }
  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  await dismissStartCard(p)
  await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__fpGun, { timeout: 240000 }); await sleep(4000)
  await p.mouse.click(W / 2, H / 2); await sleep(800)
  for (const [i, id] of [prim, sec].entries()) {
    await tapR()   // the first tap draws the primary; the second swaps to the secondary
    await poll(async () => { const g = await G(); return !!g?.shown && String(g.key).startsWith(`${id}:`) })
    await sleep(700)
    const hip = await G()
    await p.screenshot({ path: `${out}/${id}-hip.png` })
    await p.mouse.down({ button: 'right' })
    const reached = await poll(async () => ((await G())?.ads ?? 0) >= 0.99)
    await sleep(900)   // the DOM ring (if any) renders a frame after full ADS; let any sway settle
    const ads = await G(), ringUp = await ring()
    await p.screenshot({ path: `${out}/${id}-ads.png` })
    await p.mouse.up({ button: 'right' }); await poll(async () => ((await G())?.ads ?? 1) <= 0.01)
    const px = ads?.post ? [ads.post[0] * W / 2, ads.post[1] * H / 2] : null
    rows[id] = { slot: i ? 'secondary' : 'primary', hipKey: hip?.key, reached, key: ads?.key, optic: ads?.optic, irons: ads?.irons, shown: ads?.shown, ringUp,
      postPx: px?.map(v => +v.toFixed(2)) ?? null, aimPx: ads?.aim ? [+(ads.aim[0] * W / 2).toFixed(2), +(ads.aim[1] * H / 2).toFixed(2)] : null }
    rows[id].pass = !!reached && String(ads?.key).startsWith(`${id}:irons`) && (ads?.optic === 'irons' || ads?.optic === 'irons-long') && ads?.irons === true
      && ads?.shown === true && !ringUp && !!px && Math.abs(px[0]) <= POST_PX && Math.abs(px[1]) <= POST_PX
  }
  await ctx.close()
}
console.log(JSON.stringify({ url, rows, pageErrors: errs }, null, 1))
for (const [id, r] of Object.entries(rows)) console.log(`${r.pass ? 'ok  ' : 'FAIL'} ${id.padEnd(14)} ${String(r.optic).padEnd(10)} post ${JSON.stringify(r.postPx)} px from centre · ring ${r.ringUp ? 'UP' : 'none'} · model ${r.shown ? 'up' : 'hidden'}`)
const pass = ALL.every(id => rows[id]?.pass) && errs.length === 0
console.log(pass ? 'PASS' : 'FAIL'); await br.close(); process.exit(pass ? 0 : 1)
