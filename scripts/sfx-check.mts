// ── M36 SFX HOOKS, PLAYED (hub fa8434bd, 11-19) ──────────────────────────────────────────────────────────────────────
// In the Wilds, real input: M opens the map (ui-panel-open), a real click on a button ticks (ui-tap), Escape closes it
// (ui-panel-close). Reads window.__sfx.played() (counts per yay id, shared/sfx.ts). 0 page errors.
// Tool hits + pickups are hooked in the same page (channel chip / combat pickup); this check proves the page hooks fire.
//   npx tsx scripts/sfx-check.mts [--url https://ather.games]
import puppeteer from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1280, height: 760 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star') })
  const P = () => p.evaluate(() => (window as any).__sfx?.played?.() ?? null) as Promise<Record<string, number> | null>
  const poll = async (fn: () => Promise<boolean>, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(150) } return false }
  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  ok(await poll(() => p.evaluate(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__sfx), 240000), 'in the Wilds, __sfx probe up')
  await sleep(4000); await p.mouse.click(640, 380); await sleep(800)
  const n = async (id: string) => (await P())?.[id] ?? 0
  const o0 = await n('ui-panel-open'), c0 = await n('ui-panel-close')
  await p.keyboard.press('KeyM')
  ok(await poll(async () => (await n('ui-panel-open')) > o0, 15000), 'M opens the map: ui-panel-open played')
  await sleep(1500)
  const t0 = await n('ui-tap')
  const box = await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 }); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, t: b.textContent?.slice(0, 30) } })
  if (box) { await p.mouse.click(box.x, box.y); ok(await poll(async () => (await n('ui-tap')) > t0, 8000), `a real button click ticks: ui-tap played ("${box.t}")`) } else ok(false, 'a visible button to click')
  if (await p.evaluate(() => !document.querySelector('[data-panel], [role=dialog]')) && (await n('ui-panel-close')) > c0) ok(true, 'the click closed the panel: ui-panel-close played')
  else { await p.keyboard.press('Escape'); ok(await poll(async () => (await n('ui-panel-close')) > c0, 15000), 'Escape closes it: ui-panel-close played') }
  console.log('played:', JSON.stringify(await P()))
  ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.join(' | ') : ''}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
