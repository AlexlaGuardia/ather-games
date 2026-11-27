// ── BETA M194: THE TUTORIAL POINTS OUT THE TOOL PANEL (Alex 11-26: 'lets be sure the tutorial points it out') ─────────────
// A FRESH newborn test keeper (own browser context, never Alex's save): empty sockets = no beat; Otto's spike lands (the
// tutorial's gift written into the save + the tools event, what glade-friend-talk does) = the spike's dial glows and ONE line
// shows in the HUD prompt slot (click on desktop, tap on a phone), off the centre box; clicking / tapping the dial opens the
// tool panel and clears it (save: dial 'done'); a reload = not again. Then a VETERAN test keeper (legacy tutorial save, all
// tools held) never sees it. 0 page errors. Shots: docs/looks/m194-2026-11-27/<desk|phone>-*.png
//   npx tsx scripts/m194-tool-beat-check.mts [--url https://ather.games] [--phone]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), phone = process.argv.includes('--phone')
const dir = 'docs/looks/m194-2026-11-27'; mkdirSync(dir, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const res: string[] = [], fails: string[] = [], pageErrs: string[] = []
const ok = (c: boolean, m: string) => { res.push(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails.push(m) }
const tag = phone ? 'phone' : 'desk'
const VW = phone ? 390 : 1440, VH = phone ? 844 : 900
const LEGACY = { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
async function keeper(seed: Record<string, string>) {
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport(phone ? { width: VW, height: VH, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { width: VW, height: VH })
  p.on('pageerror', e => pageErrs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument((s: Record<string, string>) => {
    if (sessionStorage.getItem('m194-seeded')) return   // seed once: a reload must read what the game saved
    sessionStorage.setItem('m194-seeded', '1')
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v)
  }, seed)
  return p
}
async function enter(p: any) {
  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'plot' && !!(window as any).__ather?.ground, { timeout: 240000 }); await sleep(5000)
  // no canvas click: on desktop it takes pointer lock and the dials are then out of the mouse's reach (m184-panel-check does the same)
}
const state = (p: any) => p.evaluate(() => {
  const hint = document.querySelector('[data-dial-hint="1"]') as HTMLElement | null
  const line = document.querySelector('[data-tool-beat]') as HTMLElement | null
  const r = hint?.getBoundingClientRect(), lr = line?.getBoundingClientRect()
  return { hint: hint?.getAttribute('data-dial-btn') ?? null, glow: !!hint?.querySelector('[data-dial-glow]'), at: r ? [r.x + r.width / 2, r.y + r.height / 2] : null,
    line: line?.textContent ?? null, lineBox: lr ? [lr.x, lr.y, lr.width, lr.height] : null, inSlot: !!line?.closest('[data-hud="prompt"]'),
    panel: document.querySelector('[data-tool-panel]')?.getAttribute('data-tool-panel') ?? null,
    held: [...document.querySelectorAll('[data-dial-btn]')].map(b => b.getAttribute('data-dial-btn')).join(','),
    dial: (() => { try { return JSON.parse(localStorage.getItem('open.tutorial.v1') ?? 'null')?.dial ?? null } catch { return 'bad' } })() }
})
try {
  // ── 1. the newborn (born after M22 without the worn rinstick, as the birth gate leaves them) ──
  const p = await keeper({ 'ather:shimmer:birthRune': 'star', 'open.rinquest.v1': JSON.stringify({ v: 1, state: 'none', step: 0 }) })
  await enter(p)
  let s = await state(p)
  ok(s.hint === null && s.line === null, `newborn, empty sockets: no beat yet (hint ${s.hint}, line ${s.line})`)
  await p.screenshot({ path: `${dir}/${tag}-a-newborn-empty.png` })
  // Otto lights the spike: the gift lands in the tutorial save, the page re-reads its tools
  await p.evaluate(() => {
    const t = JSON.parse(localStorage.getItem('open.tutorial.v1') ?? 'null')
    if (!t) throw new Error('no tutorial save on a newborn')
    t.gifts = [...new Set([...(t.gifts ?? []), 'spike'])]; localStorage.setItem('open.tutorial.v1', JSON.stringify(t))
    window.dispatchEvent(new Event('open:tools')); window.dispatchEvent(new Event('ather-tutorial'))
  })
  for (let t = 0; t < 8000; t += 400) { s = await state(p); if (s.hint && s.line) break; await sleep(400) }
  ok(s.hint === 'prospecting' && s.glow, `first tool held: the spike's dial glows (hint ${s.hint}, glow ${s.glow})`)
  const want = phone ? 'Tap the glowing dial to see what your tool is for.' : 'Click the glowing dial to see what your tool is for.'
  ok(s.line === want, `the line (${phone ? 'tap' : 'click'}): '${s.line}'`)
  ok(s.inSlot, 'the line sits in the GameHud prompt slot (M218)')
  if (s.lineBox) {
    const [x, y, w, h] = s.lineBox, x0 = VW * 0.35, x1 = VW * 0.65, y0 = VH * 0.35, y1 = VH * 0.65
    ok(!(x < x1 && x + w > x0 && y < y1 && y + h > y0), `the line clears the centre 30% box ([${Math.round(x)},${Math.round(y)} ${Math.round(w)}x${Math.round(h)}])`)
  }
  await p.screenshot({ path: `${dir}/${tag}-b-beat.png` })
  // still there a few seconds on (it waits for the keeper, it does not time out)
  await sleep(3000); s = await state(p)
  ok(s.hint === 'prospecting' && !!s.line, 'still pointing 3 s later')
  // click / tap the glowing dial
  for (let k = 0; k < 2 && !s.panel; k++) {   // phone emulation eats the first touch after load (M220 note): one retry
    const el = await p.$('[data-dial-btn="prospecting"]')
    if (!el) { res.push('     no spike dial to click'); break }
    if (phone) await el.tap(); else await el.click()
    await sleep(900); s = await state(p)
    if (k === 1 || s.panel) res.push(`     dial ${phone ? 'tap' : 'click'} #${k + 1}: panel ${s.panel}`)
  }
  ok(s.panel === 'prospecting', `the tool panel opens on the spike (${s.panel})`)
  ok(s.hint === null && s.line === null, `opening it clears the glow + the line (hint ${s.hint}, line ${s.line})`)
  ok(s.dial === 'done', `saved: tutorial dial = ${s.dial}`)
  await p.screenshot({ path: `${dir}/${tag}-c-panel-open.png` })
  // reload: never again
  await enter(p); await sleep(2500); s = await state(p)
  ok(s.hint === null && s.line === null && s.dial === 'done', `after reload: no glow, no line (hint ${s.hint}, line ${s.line}, dial ${s.dial})`)
  ok(/prospecting/.test(s.held), `the spike is still held after reload (dials ${s.held})`)
  await p.screenshot({ path: `${dir}/${tag}-d-reloaded.png` })

  // ── 2. a veteran (a keeper from before the tutorial: legacy save, every tool held) ──
  const v = await keeper({ 'ather:shimmer:birthRune': 'star', 'open.tutorial.v1': JSON.stringify(LEGACY) })
  await enter(v)
  let seen = false
  for (let t = 0; t < 6000; t += 500) { const sv = await state(v); if (sv.hint || sv.line) seen = true; await sleep(500) }
  const sv = await state(v)
  ok(!seen, `veteran: never sees the beat over 6 s (dials ${sv.held})`)
  await v.screenshot({ path: `${dir}/${tag}-e-veteran.png` })
} finally { await br.close() }
ok(pageErrs.length === 0, `0 page errors${pageErrs.length ? ': ' + pageErrs.join(' | ') : ''}`)
console.log(`m194-tool-beat-check ${phone ? 'phone 390x844' : 'desk 1440x900'} @ ${url}\n` + res.join('\n'))
console.log(fails.length ? `FAIL (${fails.length})` : 'PASS')
process.exit(fails.length ? 1 : 0)
