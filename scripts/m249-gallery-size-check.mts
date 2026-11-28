// BETA M249 (assets, 2026-11-28): THE GALLERY SIZE SLIDER + THE KEEPER FOR SCALE. OWNER desktop (/shimmer/dev gate).
// /shimmer/dev?mode=spirits&spirit=<n> (default #55 Vulnarkor): the keeper stands beside her (both heights read off the scene in
// WORLD units, data-gallery-spirit-h / -keeper-h), the slider resizes her live (her measured height x the slider, the keeper's
// unchanged), the value survives a reload (device key open:gallery-size.v1), Copy values gives the size table's line, Reset
// clears it; 0 page / console errors.
//   OWNER_KEY=... npx tsx scripts/m249-gallery-size-check.mts [--url https://ather.games] [--spirit 55] [--shots dir]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { GALLERY } from '../src/app/shimmer/dev/editors/spirit-gallery'
import { AWAKEN_GROW } from '../src/app/shimmer/open/ather/spirit-models'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), shots = flag('--shots', ''), KEY = process.env.OWNER_KEY, num = Number(flag('--spirit', '55'))
if (shots) mkdirSync(shots, { recursive: true })
if (!KEY) { console.error('no OWNER_KEY'); process.exit(2) }
const row = GALLERY[num - 1]
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms)); let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const errs: string[] = [], cerrs: string[] = []
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
const p: Page = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1440, height: 900 })
p.on('pageerror', e => errs.push(String(e).slice(0, 300)))
p.on('console', m => { if (m.type() === 'error') cerrs.push(m.text().slice(0, 300)) })
await p.evaluateOnNewDocument('window.__name = (f) => f')
await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
await sleep(1500); errs.length = 0; cerrs.length = 0
await p.evaluateOnNewDocument(() => { const f = window.fetch.bind(window); window.fetch = (u, i) => ((i?.method ?? 'GET').toUpperCase() !== 'GET') ? Promise.resolve(new Response('{}', { status: 200 })) : f(u, i); navigator.sendBeacon = () => true })
const page = `${url}/shimmer/dev?mode=spirits&spirit=${num}`
await p.goto(page, { waitUntil: 'load', timeout: 240000 })
await p.evaluate(() => { try { localStorage.removeItem('open:gallery-size.v1') } catch { /* */ } })
await p.reload({ waitUntil: 'load', timeout: 240000 })
await p.waitForSelector('[data-gallery-size]', { timeout: 120000 }).catch(() => {})

const read = () => p.evaluate(() => {
  const e = document.querySelector('[data-gallery-size]') as HTMLElement | null, d = e?.dataset ?? {}
  const sl = document.querySelector('[data-gallery-size-slider]') as HTMLInputElement | null
  let saved = ''; try { saved = localStorage.getItem('open:gallery-size.v1') ?? '' } catch { /* */ }
  return { slot: d.gallerySize ?? '', scale: Number(d.galleryScale ?? 0), design: Number(d.galleryDesignH ?? 0), sh: Number(d.gallerySpiritH ?? 0), kh: Number(d.galleryKeeperH ?? 0),
    kx: Number(d.galleryKeeperX ?? 0), slider: sl ? Number(sl.value) : -1, saved, line: document.querySelector('[data-gallery-size-line]')?.textContent ?? '',
    title: document.querySelector('[data-gallery-title]')?.textContent ?? '' }
})
/** wait until both figures are measured and her height has held still (the model loads, the slider re-measures twice a second) */
async function settled(min = 0) {
  let s = await read(), last = -1, t0 = Date.now()
  while (Date.now() - t0 < 60000) {
    s = await read()
    if (s.sh > min && s.kh > 0 && Math.abs(s.sh - last) < 0.002) break
    last = s.sh; await sleep(1200)
  }
  return s
}
const setSlider = (v: number) => p.evaluate((v: number) => {
  const el = document.querySelector('[data-gallery-size-slider]') as HTMLInputElement
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, String(v)); el.dispatchEvent(new Event('input', { bubbles: true }))
}, v)

const a = await settled()
ok(a.title.toLowerCase() === row.name.toLowerCase() && a.slot !== '', `#${num} ${row.name}: size row up (slot ${a.slot})`)
ok(a.kh >= 1.4 && a.kh <= 2.0, `the keeper stands beside her at true scale: ${a.kh.toFixed(3)} m tall (world units), at x ${a.kx}`)
// (her table number is a SCALE (h = the glb's unit), not her standing height: a biped on Vulnara's units stands ~1.7x it)
ok(a.sh > 0.3 && a.sh < 4, `her measured height ${a.sh.toFixed(3)} m (the rig's own size() x the stage scale; table h ${a.design.toFixed(3)}), keeper ${a.kh.toFixed(3)} m`)
if (shots) await p.screenshot({ path: `${shots}/a-x1.png` })

await setSlider(1.5); await sleep(800)
const b = await settled(a.sh * 1.2)
ok(Math.abs(b.scale - 1.5) < 1e-6 && Math.abs(b.design / a.design - 1.5) < 0.01, `slider x1.50: table height ${a.design} -> ${b.design}`)
ok(Math.abs(b.sh / a.sh - 1.5) < 0.04, `she resizes LIVE: measured ${a.sh.toFixed(3)} -> ${b.sh.toFixed(3)} m (x${(b.sh / a.sh).toFixed(3)})`)
ok(Math.abs(b.kh - a.kh) < 0.03, `the keeper keeps his height (his idle float aside): ${b.kh.toFixed(3)} m`)
ok(b.kx < a.kx + 1e-6 && b.kx < 0, `the keeper steps clear of her as she grows: x ${a.kx} -> ${b.kx}`)
ok(b.saved.includes(`"${b.slot}":1.5`), `saved on this browser: ${b.saved}`)
if (shots) await p.screenshot({ path: `${shots}/b-x150.png` })

await p.reload({ waitUntil: 'load', timeout: 240000 }); await p.waitForSelector('[data-gallery-size]', { timeout: 120000 }).catch(() => {})
const c = await settled(a.sh * 1.2)
ok(Math.abs(c.scale - 1.5) < 1e-6 && Math.abs(c.slider - 1.5) < 1e-6 && Math.abs(c.sh / a.sh - 1.5) < 0.04, `survives reload: x${c.scale}, slider ${c.slider}, measured ${c.sh.toFixed(3)} m`)

await p.click('[data-gallery-size-copy]'); await sleep(500)
const d = await read()
const aw = row.aw ? AWAKEN_GROW[row.aw.look] : null
const want = aw != null ? `${row.aw!.look}: ${Math.round(aw * 1.5 * 100) / 100},` : ''
ok(d.line.includes('AWAKEN_GROW') || d.line.includes('FORM_GROW_BY') || d.line.includes('GROWN'), `Copy values names the table: ${JSON.stringify(d.line)}`)
ok(!want || d.line.includes(want), `Copy values gives the table line ${want || '(not an awakened row)'}`)

await p.click('[data-gallery-size-reset]'); await sleep(800)
const e = await settled()
ok(Math.abs(e.scale - 1) < 1e-6 && Math.abs(e.slider - 1) < 1e-6 && !e.saved.includes(`"${e.slot}"`), `Reset clears: x${e.scale}, saved '${e.saved}'`)
ok(Math.abs(e.sh / a.sh - 1) < 0.04, `Reset: back to ${e.sh.toFixed(3)} m`)
if (shots) await p.screenshot({ path: `${shots}/c-reset.png` })

ok(errs.length === 0, `page errors: ${errs.length} ${errs.slice(0, 4).join(' | ')}`)
ok(cerrs.length === 0, `console errors: ${cerrs.length} ${cerrs.slice(0, 4).join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0)
