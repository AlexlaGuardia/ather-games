// ── ROOM TAB 'Moglin' + MOREL'S PULSE (2026-11-22, world / Jin; Alex's playtest via hub 7f25d6a2) ────────────────────────
// (1) The room bench's last tab said 'Keeper', but the keeper is the PLAYER: it is the room's Moglin. The tab must read
//     'Moglin' (label + title); its data-bench-tab id stays 'keeper' (not player-visible).
// (2) Morel's lines on the message line were too missable: a NEW one pulses (3 soft glow + scale beats, class
//     .morel-pulse, data-morel-pulse="1"), then settles (class off, data-morel-pulse="0") within ~2 s.
// SETUP (stated): a cooking room at (-100, 100) seeded in open.works.v1 (moglin-duty-check's), and a SECOND fresh context,
// born but no gems given (stage 'greg'), on ?waymark=greg&morel=fast so Morel's stuck hint comes in ~12 s (gem-check step 7).
// Fresh anonymous browsers: never a real keeper's save. --phone: 390x844 touch, the bench opened with the 'use' chip.
//   npx tsx scripts/moglin-tab-pulse-check.mts [--url https://ather.games] [--out dir] [--phone]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { benchOf, type Room } from '../src/app/shimmer/open/ather/rooms'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/moglin-tab-pulse'), phone = process.argv.includes('--phone')
mkdirSync(out, { recursive: true })
const ROOM: Room = { id: 'cooking-tab', kind: 'cooking', x: -100, z: 100, q: 0, placedAt: 1, doneAt: 2, store: [] }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const poll = async (f: () => Promise<boolean>, ms: number) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f().catch(() => false)) return true; await sleep(400) } return false }
const VIEW = phone ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1100, height: 760 }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const page = async () => { const p = await (await br.createBrowserContext()).newPage(); await p.setViewport(VIEW); p.on('pageerror', e => errs.push(String(e).slice(0, 200))); await p.evaluateOnNewDocument('window.__name = (f) => f'); return p }
const hideCard = (p: Page) => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => /Click to play|Tap to start|Tap to drive|Left thumb moves/i.test(d.textContent ?? '')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
const shot = async (p: Page, n: string) => { await hideCard(p); try { await p.screenshot({ path: `${out}/${n}${phone ? '-phone' : ''}.png` }) } catch { /* slow frame */ } }
const click = async (p: Page, sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (b) { if (phone) await p.touchscreen.tap(b.x, b.y); else await p.mouse.click(b.x, b.y) } await sleep(350); return !!b }
// E held across a frame on desktop (headless ~1 fps), the 'use' chip tapped on the phone; retried until `want` shows
const useE = async (p: Page, want: string) => {
  for (let t = 0; t < 3; t++) {
    if (await p.$(want)) return true
    if (!phone) { await p.keyboard.down('e'); await sleep(1500); await p.keyboard.up('e') }
    else { for (let k = 0; k < 20 && !(await p.$('[data-touch="use"][data-touch-near]')); k++) await sleep(500); await click(p, '[data-touch="use"]') }
    for (let k = 0; k < 10 && !(await p.$(want)); k++) await sleep(500)
  }
  return !!(await p.$(want))
}
try {
  // ── 1. the bench's last tab reads 'Moglin'
  const p = await page()
  await p.evaluateOnNewDocument((room: Room) => {
    if (sessionStorage.getItem('mt')) return; sessionStorage.setItem('mt', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'repeater', n: 1 }; slots[1] = { id: 'waymark', n: 12 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [room], chests: [], pieces: [] }))
  }, ROOM)
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => typeof (window as any).__ather?.tp === 'function', { timeout: 180000 }); await sleep(2500); await hideCard(p)
  const b = benchOf(ROOM)
  await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), b.x, b.z - 1.4); await sleep(1800); await aimAt(p, b.x, b.z, 0.6)
  ok(await useE(p, '[data-bench-tab]'), '1. the cooking room bench opened')
  const tab = await p.evaluate(() => { const e = document.querySelector('[data-bench-tab="keeper"]'); return e ? { text: (e.textContent ?? '').trim(), title: e.getAttribute('title') } : null })
  const all = await p.evaluate(() => [...document.querySelectorAll('[data-bench-tab]')].map(e => (e.textContent ?? '').trim()))
  ok(tab?.text === 'Moglin' && tab?.title === 'Moglin', `1. the room's Moglin tab reads 'Moglin' (text '${tab?.text}', title '${tab?.title}')`)
  ok(!all.some(t => /keeper/i.test(t)), `1. no bench tab says Keeper (${all.join(' | ')})`)
  await click(p, '[data-bench-tab="keeper"]'); await sleep(500)
  await shot(p, 'tab-moglin')
  ok(!(await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), '1. no horizontal overflow')
  await p.browserContext().close()

  // ── 2. a NEW Morel line pulses, then settles
  const q = await page()
  await q.evaluateOnNewDocument(() => {
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const w = window as any; w.__pulseLog = []; w.__pulseAt = []; const ids = new WeakMap<Element, number>(); let nid = 0   // read IN the observer: at headless ~1 fps the 1.65 s pulse (and the 4 s line) is over before a poll returns
    new MutationObserver(() => { for (const e of document.querySelectorAll('[data-say="morel"] [data-morel-pulse]')) { const s = `${e.getAttribute('data-morel-pulse')}:${e.classList.contains('morel-pulse') ? 'c' : '-'}`
      // per ELEMENT (each line mounts its own): a deduped global log glued one line's pulse to a LATER line's settle (phone read 28 s)
      if (!ids.has(e)) ids.set(e, ++nid)
      const id = ids.get(e), last = w.__pulseAt.filter((x: { id: number }) => x.id === id).at(-1)
      if (last?.s !== s) { w.__pulseAt.push({ id, s, t: performance.now(), anim: getComputedStyle(e).animationName }); if (w.__pulseLog.at(-1) !== s) w.__pulseLog.push(s) } } })
      .observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-morel-pulse', 'class'] })
  })
  await q.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg&morel=fast`, { waitUntil: 'load', timeout: 240000 })
  ok(await poll(() => q.evaluate(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__morelHints), 240000), '2. in the Wilds on the errand, hints mounted')
  ok(await poll(() => q.evaluate(() => !!document.querySelector('[data-say="morel"] .morel-pulse[data-morel-pulse="1"]')), 120000), '2. a new Morel line arrives WITH the pulse (class + data-morel-pulse=1)')
  await shot(q, 'morel-pulse-on')
  await sleep(3000); await shot(q, 'morel-pulse-settled')
  const at = await q.evaluate(() => (window as any).__pulseAt as { id: number; s: string; t: number; anim: string }[])
  console.error('pulse events', JSON.stringify(at.map(x => [x.id, x.s, Math.round(x.t)])))
  const on = at.find(x => x.s === '1:c'), off = at.find(x => x.s === '0:-' && on && x.id === on.id)
  ok(on?.anim === 'morel-pulse', `2. the pulse animation runs on arrival (${on?.anim})`)
  ok(!!off && off.t - on!.t < 2500, `2. then it settles: class off, data-morel-pulse=0 after ${off ? ((off.t - on!.t) / 1000).toFixed(2) : '?'} s (< 2.5 s)`)
  const log = await q.evaluate(() => (window as any).__pulseLog as string[])
  ok(log[0] === '1:c' && log.includes('0:-'), `2. seen in order: pulsing then settled (${log.join(' > ')})`)
  ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.join(' / ') : ''}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : `PASS${phone ? ' (phone 390x844)' : ''}: room tab reads 'Moglin'; a new Morel line pulses then settles; 0 page errors`)
process.exit(fails ? 1 : 0)
