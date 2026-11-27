// ── BETA M218: THE WORLD PROMPT STAYS OUT OF THE CENTRE (Alex 11-26: "that tool tip that's always blocking the center of
// the screen") ───────────────────────────────────────────────────────────────────────────────────────────────────────
// On the Ather plot, crosshair on the planning table / the starter Keepstone / the gate (each raises its E prompt), at a
// desktop window and at 390x844 touch: the prompt's plate must not overlap the centre box (the middle 30% of the screen on
// both axes; the done-check names ~20%, 30% is the stricter reading), must sit on a plate (never raw text on the scene),
// and must be on screen. Shots: docs/looks/m218-2026-11-27/<tag>-<desk|phone>-<target>.png. 0 page errors.
//   npx tsx scripts/m218-prompt-check.mts [--url https://ather.games] [--tag after] [--phone]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { TABLE, STARTER_CHEST } from '../src/app/shimmer/open/ather/rooms'
import { GATE } from '../src/app/shimmer/open/ather/plot'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), tag = flag('--tag', 'after'), phone = process.argv.includes('--phone')
const SHARE = 0.3, EYE = 1.6
const dir = 'docs/looks/m218-2026-11-27'; mkdirSync(dir, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const res: string[] = [], fails: string[] = [], pageErrs: string[] = []
const ok = (c: boolean, m: string) => { res.push(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails.push(m) }
const frames = (p: any, n: number) => p.evaluate(`new Promise(r => { let k = ${n}; (function tick() { if (--k <= 0) r(0); else requestAnimationFrame(tick) })() })`)

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage()
  const VW = phone ? 390 : 1440, VH = phone ? 844 : 900
  await p.setViewport(phone ? { width: VW, height: VH, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { width: VW, height: VH })
  p.on('pageerror', e => pageErrs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star') })
  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'plot' && !!(window as any).__ather?.ground, { timeout: 240000 }); await sleep(5000)
  if (phone) { await p.mouse.click(VW / 2, VH / 2); await sleep(600) }   // the touch intro card closes on a tap
  else { await p.mouse.click(VW / 2, VH / 2); await sleep(600) }
  const x0 = VW * (0.5 - SHARE / 2), x1 = VW * (0.5 + SHARE / 2), y0 = VH * (0.5 - SHARE / 2), y1 = VH * (0.5 + SHARE / 2)
  const targets: [string, string, number, number, number, number, number, number][] = [
    ['table', 'E · the planning table', TABLE.x, TABLE.z, 1.1, 0.8, -1, 0.3],
    ['keepstone', 'E · the Keepstone', STARTER_CHEST.x, STARTER_CHEST.z, 0.55, 0.6, 1, 0.2],
    ['gate', 'E · the gate (fold map)', GATE.x, GATE.z, 1.4, 1.4, -GATE.x, -GATE.z],
  ]
  for (const [name, prompt, tx, tz, r, ty, ux0, uz0] of targets) {
    const L = Math.hypot(ux0, uz0) || 1, ux = ux0 / L, uz = uz0 / L, near = r + 1.6
    await p.evaluate((a: number, b: number, c: number, d: number, e: number, eye: number) => {
      const g = (window as any).__ather, gs = g.ground(a, b), gt = g.ground(c, d)
      const dx = c - a, dz = d - b, yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(gt + e - (gs + eye), Math.hypot(dx, dz))
      g.tp(a, b, yaw); g.look(yaw, pitch)
    }, tx + ux * near, tz + uz * near, tx, tz, ty, EYE)
    await frames(p, 10)
    // the deepest element whose own text is the prompt = its plate
    let box: any = null
    for (let t = 0; t < 10000 && !box; t += 400) {
      box = await p.evaluate((s: string) => {
        const els = [...document.querySelectorAll('div')].filter(e => e.textContent?.trim() === s && ![...e.children].some(c => c.textContent?.trim() === s))
        const e = els[0]; if (!e) return null
        const r = e.getBoundingClientRect(), cs = getComputedStyle(e)
        return { x: r.x, y: r.y, w: r.width, h: r.height, bg: cs.backgroundColor, slot: !!e.closest('[data-hud="prompt"]') }
      }, prompt)
      if (!box) await sleep(400)
    }
    await p.screenshot({ path: `${dir}/${tag}-${phone ? 'phone' : 'desk'}-${name}.png` })
    if (!box) { ok(false, `${name}: '${prompt}' never showed`); continue }
    const over = box.x < x1 && box.x + box.w > x0 && box.y < y1 && box.y + box.h > y0
    const r = (n: number) => Math.round(n)
    ok(!over, `${name}: prompt plate [${r(box.x)},${r(box.y)} ${r(box.w)}x${r(box.h)}] clears the centre ${SHARE * 100}% box [${r(x0)},${r(y0)}..${r(x1)},${r(y1)}] at ${VW}x${VH}`)
    ok(!/rgba\(0, 0, 0, 0\)|transparent/.test(box.bg), `${name}: on a plate (${box.bg})`)
    ok(box.x >= 0 && box.y >= 0 && box.x + box.w <= VW && box.y + box.h <= VH, `${name}: on screen`)
    res.push(`     ${name}: in the HUD template's prompt slot = ${box.slot}`)
  }
  // the fade: the same prompt dims after a moment (only the template slot does this)
  const dim = await p.evaluate(() => document.querySelector('[data-hud="prompt"]')?.getAttribute('data-dim') ?? 'no slot')
  await sleep(3500)
  const dim2 = await p.evaluate(() => document.querySelector('[data-hud="prompt"]')?.getAttribute('data-dim') ?? 'no slot')
  ok(dim2 === '1', `the prompt dims after a moment of the same text (data-dim ${dim} -> ${dim2})`)
} finally { await br.close() }
ok(pageErrs.length === 0, `0 page errors${pageErrs.length ? ': ' + pageErrs.join(' | ') : ''}`)
console.log(`m218-prompt-check ${phone ? 'phone 390x844' : 'desk 1440x900'} @ ${url} (${tag})\n` + res.join('\n'))
console.log(fails.length ? `FAIL (${fails.length})` : 'PASS')
process.exit(fails.length ? 1 : 0)
