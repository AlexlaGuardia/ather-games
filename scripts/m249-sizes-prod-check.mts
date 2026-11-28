// BETA M249 s2 (sprites, 2026-11-28): ALEX'S SIZE PASS IS LIVE. OWNER desktop gallery, a FRESH profile with open:gallery-size.v1
// CLEARED (slider = x1), so what the stage draws is the table alone: each sampled form's drawn design height (data-gallery-design-h =
// look.h x slider) must equal her look.h from the committed tables (new values), and differ from the pre-pass height (look.h / his
// slider) by his factor. Also: the rig is measured (data-gallery-spirit-h > 0), 0 page / console errors. Never Alex's browser.
//   OWNER_KEY=... npx tsx scripts/m249-sizes-prod-check.mts [--url https://ather.games]
import puppeteer, { type Page } from 'puppeteer-core'
import { readFileSync } from 'fs'
import { GALLERY } from '../src/app/shimmer/dev/editors/spirit-gallery'
import { SECOND_FORMS, AWAKENED_FORMS } from '../src/app/shimmer/open/ather/spirit-models'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), KEY = process.env.OWNER_KEY
if (!KEY) { console.error('no OWNER_KEY'); process.exit(2) }
const sizes: Record<string, number> = JSON.parse(readFileSync('docs/looks/m249-sizes-2026-11-28/alex-gallery-sizes.json', 'utf8'))
const formH: Record<string, number> = {}
for (const byEl of Object.values(SECOND_FORMS)) for (const L of Object.values(byEl ?? {})) if (L?.name) formH[L.name] = L.h
const SAMPLE: [string, 'form' | 'awakened'][] = [['voltari', 'form'], ['luminel', 'form'], ['vulnitar', 'awakened'], ['mesamun', 'awakened'], ['croakarkor', 'awakened'], ['tidowrok', 'awakened']]
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
  let first = true
  for (const [name, kind] of SAMPLE) {
    const row = GALLERY.find(r => r.name.toLowerCase() === name)
    if (!row) { ok(false, `${name}: no gallery row`); continue }
    const want = kind === 'form' ? formH[name] : AWAKENED_FORMS[name]?.h, s = sizes[`${kind}:${name}`]
    await p.goto(`${url}/shimmer/dev?mode=spirits&spirit=${row.num}`, { waitUntil: 'load', timeout: 240000 })
    if (first) { await p.evaluate(() => { try { localStorage.removeItem('open:gallery-size.v1') } catch { /* */ } }); await p.reload({ waitUntil: 'load', timeout: 240000 }); first = false }
    await p.waitForSelector('[data-gallery-size]', { timeout: 120000 }).catch(() => {})
    let d = { slot: '', scale: 0, design: 0, sh: 0, saved: '' }; const t0 = Date.now()
    while (Date.now() - t0 < 90000) {
      d = await p.evaluate(() => { const e = document.querySelector('[data-gallery-size]') as HTMLElement | null, x = e?.dataset ?? {}
        let saved = ''; try { saved = localStorage.getItem('open:gallery-size.v1') ?? '' } catch { /* */ }
        return { slot: x.gallerySize ?? '', scale: Number(x.galleryScale ?? 0), design: Number(x.galleryDesignH ?? 0), sh: Number(x.gallerySpiritH ?? 0), saved } })
      if (d.sh > 0) break; await sleep(1500)
    }
    ok(d.slot === `${kind}:${name}` && d.scale === 1 && d.saved === '', `#${row.num} ${name}: slot ${d.slot}, slider x${d.scale}, storage '${d.saved}' (fresh)`)
    ok(want != null && Math.abs(d.design - want) < 0.0015, `${name}: drawn table height ${d.design} m = new table ${want?.toFixed(3)} m (pre-pass ${(want! / s).toFixed(3)} m, x${s})`)
    ok(d.sh > 0, `${name}: rig measured ${d.sh} m`)
  }
  ok(errs.length === 0, `page errors: ${errs.length} ${errs.slice(0, 4).join(' | ')}`)
  ok(cerrs.length === 0, `console errors: ${cerrs.length} ${cerrs.slice(0, 4).join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `m249-sizes-prod-check: ${fails} FAIL` : 'm249-sizes-prod-check: PASS'); process.exit(fails ? 1 : 0)
