// ── M116c: the keeper body bench's TRY-ON pickers (Face / Mouth / female Torso), owner, desk 1280 + fits 390.
// Each option changes the turntable keeper; Save + reload keeps the choice; the proportions file is NOT touched; the choice
// is put back to the default at the end (data/keeper-bench.json, runtime, bench-only). Owner key needed.
//   OWNER_KEY=... npx tsx scripts/m116c-bench-tryon-check.mts [--url https://ather.games]
import puppeteer, { type Page } from 'puppeteer-core'
import { createHash } from 'crypto'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const KEY = process.env.OWNER_KEY
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
if (!KEY) { console.log('need OWNER_KEY'); process.exit(2) }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const p: Page = await br.newPage(); await p.setViewport({ width: 1280, height: 820 })
p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
const sig = () => p.$eval('[data-metrics]', e => e.getAttribute('data-sig') ?? '')
const click = (sel: string) => p.$eval(sel, e => (e as HTMLElement).click())
const on = (k: string) => p.evaluate((k: string) => Number(document.querySelector(`[data-pick^="${k}-"][data-on="1"]`)?.getAttribute('data-pick')?.split('-')[1] ?? -1), k)
const status = () => p.$eval('[data-status]', e => e.textContent ?? '')
const getJson = (path: string) => p.evaluate((u: string) => fetch(u, { cache: 'no-store' }).then(r => r.text()), path)
const canvasHash = async () => createHash('md5').update(await (await p.$('canvas'))!.screenshot({ encoding: 'binary' }) as Buffer).digest('hex')
async function open() {
  await p.goto(`${url}/shimmer/dev/keeper-body`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForSelector('[data-pick="face-0"]', { timeout: 240000 })
  await p.waitForFunction(() => !/loading/.test(document.querySelector('[data-status]')?.textContent ?? ''), { timeout: 60000 }); await sleep(1000)
}
try {
  await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'load', timeout: 120000 })
  const props0 = await getJson('/shimmer/save-keeper-proportions')
  await open()
  ok((await p.$$('[data-pick^="face-"]')).length === 5, 'Face picker: 5 (Classic + A-D)')
  ok((await p.$$('[data-pick^="mouth-"]')).length === 6, 'Mouth picker: Today + 5')
  ok((await p.$$('[data-pick^="torso-"]')).length === 0, 'Medium / Broad: no torso picker')
  await click('[data-model="medium-curved"]'); await sleep(600)
  ok((await p.$$('[data-pick^="torso-"]')).length === 4, 'Medium / Curved: Torso picker Today + T1-T3')
  const base = await sig(), seen = new Set([base])
  for (const [k, n] of [['face', 5], ['mouth', 6], ['torso', 4]] as const) {
    for (let i = 1; i < n; i++) {
      await click(`[data-pick="${k}-${i}"]`); await sleep(350)
      const s = await sig()
      ok(!seen.has(s) && await on(k) === i, `${k} ${i} changes the model (${s})`); seen.add(s)
    }
    await click(`[data-pick="${k}-0"]`); await sleep(350)
  }
  ok(await sig() === base, 'back on Today = today\'s model again')
  // the turntable itself redraws: stop the spin, T2 vs Today on the canvas
  await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Turntable')?.click()); await sleep(800)
  const h0 = await canvasHash(); await click('[data-pick="torso-2"]'); await sleep(1200); const h1 = await canvasHash()
  ok(h0 !== h1, 'the canvas redraws on a torso pick')
  // save a choice, reload, it stays; the proportions file is untouched
  await click('[data-pick="face-2"]'); await click('[data-pick="mouth-3"]'); await click('[data-pick="torso-3"]'); await sleep(500)
  const chosen = await sig()
  await click('[data-act="save"]'); await sleep(2000)
  ok(/saved/.test(await status()), `save: ${await status()}`)
  ok(JSON.parse(await getJson('/shimmer/save-keeper-bench')).models['medium-curved'].torso === 3, 'the bench file holds the choice')
  await open(); await click('[data-model="medium-curved"]'); await sleep(800)
  ok(await on('face') === 2 && await on('mouth') === 3 && await on('torso') === 3, 'reload keeps Face 2 / Mouth 3 / T3')
  ok(await sig() === chosen, 'reload rebuilds the same model')
  await click('[data-model="large-curved"]'); await sleep(400)
  ok(await on('face') === 0 && await on('mouth') === 0 && await on('torso') === 0, 'another model is untouched')
  ok(await getJson('/shimmer/save-keeper-proportions') === props0, 'the proportions file (what reaches the game) is untouched')
  await p.screenshot({ path: 'docs/looks/m116c-bench-tryon.png' })
  // 390: fits, pickers reachable
  await p.setViewport({ width: 390, height: 844 }); await sleep(1200)
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), '390: no sideways page scroll')
  ok(await p.$eval('[data-pick="mouth-5"]', e => { const r = e.getBoundingClientRect(); return r.width > 10 && r.right <= window.innerWidth + 1 }), '390: the pickers fit')
  await p.setViewport({ width: 1280, height: 820 })
  // put it back
  await click('[data-model="medium-curved"]'); await sleep(400)
  for (const k of ['face', 'mouth', 'torso']) await click(`[data-pick="${k}-0"]`)
  await sleep(400); await click('[data-act="save"]'); await sleep(2000)
  const back = JSON.parse(await getJson('/shimmer/save-keeper-bench')).models
  ok(Object.values(back).every((b: any) => !b.face && !b.mouth && !b.torso), 'restored: every model back on the default')
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 300)}`) }
ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
await br.close(); console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
