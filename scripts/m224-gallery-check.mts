// BETA M224 (sprites, 2026-11-27): THE SPIRIT GALLERY, EVERY ROW SHOWS SOMETHING. Alex 11-27: "a few broken links there.. like the
// hovari line has niether model or image". OWNER (/shimmer/dev gate). /shimmer/dev?mode=spirits, the dial stepped row by row
// (ArrowDown, as Alex turns it), and for each of the 50 rows:
//   model rows (data-gallery-state=model): her glb is fetched and her body is up (the probe's 'gallery' rig, skinned vertices) AND
//     the stage canvas draws pixels that are not the empty backdrop (a model that throws or never mounts leaves the stage empty)
//   art rows (data-gallery-state=art): the locked art <img> has loaded (naturalWidth > 0)
// plus 0 page errors and 0 console errors over the whole run.
//   OWNER_KEY=... npx tsx scripts/m224-gallery-check.mts [--url https://ather.games] [--shots dir] [--w 1440 --h 900] [--from 1]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { GALLERY } from '../src/app/shimmer/dev/editors/spirit-gallery'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), shots = flag('--shots', ''), KEY = process.env.OWNER_KEY
const W = Number(flag('--w', '1440')), H = Number(flag('--h', '900')), from = Number(flag('--from', '1'))
if (shots) mkdirSync(shots, { recursive: true })
if (!KEY) { console.error('no OWNER_KEY'); process.exit(2) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms)); let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const errs: string[] = [], cerrs: string[] = []
const br = await puppeteer.launch({ protocolTimeout: 900000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
const p: Page = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: W, height: H })
p.on('pageerror', e => errs.push(String(e).slice(0, 300)))
p.on('console', m => { if (m.type() === 'error') cerrs.push(m.text().slice(0, 300)) })
await p.evaluateOnNewDocument('window.__name = (f) => f')
await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
// the owner page itself is not under test: its console noise is dropped
await sleep(1500); errs.length = 0; cerrs.length = 0
await p.evaluateOnNewDocument(() => { const f = window.fetch.bind(window); window.fetch = (u, i) => ((i?.method ?? 'GET').toUpperCase() !== 'GET') ? Promise.resolve(new Response('{}', { status: 200 })) : f(u, i); navigator.sendBeacon = () => true
  // keep the stage's pixels readable (preserveDrawingBuffer) so the check can ask whether anything was drawn
  const g = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, t: string, o?: any) { return (g as any).call(this, t, /webgl/.test(t) ? { ...(o ?? {}), preserveDrawingBuffer: true } : o) } as any })
await p.goto(`${url}/shimmer/dev?mode=spirits&spirit=${from}`, { waitUntil: 'load', timeout: 240000 })
await p.waitForSelector('[data-spirit-gallery]', { timeout: 120000 }); await sleep(1500)
await p.focus('[data-gallery-dial]').catch(() => {})

/** what the stage shows now: state, the model's glb + body, the drawn pixel count, the art image */
const look = () => p.evaluate(() => {
  const st = document.querySelector('[data-gallery-state]')?.getAttribute('data-gallery-state') ?? ''
  const title = document.querySelector('[data-gallery-title]')?.textContent ?? ''
  const sel = Number(document.querySelector('[data-gallery-row][data-selected="1"]')?.getAttribute('data-gallery-row') ?? 0)
  const art = document.querySelector('[data-gallery-art]') as HTMLImageElement | null
  const P = (window as any).__spiritModel, r = P?.rigs?.get('gallery')
  let verts = 0; try { verts = r?.body?.meshes?.body?.geometry?.getAttribute('position')?.count ?? 0 } catch { verts = 0 }
  // drawn pixels that are NOT the floor disc: the disc (one flat colour, read off the canvas's bottom-centre pixel) fills ~4590 px of the lower half on every spirit,
  // so a body drawn out of frame (11-27: the Hovari line + Luminara hung ~4 body-heights up) still left a full disc. Count the
  // pixels whose colour is not the disc's (readback un-premultiplies, so the disc's soft edge keeps its colour too).
  let drawn = 0; const cv = document.querySelector('[data-spirit-gallery] canvas') as HTMLCanvasElement | null
  if (cv && cv.width) { const c = document.createElement('canvas'); c.width = 96; c.height = 96; const x = c.getContext('2d')!
    x.drawImage(cv, 0, 0, 96, 96); const d = x.getImageData(0, 0, 96, 96).data
    const b = (94 * 96 + 48) * 4, R = d[b], G = d[b + 1], B = d[b + 2]
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 24 && Math.abs(d[i] - R) + Math.abs(d[i + 1] - G) + Math.abs(d[i + 2] - B) > 45) drawn++ }
  return { st, title, sel, stage: document.querySelector('[data-spirit-stage]')?.getAttribute('data-spirit-stage') ?? '', art: art ? { src: art.src, w: art.naturalWidth, done: art.complete } : null,
    urls: P ? Object.keys(P.urls ?? {}).filter((k: string) => P.urls[k]) : [], verts, drawn }
})
for (let k = from - 1; k < GALLERY.length; k++) {
  const row = GALLERY[k]
  if (k > from - 1) { await p.keyboard.press('ArrowDown') }
  // wait for her (a model can take a while on SwiftShader): up to 40 s
  let s = await look(), t0 = Date.now()
  while (Date.now() - t0 < 40000) {
    s = await look()
    if (s.sel === row.num && ((s.st === 'model' && s.verts > 0 && s.drawn > 40) || (s.st === 'art' && s.art && s.art.done && s.art.w > 0))) break
    await sleep(400)
  }
  await sleep(300); s = await look()
  if (shots) await p.screenshot({ path: `${shots}/${String(row.num).padStart(2, '0')}-${row.name.toLowerCase()}.png` })
  const shows = s.st === 'model' ? s.verts > 0 && s.drawn > 40 : s.st === 'art' ? !!s.art && s.art.w > 0 : false
  ok(s.sel === row.num && s.title.toLowerCase() === row.name.toLowerCase() && shows,
    `#${row.num} ${row.name}: ${s.st}${s.st === 'model' ? ` ${s.stage} verts ${s.verts} drawn ${s.drawn}px` : ` art ${s.art ? s.art.w + 'px' : 'none'}`}${errs.length ? ` (page errors so far ${errs.length})` : ''}`)
}
ok(errs.length === 0, `page errors: ${errs.length} ${errs.slice(0, 4).join(' | ')}`)
ok(cerrs.length === 0, `console errors: ${cerrs.length} ${cerrs.slice(0, 4).join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0)
