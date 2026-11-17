// ── BETA M7: SAVES SURVIVE ───────────────────────────────────────────────────────────────────────────────────────
// A keeper is born at /shimmer/open/ather, makes progress (garden ledger, journal choice, a business bought on the
// continent), and the progress must still be there after: (a) a reload, (b) closing the page and opening a new one in
// the same profile, (c) closing the browser and relaunching on the SAME userDataDir, (d) "next day" (the page's clock
// shifted +26 h on relaunch; the open world's only time-based state is the tycoon catch-up and the forestry/spread
// timestamps), and the keeper must never be sent back through the birth gate. Phase E is anonymous -> signed-in:
// real Google OAuth cannot be scripted, so the client's own /api/auth/session answer is faked at the network layer
// (page-side interception only; no server, cookie or backdoor is touched) to exercise the client adoption path.
//   npx tsx scripts/beta-m7-saves.mts [--url http://localhost:3201] [--out /tmp/m7]
import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import { readFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { marketFor } from '../src/app/shimmer/open/business/market'

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const URL_ = flag('--url', 'https://ather.games'), OUT = flag('--out', '/tmp/m7')
mkdirSync(OUT, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
const offer = marketFor(R, 'rune-hold').find(x => x.kind === 'mine')!

let fails = 0
const ok = (c: boolean, m: string) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) fails++ }
const note = (m: string) => console.log('  note', m)
const errs: string[] = []
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(500) } return false }
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const ARGS = ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']

const launch = (dir: string) => puppeteer.launch({ protocolTimeout: 240000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ARGS, userDataDir: dir })
async function page(b: Browser, o: { shiftMs?: number; session?: string } = {}): Promise<Page> {
  const p = await b.newPage()
  await p.setUserAgent(UA)
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  if (o.shiftMs) await p.evaluateOnNewDocument(`(() => {   // a real clock advance: Date.now() and new Date() both
    const off = ${o.shiftMs}, D = Date
    class Dx extends D { constructor(...a) { if (a.length) super(...a); else super(D.now() + off) } static now() { return D.now() + off } }
    window.Date = Dx
  })()`)
  if (o.session) {   // client-side fake of "the session endpoint says this keeper is signed in". Nothing server-side changes.
    await p.setRequestInterception(true)
    p.on('request', r => r.url().includes('/api/auth/session')
      ? r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ session: { user_id: o.session, username: 'm7test', character_id: null, avatar: null } }) })
      : r.continue())
  }
  return p
}
const ready = async (p: Page, path: string, hook = '__ather') => {
  await p.goto(`${URL_}${path}`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction((h: string) => !!(window as any)[h]?.state || !!(window as any)[h], { timeout: 240000 }, hook).catch(() => {})
  await sleep(6000)   // the owner resolves a few frames late; the gate waits for it, so wait past it before judging
}
const gateUp = (p: Page) => p.evaluate(() => !!document.querySelector('[data-panel="birth"]'))
const tapText = async (p: Page, re: RegExp) => {
  const box = await p.evaluate((src: string) => {
    const rx = new RegExp(src, 'i'); let best: DOMRect | null = null, area = Infinity
    for (const e of document.querySelectorAll<HTMLElement>('button, a, [role="button"], div, span')) {
      const t = (e.innerText ?? '').trim(); if (!t || !rx.test(t) || t.length > 40) continue
      const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue
      if (r.width * r.height < area) { area = r.width * r.height; best = r }
    }
    return best && { x: best.x + best.width / 2, y: best.y + best.height / 2 }
  }, re.source)
  if (!box) return false
  await p.touchscreen.tap(box.x, box.y); return true
}
// every persisted thing the open world keeps, read straight from the store (anonymous keys are bare; a signed-in keeper's
// birth/keeper keys carry a `u:<id>:` front marker)
const witness = (p: Page) => p.evaluate(() => {
  const ls = localStorage, all: Record<string, string> = {}
  for (let i = 0; i < ls.length; i++) { const k = ls.key(i)!; all[k] = ls.getItem(k)! }
  // M12 step 1: keeper + garden keys are account-scoped (`u:<id>:` front marker) when signed in, bare when anonymous.
  // ⚠ No named function in here: tsx/esbuild wraps it in `__name(...)`, which does not exist in the page.
  const by: Record<string, string> = {}
  for (const k of Object.keys(all)) by[k.startsWith('u:') ? k.slice(k.indexOf(':', 2) + 1) : k] = all[k]
  const rune = Object.keys(all).filter(k => k.endsWith('ather:shimmer:birthRune')).map(k => `${k}=${all[k]}`)
  const g = by['ather.garden.v1'] ? JSON.parse(by['ather.garden.v1']) : null
  const j = by['open.journal.v1'] ? JSON.parse(by['open.journal.v1']) : null
  const ty = by['open.tycoon.v1'] ? JSON.parse(by['open.tycoon.v1']) : null
  const led = by['ather:trade:trial-ledger'] ? JSON.parse(by['ather:trade:trial-ledger']) : null
  return { rune, garden: g && { grey: g.grey, pages: g.pages, owned: g.owned.length }, inv: by['open.inv.v1'] ?? null,
    journal: j && { active: j.active, chosen: j.chosen }, owned: ty?.owned?.map((o: any) => o.lotId) ?? null, lastMin: ty?.lastMin ?? null, marks: led?.marks ?? null,
    keys: Object.keys(all).filter(k => /^(open\.|ather[.:]|u:)/.test(k)).sort() }
})
type W = Awaited<ReturnType<typeof witness>>
const sameAther = (a: W, b: W, tag: string) => {
  ok(JSON.stringify(a.rune) === JSON.stringify(b.rune) && a.rune.length > 0, `${tag}: birth rune kept (${b.rune.join(',')})`)
  ok(JSON.stringify(a.garden) === JSON.stringify(b.garden), `${tag}: garden kept ${JSON.stringify(b.garden)}`)
  ok(a.inv === b.inv && !!b.inv, `${tag}: inventory kept`)
  ok(JSON.stringify(a.journal) === JSON.stringify(b.journal), `${tag}: journal choice kept ${JSON.stringify(b.journal)}`)
}
const born = async (p: Page, tag: string) => { ok(!(await gateUp(p)), `${tag}: NOT sent back through the birth gate`) }

console.log(`M7 saves  url=${URL_}\n`)
const profile = mkdtempSync(join(tmpdir(), 'm7-profile-'))
let b = await launch(profile)
let p = await page(b)

console.log('A. born, then progress')
await ready(p, '/shimmer/open/ather')
ok(await gateUp(p), 'a fresh keeper meets the birth gate')
ok(await tapText(p, /^BE BORN/), 'tapped BE BORN')
ok(await poll(async () => !(await gateUp(p)), 30000), 'the gate closes after birth')
await sleep(2500); await tapText(p, /^Tap to start$/); await sleep(1000)
await p.evaluate(() => (window as any).__ather.grant(777, 3)); await sleep(1500)
// the pack: swap two bag slots and set a journal line active, through the panel's own controls so the real writers run
// M11 (11-17): on a phone the HUD row folds into one MENU chip; open it before PACK
await p.evaluate(() => document.querySelector<HTMLElement>('[data-touch="menu"]')?.click()); await sleep(600)
await tapText(p, /PACK$/); await sleep(1500)
await p.evaluate(() => document.querySelector<HTMLElement>('[data-pack-tab="bag"]')?.click()); await sleep(800)
const clickSlot = (n: number) => p.evaluate((i: number) => { const e = document.querySelector<HTMLElement>(`[data-slot="${i}"]`); e?.click(); return !!e }, n)
const swapped = (await clickSlot(0)) && (await sleep(600), await clickSlot(9))   // pick the Repeater up, put it down in the bag
await sleep(800)
await p.evaluate(() => document.querySelector<HTMLElement>('[data-pack-tab="journal"]')?.click()); await sleep(1000)
const picked = await p.evaluate(async () => {
  const line = document.querySelectorAll<HTMLElement>('[data-panel="pack-journal"] button.w-full')[1]   // the first line is open already
  line?.click(); await new Promise(r => setTimeout(r, 500))
  const b = [...document.querySelectorAll<HTMLElement>('[data-panel="pack-journal"] button')].filter(x => /Set active/.test(x.textContent ?? '')).pop()
  b?.click(); return !!b
})
await sleep(1000); await p.screenshot({ path: `${OUT}/A-progress.png` })
const W0 = await witness(p)
note(`progress: ${JSON.stringify({ garden: W0.garden, journal: W0.journal, journalClicked: picked, bagSwapped: swapped })}`)
ok(W0.garden?.grey !== undefined && W0.garden.grey >= 777 && W0.garden.pages >= 3, 'garden progress is in the store (grey>=777, pages>=3)')
ok(swapped && !!W0.inv, 'a bag swap through the pack wrote the inventory')
ok(picked && W0.journal?.chosen === true, 'journal "Set active" persisted (chosen)')
ok(W0.rune.length === 1, 'exactly one birth rune key written')
await p.evaluate(() => (window as any).__ather.state?.()); const pos0 = await p.evaluate(() => (window as any).__ather.state?.())

console.log('\nB(a). reload')
await p.reload({ waitUntil: 'load', timeout: 240000 }); await sleep(8000)
await born(p, 'reload'); sameAther(W0, await witness(p), 'reload')
const pos1 = await p.evaluate(() => (window as any).__ather.state?.())
note(`position is NOT a saved thing here: before ${JSON.stringify([pos0?.px, pos0?.pz].map((n: number) => Math.round(n)))} after ${JSON.stringify([pos1?.px, pos1?.pz].map((n: number) => Math.round(n)))}`)

console.log('\nB(b). close the page, open a new one in the same profile')
await p.close(); p = await page(b)
await ready(p, '/shimmer/open/ather')
await born(p, 'new page'); sameAther(W0, await witness(p), 'new page')

console.log('\nC. the continent: buy a business, reload, new page')
await p.goto(`${URL_}/shimmer/open/continent?hour=12&tune=1`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__tycoon?.t, { timeout: 240000 }); await sleep(3000)
ok(!(await gateUp(p)), 'continent: the ather-born keeper is not sent through the birth gate')
await p.keyboard.press('KeyW'); await sleep(500); await p.keyboard.press('BracketRight'); await sleep(1000)   // ?tune=1: ] = 100k Marks
const bought = await p.evaluate((id: string) => (window as any).__tycoon.buy(id, 'mine', 0), offer.lot.id)
ok(bought.ok === true, `bought the Rune Hold mine (${offer.lot.id})${bought.ok ? '' : ': ' + bought.why}`)
await sleep(1500)
const C0 = await witness(p)
ok(!!C0.owned?.includes(offer.lot.id), 'tycoon store holds the deed'); note(`ledger marks after buy: ${C0.marks}`)
await p.reload({ waitUntil: 'load', timeout: 240000 }); await p.waitForFunction(() => !!(window as any).__tycoon?.t, { timeout: 240000 }); await sleep(2500)
const C1 = await witness(p)
ok(!!C1.owned?.includes(offer.lot.id), 'continent reload: deed kept'); ok(C1.marks !== null && C1.marks >= (C0.marks ?? 0) - 1, `continent reload: purse kept (${C1.marks})`)
await p.close(); p = await page(b)
await p.goto(`${URL_}/shimmer/open/continent?hour=12&tune=1`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__tycoon?.t, { timeout: 240000 }); await sleep(2500)
const C2 = await witness(p)
ok(!!C2.owned?.includes(offer.lot.id) && !(await gateUp(p)), 'continent new page: deed kept, no birth gate')
// the same keeper's ather save is untouched by the continent session
sameAther(W0, C2, 'after continent')
await sleep(2000)   // let any debounced write land before the browser goes
const Cfinal = await witness(p)

console.log('\nC(c). close the browser, relaunch on the same userDataDir')
await b.close(); await sleep(1500)
b = await launch(profile); p = await page(b)
await ready(p, '/shimmer/open/ather')
await born(p, 'relaunch'); const R1 = await witness(p); sameAther(W0, R1, 'relaunch')
ok(!!R1.owned?.includes(offer.lot.id), 'relaunch: the continent deed is still owned'); ok(R1.marks === Cfinal.marks, `relaunch: purse unchanged (${R1.marks})`)

console.log('\nD. next day: relaunch with the page clock +26 h')
note('time-based state in the open world: tycoon catch-up (capped at 8 h away), forestry regrow stamps, ather.nodes skew. Nothing EXPIRES a save.')
await b.close(); await sleep(1500)
b = await launch(profile); p = await page(b, { shiftMs: 26 * 3600e3 })
await p.goto(`${URL_}/shimmer/open/continent?hour=12&tune=1`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__tycoon?.t, { timeout: 240000 }); await sleep(3500)
const D1 = await witness(p)
ok(!(await gateUp(p)), 'next day: not sent back through the birth gate')
ok(!!D1.owned?.includes(offer.lot.id), 'next day: the deed is still owned')
ok((D1.lastMin ?? 0) - (R1.lastMin ?? 0) >= 25 * 60, `next day: the clock took effect and the tycoon settled the time away (lastMin +${(D1.lastMin ?? 0) - (R1.lastMin ?? 0)} min)`)
note(`purse across the day: ${R1.marks} -> ${D1.marks} (catch-up is capped at 8 h away)`)
await ready(p, '/shimmer/open/ather')
await born(p, 'next day'); sameAther(W0, await witness(p), 'next day')
await b.close()

console.log('\nE. anonymous -> signed-in (the session answer faked client-side; the real OAuth is not scripted)')
const profE = mkdtempSync(join(tmpdir(), 'm7-profile-E-'))
b = await launch(profE); p = await page(b)
await ready(p, '/shimmer/open/ather'); await tapText(p, /^BE BORN/); await poll(async () => !(await gateUp(p)), 30000); await sleep(2500)
await p.evaluate(() => (window as any).__ather.grant(500, 2)); await sleep(1500)
const E0 = await witness(p); note(`anonymous keeper: rune=${E0.rune.join(',')} garden=${JSON.stringify(E0.garden)}`)
await p.close()
const SIGNED = 'm7-test-user'
p = await page(b, { session: SIGNED })
await ready(p, '/shimmer/open/ather')
const E1 = await witness(p)
note(`signed in, straight into /shimmer/open/ather: gate=${await gateUp(p)} rune keys=${E1.rune.join(',') || '(none)'}`)
ok(!(await gateUp(p)), 'sign-in on the open world: the anonymous keeper is NOT sent back through the birth gate')
ok(JSON.stringify(E1.garden) === JSON.stringify(E0.garden), `sign-in: garden kept ${JSON.stringify(E1.garden)}`)
ok(E1.inv === E0.inv, 'sign-in: inventory kept')
await p.screenshot({ path: `${OUT}/E-signin.png` })
await p.close(); await b.close()

console.log('\nE2. the same, but signing in lands on /shimmer first (the one route that adopts the anonymous keeper)')
const profF = mkdtempSync(join(tmpdir(), 'm7-profile-F-'))
b = await launch(profF); p = await page(b)
await ready(p, '/shimmer/open/ather'); await tapText(p, /^BE BORN/); await poll(async () => !(await gateUp(p)), 30000); await sleep(2500)
await p.evaluate(() => (window as any).__ather.grant(300, 1)); await sleep(1500)
const F0 = await witness(p); await p.close()
p = await page(b, { session: SIGNED + '-2' })
await p.goto(`${URL_}/shimmer`, { waitUntil: 'load', timeout: 240000 }); await sleep(8000)
await ready(p, '/shimmer/open/ather')
const F1 = await witness(p)
note(`after /shimmer adoption: rune keys=${F1.rune.join(',')}`)
ok(!(await gateUp(p)), 'adopted via /shimmer: no birth gate on the open world')
ok(JSON.stringify(F1.garden) === JSON.stringify(F0.garden), 'adopted via /shimmer: garden kept')
await p.close(); await b.close()

console.log('\nG. born in the open world, anonymous, then the keeper opens /shimmer (the site-wide default sign-in return path, and the games list link)')
const profG = mkdtempSync(join(tmpdir(), 'm7-profile-G-'))
b = await launch(profG); p = await page(b)
await ready(p, '/shimmer/open/ather'); await tapText(p, /^BE BORN/); await poll(async () => !(await gateUp(p)), 30000); await sleep(2500)
const G0 = await witness(p); note(`before: rune=${G0.rune.join(',')} epoch key=${await p.evaluate(() => localStorage.getItem('ather:epoch'))}`)
await p.goto(`${URL_}/shimmer`, { waitUntil: 'load', timeout: 240000 }); await sleep(8000)
await ready(p, '/shimmer/open/ather')
const G1 = await witness(p)
note(`after /shimmer: rune=${G1.rune.join(',') || '(none)'} epoch key=${await p.evaluate(() => localStorage.getItem('ather:epoch'))}`)
ok(G1.rune.length > 0, 'visiting /shimmer does not erase the open-world keeper\'s birth rune')
ok(!(await gateUp(p)), 'and the keeper is not sent back through the birth gate')
await b.close()

ok(errs.length === 0, `no page errors${errs.length ? ': ' + [...new Set(errs)].slice(0, 4).join(' | ') : ''}`)
for (const d of [profile, profE, profF, profG]) { try { rmSync(d, { recursive: true, force: true }) } catch { /* tmp */ } }
console.log(fails ? `\nbeta-m7-saves: ${fails} FAIL` : '\nbeta-m7-saves: PASS')
process.exit(fails ? 1 : 0)
