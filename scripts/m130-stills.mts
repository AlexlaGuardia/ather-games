// BETA M130 stills: a shambler, a Flit and a crawler, each pinned at the same spot ahead of the camera on prod (hour 13).
// npx tsx scripts/m130-stills.mts [--url U] --out DIR --tag before|after
import puppeteer from 'puppeteer-core'
import { GREG_WAYMARK } from '../src/app/shimmer/open/ather/waymarks'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const URL = flag('--url', 'https://ather.games'), OUT = flag('--out', '/tmp'), TAG = flag('--tag', 'after')
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 240000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await br.newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('ather:shimmer:birthRune', 'star') } catch { /* sandboxed */ } })
  await p.goto(`${URL}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => typeof (window as any).__ather?.tp === 'function', { timeout: 240000 }); await wait(2000)
  await p.touchscreen.tap(195, 420); await wait(800)
  for (let i = 0; i < 30 && (await p.evaluate(() => (window as any).__ather.zone())) !== 'wilds'; i++) { await p.evaluate(w => (window as any).__ather.travel({ kind: 'waymark', w }), GREG_WAYMARK as any); await wait(4000) }
  await wait(6000)
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z), GREG_WAYMARK.x + 70, GREG_WAYMARK.z + 10); await wait(25000)   // the ground paints in late on swiftshader
  await p.evaluate(() => { const b = document.querySelector<HTMLElement>('[data-creator-done]') ?? [...document.querySelectorAll('button')].find(q => /^looks good$/i.test(q.innerText.trim())); b?.click() }); await wait(2000)
  await p.evaluate(() => { const A = (window as any).__ather; const t = () => { const C = A.combat?.(), h = (window as any).__pin; if (C) { C.hollows = C.hollows.filter((q: any) => q === h?.h); C.spits.length = 0; C.keeper.hp = C.keeper.maxHp; if (h) { Object.assign(h.h, { x: h.x, y: h.y, z: h.z, yaw: h.yaw, state: 'recover', t: 0.6, hitFlash: 0 }) } } requestAnimationFrame(t) }; t() })
  await p.addStyleTag({ content: 'body * { visibility: hidden !important } canvas { visibility: visible !important }' })   // the HUD covers a crawler
  for (const [kind, d] of [['shambler', 5], ['floater', 4], ['crawler', 6]] as const) {
    const r = await p.evaluate((k: string, dist: number) => { const A = (window as any).__ather, w = window as any, C = A.combat(); w.__pin = null; C.hollows.length = 0; A.spawn(0, -dist, k); const h = C.hollows[0], a = A.camAim(), L = Math.hypot(a.x, a.z) || 1
      const x = a.cx + a.x / L * dist, z = a.cz + a.z / L * dist; w.__pin = { h, x, z, y: k === 'floater' ? a.cy + 0.1 : h.y, yaw: Math.atan2(a.x, a.z) + Math.PI }; return { x, z, y: w.__pin.y, a } }, kind, d)
    await wait(6000); await p.screenshot({ path: `${OUT}/${kind === 'floater' ? 'flit' : kind}-${TAG}.png` }); console.log(kind, JSON.stringify(r))
  }
  console.log('PASS (stills)')
} finally { await br.close() }
