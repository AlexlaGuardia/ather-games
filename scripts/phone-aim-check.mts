// THE PHONE'S SIGHTS (Alex 11-18) + the thumb cluster in BOTH orientations (sprites' M8 sweep: in landscape the MENU chip sat on FIRE).
// A touch-only phone in the Wilds with a gun drawn: AIM / FIRE / the hold buttons / MENU / the status line never overlap, at 844x390
// and 390x844; tapping AIM raises the sights (the held gun's ads reaches 1), tapping it again lowers them; FIRE still empties the clip.
//   npx tsx scripts/phone-aim-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/phone-aim')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const results: Record<string, unknown>[] = []
let allPass = true
for (const [w, h] of [[844, 390], [390, 844]]) {
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport({ width: w, height: h, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })
  // a touch-only device: no fine pointer anywhere (shared/touch.ts › isTouchOnly)
  await p.evaluateOnNewDocument(() => {   // puppeteer cannot emulate the pointer feature; answer isTouchOnly()'s two questions directly
    const real = window.matchMedia.bind(window)
    window.matchMedia = ((q: string) => (/\(pointer:\s*coarse\)/.test(q) ? { ...real(q), matches: true, media: q } : /\(any-pointer:\s*fine\)/.test(q) ? { ...real(q), matches: false, media: q } : real(q))) as typeof window.matchMedia
  })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
  const res: Record<string, unknown> = { size: `${w}x${h}` }
  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__fpGun, { timeout: 240000 }); await sleep(4000)
  const G = () => p.evaluate(() => { const g = (window as any).__fpGun; return { shown: g.shown(), ads: +g.ads().toFixed(2), key: g.key() } })
  const poll = async (fn: () => Promise<boolean>, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(150) } return false }
  // draw (the R key the page's tap row sends; every keeper is born owning the Repeater)
  await p.evaluate(() => { for (const t of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(t, { code: 'KeyR', key: 'r', bubbles: true })) })
  res.drawn = await poll(async () => (await G()).shown)
  // the cluster: no two of these boxes overlap
  const boxes = await p.evaluate(() => {
    const pick = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)].map(e => { const r = e.getBoundingClientRect(); return { sel, x: r.x, y: r.y, w: r.width, h: r.height } }).filter(b => b.w > 0 && b.h > 0)
    return [...pick('[data-touch="aim"]'), ...pick('[data-touch="fire"]'), ...pick('[data-touch="menu"]'), ...pick('[data-touch="jump"]'), ...pick('[data-touch="slide"]'), ...pick('[data-hud="status"]'), ...pick('[data-hud="hotbar"]'), ...pick('[data-touch-near]')]   // the in-reach pills too (the Wilds' DRAW pill hid under the hotbar once)
  })
  const hit = (a: any, b: any) => a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1
  const overlaps: string[] = []
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (hit(boxes[i], boxes[j])) overlaps.push(`${boxes[i].sel} x ${boxes[j].sel}`)
  res.found = boxes.map(b => b.sel.replace(/\[data-(touch|hud)="|"\]/g, ''))
  res.overlaps = overlaps
  const inside = (b: any) => b.x >= 0 && b.y >= 0 && b.x + b.w <= w + 0.5 && b.y + b.h <= h + 0.5
  // the thumb cluster must be wholly on screen; the shared status line is REPORTED (not this file's surface: in portrait it runs off the left
  // edge, found 11-18 and routed to hub) so it can neither hide nor fail the cluster's verdict
  res.onScreen = boxes.filter(b => b.sel.startsWith('[data-touch')).every(inside)
  res.nearPills = boxes.filter(b => b.sel === '[data-touch-near]').length
  res.statusClipped = boxes.some(b => b.sel === '[data-hud="status"]' && !inside(b))
  await p.screenshot({ path: `${out}/${w}x${h}-1-drawn.png` })
  // AIM: tap up, tap down
  await p.tap('[data-touch="aim"]'); res.aimUp = await poll(async () => (await G()).ads >= 0.99)
  await p.screenshot({ path: `${out}/${w}x${h}-2-aimed.png` })
  await p.tap('[data-touch="aim"]'); res.aimDown = await poll(async () => (await G()).ads <= 0.01)
  // FIRE still empties the clip (the chip ticks)
  const ammo = () => p.evaluate(() => { const m = document.body.innerText.match(/Repeater\s*(\d+)\s*\/\s*\d+/); return m ? +m[1] : null })
  const a0 = await ammo()
  const fb = await p.$('[data-touch="fire"]'); const r = await fb!.boundingBox()
  if (r) { await p.touchscreen.touchStart(r.x + r.width / 2, r.y + r.height / 2); await sleep(400); await p.touchscreen.touchEnd() }
  res.fired = await poll(async () => { const a = await ammo(); return a !== null && a0 !== null && a < a0 }, 5000)
  res.pageErrors = errs
  const pass = !!res.drawn && overlaps.length === 0 && !!res.onScreen && (res.found as string[]).includes('aim') && (res.found as string[]).includes('fire') && (res.found as string[]).includes('menu')
    && !!res.aimUp && !!res.aimDown && !!res.fired && errs.length === 0
  res.pass = pass; allPass &&= pass; results.push(res)
  await p.close()
}
console.log(JSON.stringify(results, null, 1))
console.log(allPass ? 'PASS' : 'FAIL'); await br.close(); process.exit(allPass ? 0 : 1)
