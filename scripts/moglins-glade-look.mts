// BETA M162: Hazel, Sax, Yarrow (and the plain Fennel, Mallow) IN THE GLADE, real page: each at its spot, the frame's draw calls
// from the same camera (before / after a look), and the talk opens on E / tap. Shots of both, 390x844 (--phone) or desktop.
//   npx tsx scripts/moglins-glade-look.mts <outdir> [--url https://ather.games] [--phone] [--who bonn]
import puppeteer from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = process.argv[2], url = flag('--url', 'https://ather.games'), phone = process.argv.includes('--phone'), only = flag('--who', ''), tag = phone ? 'phone' : 'desktop'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const b = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
try {
  const p = await b.newPage(); p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  if (phone) await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); else await p.setViewport({ width: 1100, height: 760 })
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.tutorial.v1', JSON.stringify({ v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: [], gifts: ['grimoire'], b2: 'none', baitDay: null })) })
  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(2000)
  if (await p.evaluate(() => (window as any).__ather.zone()) !== 'glade') await p.evaluate(() => (window as any).__ather.travel({ kind: 'glade' }))
  await p.waitForFunction(() => (window as any).__ather.zone() === 'glade' && !!(window as any).__glade?.folk, { timeout: 120000 }); await sleep(3000)
  const ks = (await p.evaluate(() => (window as any).__glade.folk)) as { id: string; x: number; z: number; yaw: number }[]
  const hide = () => p.evaluate(() => { const h = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of h.filter(x => !h.some(o => o !== x && x.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
  for (const k of ks.filter(k => !only || k.id.endsWith(only))) {
    const at = (d: number) => p.evaluate((x, z, y) => (window as any).__ather.gladeAt(x, z, y), k.x + Math.sin(k.yaw) * d, k.z + Math.cos(k.yaw) * d, Math.atan2(Math.sin(k.yaw), Math.cos(k.yaw)))
    await at(2.2); await sleep(5000); await hide(); console.log(`${k.id}: ${await p.evaluate(() => (window as any).__ather.calls())} draw calls at 2.2 m`); await p.screenshot({ path: `${out}/glade-${k.id.split(':').pop()}-${tag}.png` as `${string}.png` })
    await at(1.8)
    const near = await p.waitForFunction(id => { const n = (window as any).__ather.near(); return n?.kind === 'folk' || n?.kind === 'gfennel' }, { timeout: 30000 }, k.id).then(() => true, () => false)
    // gladeAt is an ARRIVAL: the veil comes up and a press under it is ignored, so wait for it to have lifted
    for (let t = 0, calm = 0; t < 60 && calm < 4; t++) { await sleep(500); calm = await p.evaluate(() => document.querySelector<HTMLElement>('[data-veil]')?.style.opacity === '0') ? calm + 1 : 0 }
    const up = await p.waitForFunction(() => /E · (talk to the folk of|Fennel)/.test(document.body.innerText) || !!document.querySelector('[data-touch="use"][data-touch-near]'), { timeout: 30000 }).then(() => true, () => false)
    ok(near && up, `${k.id}: in reach at 2 m, the prompt up`)
    if (phone) { const u = await p.$('[data-touch="use"]'), q = await u?.boundingBox(); if (q) await p.touchscreen.tap(q.x + q.width / 2, q.y + q.height / 2) } else await p.keyboard.press('KeyE')
    ok(await p.waitForFunction(() => !!document.querySelector('[data-talk-option]'), { timeout: 30000 }).then(() => true, () => false), `${k.id}: the talk opens`)
    await sleep(3000); await hide(); await p.screenshot({ path: `${out}/talk-${k.id.split(':').pop()}-${tag}.png` as `${string}.png` })
    if (await p.evaluate(() => (window as any).__ather.panel())) await p.keyboard.press('Escape')   // with no panel Esc opens Options
    await sleep(1500)
  }
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 300)}`) }
ok(errs.length === 0, `0 page errors ${errs.slice(0, 3).join(' | ')}`)
await b.close(); console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
