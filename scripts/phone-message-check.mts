// ── THE PHONE MESSAGE LINE CLEARS THE THUMBS (2026-11-22, world / Jin; Alex's playtest via hub 7f25d6a2) ─────────────
// On a phone the message line (game-hud Messages) sat centred at bottom:118 and grew UP into the thumb cluster: the
// Wilds' DRAW pill and JUMP/SLIDE sat under Morel's lines. Every said line must now clear every touch control and every
// other HUD piece, and stay on screen, at 390x844, 360x780 and 844x390 (landscape), both with the gun away (the DRAW
// pill showing) and drawn (AIM + FIRE showing, the tallest cluster).
// SETUP (stated): a fresh anonymous touch-only browser per size (never a real keeper's save), born, on ?waymark=greg in
// the Wilds. The lines are said through window.__hudSay (game-hud's probe), five at once = MAX_LINES, the worst stack:
// a zone line, a long Morel line, two item lines, a chat line.
//   npx tsx scripts/phone-message-check.mts [--url https://ather.games] [--out dir]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/phone-message')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const poll = async (f: () => Promise<boolean>, ms: number) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f().catch(() => false)) return true; await sleep(300) } return false }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const LINES: [string, string][] = [
  ['The Wilds', 'zone'],
  ['Kael has gems for you. Go and find him by the old well before the light goes.', 'morel'],
  ['Repeater', 'item'],
  ['Moonleaf x3', 'item'],
  ['Greg: mind the edge of the ridge', 'chat'],
]
const say = (p: Page) => p.evaluate((ls) => { const s = (window as any).__hudSay; for (const [t, k] of ls) s(t, k, 120) }, LINES)
// every said line's box vs every touch control + every other HUD piece; and on screen
const measure = (p: Page, w: number, h: number) => p.evaluate((W, H) => {
  const box = (e: Element) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } }
  const lines = [...document.querySelectorAll('[data-hud="messages"] [data-say]')].map(e => ({ kind: (e as HTMLElement).dataset.say!, ...box(e) }))
  const others = [...document.querySelectorAll('[data-touch], [data-touch-near], [data-hud]:not([data-hud="messages"])')]
    .filter(e => !e.closest('[data-hud="messages"]'))
    .map(e => ({ sel: (e as HTMLElement).dataset.touch ?? `hud:${(e as HTMLElement).dataset.hud}`, ...box(e) })).filter(b => b.w > 0 && b.h > 0)
  const hit = (a: any, b: any) => a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1
  const overlaps: string[] = []
  for (const l of lines) for (const o of others) if (hit(l, o)) overlaps.push(`${l.kind} x ${o.sel}`)
  const off = lines.filter(l => l.x < -0.5 || l.y < -0.5 || l.x + l.w > W + 0.5 || l.y + l.h > H + 0.5).map(l => l.kind)
  return { n: lines.length, kinds: lines.map(l => l.kind), overlaps, off, found: others.map(o => o.sel), top: Math.min(...lines.map(l => l.y)), bottom: Math.max(...lines.map(l => l.y + l.h)) }
}, w, h)

for (const [w, h] of [[390, 844], [360, 780], [844, 390]]) {
  const tag = `${w}x${h}`
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport({ width: w, height: h, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })
  await p.evaluateOnNewDocument(() => {   // a touch-only device (shared/touch.ts › isTouchOnly), as phone-aim-check
    const real = window.matchMedia.bind(window)
    window.matchMedia = ((q: string) => (/\(pointer:\s*coarse\)/.test(q) ? { ...real(q), matches: true, media: q } : /\(any-pointer:\s*fine\)/.test(q) ? { ...real(q), matches: false, media: q } : real(q))) as typeof window.matchMedia
  })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  ok(await poll(() => p.evaluate(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__hudSay && !!(window as any).__fpGun), 240000), `${tag}: in the Wilds, probe up`)
  await sleep(3000)
  // (1) gun away: the DRAW pill + the walker's holds
  await say(p); await sleep(600)
  const a = await measure(p, w, h)
  console.log(`  ${tag} away: ${a.n} lines y ${a.top.toFixed(0)}..${a.bottom.toFixed(0)}; found ${a.found.join(',')}`)
  // the page says its own lines too (MAX_LINES = 5 newest), so 4+ of a 5-line stack, the Morel one among them
  ok(a.n >= 4 && a.kinds.includes('morel'), `${tag} away: a full stack shown, Morel's line in it (${a.n}: ${a.kinds.join(',')})`)
  ok(a.found.includes('jump'), `${tag} away: the JUMP hold is on screen to be cleared`)
  ok(a.overlaps.length === 0, `${tag} away: no line sits on a control or HUD piece${a.overlaps.length ? ' — ' + a.overlaps.join('; ') : ''}`)
  ok(a.off.length === 0, `${tag} away: every line on screen${a.off.length ? ' — off: ' + a.off.join(',') : ''}`)
  await p.screenshot({ path: `${out}/${tag}-1-away.png` }).catch(() => {})
  // (2) drawn: AIM + FIRE join the cluster (the R key the page's tap row sends)
  await p.evaluate(() => { for (const t of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(t, { code: 'KeyR', key: 'r', bubbles: true })) })
  ok(await poll(() => p.evaluate(() => (window as any).__fpGun.shown() && !!document.querySelector('[data-touch="fire"]')), 30000), `${tag}: gun drawn, FIRE up`)
  await say(p); await sleep(600)
  const b = await measure(p, w, h)
  console.log(`  ${tag} drawn: ${b.n} lines y ${b.top.toFixed(0)}..${b.bottom.toFixed(0)}`)
  ok(b.overlaps.length === 0, `${tag} drawn: no line sits on a control or HUD piece${b.overlaps.length ? ' — ' + b.overlaps.join('; ') : ''}`)
  ok(b.off.length === 0, `${tag} drawn: every line on screen${b.off.length ? ' — off: ' + b.off.join(',') : ''}`)
  await p.screenshot({ path: `${out}/${tag}-2-drawn.png` }).catch(() => {})
  ok(errs.length === 0, `${tag}: no page errors${errs.length ? ' — ' + errs[0] : ''}`)
  await p.close()
}
await br.close()
console.log(fails ? `FAIL (${fails})` : 'PASS')
process.exit(fails ? 1 : 0)
