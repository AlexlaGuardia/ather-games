// BETA M244 sheet 1 (sprites, 2026-11-27): THE FOUR AWAKENED VULNARA FORMS, OWNER PREVIEW. /shimmer/dev?mode=spirits rows #051-#054
// (Vulnarok / Vulnalys / Vulnavex / Vulnamyr). For each: her own glb is fetched (not Vulnara's), her body + her 'aura' part (echoes /
// spirals / halo) are mounted on her rig, the stage draws her, and her clips play (idle, walk, run, sit) with 0 errors. Then a
// NON-OWNER (fresh context, no owner cookie) gets no gallery at all.
//   OWNER_KEY=... npx tsx scripts/m244-awakened-check.mts [--url https://ather.games] [--shots dir] [--w 390 --h 844]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { GALLERY } from '../src/app/shimmer/dev/editors/spirit-gallery'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), shots = flag('--shots', ''), KEY = process.env.OWNER_KEY
const W = Number(flag('--w', '390')), H = Number(flag('--h', '844'))
if (shots) mkdirSync(shots, { recursive: true })
if (!KEY) { console.error('no OWNER_KEY'); process.exit(2) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms)); let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const AW = GALLERY.filter(r => r.aw)
ok(AW.length === 4, `4 awakened rows in the roster (${AW.map(r => `#${r.num} ${r.name}`).join(', ')})`)
const br = await puppeteer.launch({ protocolTimeout: 900000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
try {
  const errs: string[] = []
  const p: Page = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: W, height: H })
  p.on('pageerror', e => errs.push(String(e).slice(0, 300)))
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 300)) })
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await sleep(1500); errs.length = 0
  await p.evaluateOnNewDocument(() => { const f = window.fetch.bind(window); window.fetch = (u, i) => ((i?.method ?? 'GET').toUpperCase() !== 'GET') ? Promise.resolve(new Response('{}', { status: 200 })) : f(u, i); navigator.sendBeacon = () => true })
  for (const row of AW) {
    await p.goto(`${url}/shimmer/dev?mode=spirits&spirit=${row.num}`, { waitUntil: 'load', timeout: 240000 })
    await p.waitForSelector('[data-spirit-gallery]', { timeout: 120000 })
    const read = () => p.evaluate(() => {
      const P = (window as any).__spiritModel, r = P?.rigs?.get('gallery'), m = r?.body?.meshes ?? {}
      const n = (k: string) => { try { return m[k]?.geometry?.getAttribute('position')?.count ?? 0 } catch { return 0 } }
      return { st: document.querySelector('[data-gallery-state]')?.getAttribute('data-gallery-state') ?? '', title: document.querySelector('[data-gallery-title]')?.textContent ?? '',
        stage: document.querySelector('[data-spirit-stage]')?.getAttribute('data-spirit-stage') ?? '', urls: P ? Object.keys(P.urls ?? {}).filter((k: string) => P.urls[k]) : [],
        body: n('body'), aura: n('aura'), eyes: n('eyes'), clips: (r?.body?.mixer as any)?._actions?.length ?? 0 }
    })
    let s = await read(); const t0 = Date.now()
    while (Date.now() - t0 < 60000 && !(s.body > 0 && s.aura > 0)) { await sleep(500); s = await read() }
    const look = row.aw!.look
    ok(s.st === 'model' && s.title.toLowerCase() === row.name.toLowerCase() && s.stage === look, `#${row.num} ${row.name}: stage ${s.stage}, title ${s.title}`)
    ok(s.urls.some(u => u.includes(`/${look}-rigged.glb`)) && !s.urls.some(u => u.includes('/vulnara-rigged.glb')), `#${row.num} her own glb (${s.urls.filter(u => u.includes('rigged')).join(', ')})`)
    ok(s.body > 2000 && s.eyes > 0 && s.aura > 0, `#${row.num} body ${s.body} verts, eyes ${s.eyes}, aura ${s.aura} (echoes / spirals / halo)`)
    for (const c of ['walk', 'run', 'sit', 'idle']) {
      await p.click(`[data-gallery-clip="${c}"]`).catch(() => {}); await sleep(1600)
      const on = await p.$eval(`[data-gallery-clip="${c}"]`, e => e.getAttribute('aria-pressed')).catch(() => null)
      if (shots && (c === 'idle' || c === 'walk')) await p.screenshot({ path: `${shots}/${row.num}-${look}-${c}.png` })
      ok(on === 'true' && errs.length === 0, `#${row.num} ${c} plays (errors so far ${errs.length})`)
    }
  }
  ok(errs.length === 0, `owner errors: ${errs.length} ${errs.slice(0, 4).join(' | ')}`)
  // the non-owner: a fresh context with no owner cookie sees no gallery
  const q = await (await br.createBrowserContext()).newPage(); await q.setViewport({ width: W, height: H })
  const res = await q.goto(`${url}/shimmer/dev?mode=spirits&spirit=51`, { waitUntil: 'load', timeout: 120000 }).catch(() => null); await sleep(2500)
  const g = await q.$('[data-spirit-gallery]')
  ok(!g, `non-owner: no gallery (status ${res?.status()}, url ${q.url().replace(url, '')})`)
} finally { await br.close() }
console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0)
