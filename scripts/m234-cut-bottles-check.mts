// M234 s1b (athernyx d0211ca + 30d19fd, Alex 11-27): the two spirit bottles are CUT, the Holding Philter and the Bond Philter.
// Two legs, fresh profile, never a real save:
//   A. the open-world Glade: a bag SAVED holding both cut ids (next to moonberries and wakereed) loads clean: the bag opens,
//      the other stacks are there, no slot and no page text names a cut bottle, 0 page errors.
//   B. the voxel world (/shimmer/voxel3d): loads with 0 page errors and NO script it loaded carries either name (so no recipe
//      book, brewing panel, shop or item card there can show one). Its old-save load is unit-proven (cut-items.test.ts).
// Desktop opens the open-world bag with I; --phone (390x844 touch) taps MENU then pack.
//   npx tsx scripts/m234-cut-bottles-check.mts [--url https://ather.games] [--out dir] [--phone]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync, readFileSync, readdirSync, existsSync } from 'node:fs'
import { dismissStartCard } from './lib/start-card.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m234b'), PHONE = process.argv.includes('--phone')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const NAMES = /holding\s*philter|bond\s*philter/i
const CUT = ['holding_philter', 'bond_philter']
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const view = async (p: Page) => p.setViewport(PHONE ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1280, height: 800 })
const tag = PHONE ? '390' : 'desk'
try {
  // ── A. the open world ──────────────────────────────────────────────────────────────────────────
  {
    const p = await (await br.createBrowserContext()).newPage(); await view(p)
    const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
    await p.evaluateOnNewDocument(() => {
      if (sessionStorage.getItem('m234b.seeded')) return; sessionStorage.setItem('m234b.seeded', '1')
      localStorage.setItem('ather:shimmer:birthRune', 'star')
      localStorage.setItem('open.tutorial.v1', JSON.stringify({ v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null }))
      const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'waymark', n: 3 }
      slots[10] = { id: 'holding_philter', n: 2 }; slots[11] = { id: 'bond_philter', n: 3 }; slots[12] = { id: 'moonberry', n: 4 }; slots[13] = { id: 'wakereed', n: 5 }
      localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    })
    await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
    if (PHONE) { await sleep(8000); await dismissStartCard(p, 60000) }
    await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(2500)
    if (PHONE) await dismissStartCard(p)
    if (PHONE) {
      const m = await p.evaluate(() => { const r = document.querySelector<HTMLElement>('[data-touch="menu"]')?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null })
      if (m) { await p.touchscreen.tap(m.x, m.y); await sleep(600) }
      const b = await p.evaluate(() => { const r = document.querySelector<HTMLElement>('[data-touch="pack"]')?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null })
      if (b) await p.touchscreen.tap(b.x, b.y)
    } else await p.keyboard.press('KeyI')
    await sleep(1200)
    ok(!!(await p.$('[data-panel="pack-bag"]')), 'A1. open world: the bag opens over an old save holding both cut bottles')
    const titles = await p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-panel="pack-bag"] [data-slot]')].map(e => e.title))
    ok(titles.some(t => /^Moonberr/i.test(t)) && titles.some(t => /^Wakereed/i.test(t)), `A2. the moonberries and the wakereed are still in the bag (${titles.filter(t => /moon|wake/i.test(t)).join(' | ')})`)
    const page = await p.evaluate(() => document.body.innerText)
    ok(!titles.some(t => NAMES.test(t)) && !NAMES.test(page), `A3. no slot and no page text names a cut bottle (${NAMES.exec(page)?.[0] ?? 'none'})`)
    await sleep(6000)
    const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('open.inv.v1') ?? 'null')?.slots ?? []) as ({ id: string } | null)[]
    ok(!saved.some(s => s && CUT.includes(s.id)), 'A4. the bag as saved again holds neither cut id')
    await p.screenshot({ path: `${out}/open-bag-${tag}.png` })
    ok(!errs.length, `A5. open world: no page errors (${errs.join(' | ').slice(0, 200)})`)
  }
  // ── B. the voxel world ─────────────────────────────────────────────────────────────────────────
  {
    const p = await (await br.createBrowserContext()).newPage(); await view(p)
    const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
    const scripts = new Set<string>()
    p.on('response', r => { if (r.url().endsWith('.js') || r.request().resourceType() === 'script') scripts.add(r.url()) })
    // The voxel world is heavy under software GL; its old-save load is proven by cut-items.test.ts, so this leg only loads it,
    // listens (no page.evaluate: the main thread can be busy for minutes) and reads every script it pulled from node.
    await p.goto(`${url}/shimmer/voxel3d`, { waitUntil: 'load', timeout: 240000 }); await sleep(30000)
    let hits = 0, read = 0
    for (const s of scripts) { try { const t = await (await fetch(s)).text(); read++; if (NAMES.test(t)) { hits++; console.log('   carries a cut name:', s) } } catch { /* skip */ } }
    ok(read > 3 && hits === 0, `B4. none of the ${read} scripts the voxel world loaded carries either name`)
    try { await p.screenshot({ path: `${out}/voxel-${tag}.png`, timeout: 60000 } as never) } catch { /* a busy frame: the shot is not the proof */ }
    ok(!errs.length, `B5. voxel world: no page errors (${errs.join(' | ').slice(0, 200)})`)
  }
  // ── C. every chunk the live build serves (BOX-ONLY: the chunk list is read from the build dir `.next-active` names; every
  //    file is then fetched from the public url, so what is judged is what prod serves). Catches lazy chunks B never pulled.
  if (!existsSync(`${new URL('..', import.meta.url).pathname}.next-active`)) console.log('- C skipped: no live build dir here (run on the box for C)')
  else {
    const root = new URL('..', import.meta.url).pathname
    const dir = `${root}${readFileSync(`${root}.next-active`, 'utf8').trim()}/static/chunks`
    const files = readdirSync(dir).filter(f => f.endsWith('.js'))
    let got = 0, hits = 0
    for (const f of files) { try { const r = await fetch(`${url}/_next/static/chunks/${f}`); if (r.status !== 200) continue; got++; if (NAMES.test(await r.text())) { hits++; console.log('   prod chunk carries a cut name:', f) } } catch { /* skip */ } }
    ok(got > 100 && hits === 0, `C1. none of the ${got} live chunks (of ${files.length} in the build) carries either name`)
  }
} finally { await br.close() }
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
