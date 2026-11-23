// BETA M103: the keeper body bench's proportion sliders. A dial moves its part live, reset restores it, Save writes the file
// and a reload keeps it, Reset all + Save puts the file back to today's body; the 11-17 doll tab still renders.
// ⚠ WRITES keeper-proportions.json on the target (then restores it to {}): run it on a DEVWIN, never prod.
//   set -a; . ./.env; set +a; tools/coord.sh browser up m103; npx tsx scripts/m103-proportions-check.mts --url http://localhost:3202; tools/coord.sh browser down
import puppeteer, { type Page } from 'puppeteer-core'
import { readFileSync } from 'fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'http://localhost:3202')
if (/ather\.games/.test(url)) { console.log('this check writes the proportions file: devwin only'); process.exit(2) }
const KEY = process.env.OWNER_KEY
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const p = await br.newPage(); await p.setViewport({ width: 1280, height: 820 })
p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
const headY = () => p.$eval('[data-metrics]', e => Number(e.getAttribute('data-head-y')))
const dial = (k: string) => p.$eval(`[data-dial="${k}"]`, e => Number((e as HTMLInputElement).value))
const setDial = (k: string, v: number) => p.evaluate((k: string, v: number) => {
  const el = document.querySelector<HTMLInputElement>(`[data-dial="${k}"]`)!
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, String(v))
  el.dispatchEvent(new Event('input', { bubbles: true }))
}, k, v)
const click = (sel: string) => p.$eval(sel, e => (e as HTMLElement).click())
const status = () => p.$eval('[data-status]', e => e.textContent ?? '')
async function open() {
  await p.goto(`${url}/shimmer/dev/keeper-body`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForSelector('[data-dial="neck"]', { timeout: 240000 })
  await p.waitForFunction(() => !/loading/.test(document.querySelector('[data-status]')?.textContent ?? ''), { timeout: 60000 }); await sleep(800)
}
try {
  if (KEY) await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'load', timeout: 120000 })
  await open()
  ok((await p.$$('[data-model]')).length === 6, '6 model chips')
  ok((await p.$$('[data-dial]')).length >= 15, `a slider per dial (${(await p.$$('[data-dial]')).length})`)
  const h0 = await headY()
  await setDial('neck', 0.2); await sleep(400)
  const h1 = await headY()
  ok(Math.abs(h1 - h0 - 0.2) < 1e-3, `neck gap moves the head live (${h0} -> ${h1})`)
  await setDial('torsoL', 1.4); await sleep(400)
  ok(await headY() > h1 + 0.05, 'torso length carries the head up')
  await click('[data-reset="neck"]'); await click('[data-reset="torsoL"]'); await sleep(400)
  ok(Math.abs(await headY() - h0) < 1e-4 && await dial('neck') === 0, 'reset restores the dial and the head')
  // save on small-curved, reload, it stays
  await click('[data-model="small-curved"]'); await sleep(400)
  await setDial('headW', 0.9); await setDial('legs', 1.25); await setDial('jaw', 0.6); await sleep(400)
  await click('[data-act="save"]'); await sleep(1500)
  ok(/saved/.test(await status()), `save: ${await status()}`)
  const file = JSON.parse(readFileSync('src/app/shimmer/open/shared/keeper-proportions.json', 'utf-8'))
  ok(JSON.stringify(file) === JSON.stringify({ 'small-curved': { headW: 0.9, jaw: 0.6, legs: 1.25 } }), `file holds only what changed: ${JSON.stringify(file)}`)
  await open(); await click('[data-model="small-curved"]'); await sleep(500)
  ok(await dial('headW') === 0.9 && await dial('legs') === 1.25 && await dial('jaw') === 0.6, 'reload keeps the saved dials')
  await click('[data-model="medium-broad"]'); await sleep(300)
  ok(await dial('headW') === 1, 'another model is untouched')
  // restore the file
  await click('[data-model="small-curved"]'); await sleep(300)
  await click('[data-act="reset-model"]'); await sleep(300); await click('[data-act="save"]'); await sleep(1500)
  ok(readFileSync('src/app/shimmer/open/shared/keeper-proportions.json', 'utf-8') === '{}\n', 'Reset all + Save puts the file back to {}')
  await click('[data-tab="doll"]'); await sleep(1500)
  ok(!!(await p.$('[data-action="walk"]')), 'the 11-17 doll vs Rayman tab still renders')
  await p.setViewport({ width: 390, height: 844 }); await click('[data-tab="proportions"]'); await sleep(1200)
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'phone width: no sideways page scroll')
  await p.screenshot({ path: 'docs/looks/m103-proportions-phone.png' })
  await p.setViewport({ width: 1280, height: 820 }); await setDial('headW', 0.82); await setDial('jaw', 0.8); await setDial('legs', 1.35); await sleep(1500)
  await p.screenshot({ path: 'docs/looks/m103-proportions-bench.png' })
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 300)}`) }
ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
await br.close(); console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
