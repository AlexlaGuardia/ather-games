// BETA M71 s1: GREG FOLDS YOUR GARDEN, on prod, 390x844. npx tsx scripts/m71-fold-check.mts [--url ...] [--out ...]
// garden-fold.ts: a newborn has no garden until Greg folds the first one for exactly 100 grey matter; an existing garden is never taken.
//   A (FRESH profile): born in the Glade; the tutorial save is unfolded; 'home' keeps them in the Glade (no garden); Greg makes no
//     ground / tour offer and no fold offer before the first settlement's thanks. Then the save is set at the fold beat (m70
//     'thanked': m70-settlement-check walks that part on prod) and grey matter is granted (__ather.grant, the check-only probe):
//     at 60 Greg's fold refuses with the reason, nothing spent; at 130 the fold spends EXACTLY 100 (30 left), the flag is saved,
//     'To my garden' lands on the plot (the garden loads). Reload: still folded, 30 grey, home = the plot.
//   B (an EXISTING garden, a pre-M71 save without the field): it loads on its plot, home = the plot, Greg offers 'My ground' and
//     no fold, the garden's squares and grey are untouched.
//   0 page errors throughout.
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { FOLD_TEXT, FOLD_COST } from '../src/app/shimmer/open/ather/garden-fold'
import { ANSWERS } from '../src/app/shimmer/open/ather/greg-talk'
import { TOUR_ASK } from '../src/app/shimmer/open/ather/greg-tour'
import { STARTING_SQUARES, ringOf, GRID, sqId } from '../src/app/shimmer/open/ather/plot'
import { LAYOUT } from '../src/app/shimmer/open/ather/garden-snapshot'

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games').replace(/\/$/, ''), out = flag('--out', '/tmp/m71')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
const errs: string[] = []
const poll = async (f: () => Promise<boolean>, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }

async function page() {
  const p: Page = await (await br.createBrowserContext()).newPage()
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  const A = (fn: string, ...args: unknown[]) => p.evaluate((f: string, a: unknown[]) => (window as any).__ather?.[f]?.(...a), fn, args)
  const bubble = () => p.evaluate(() => { const b = document.querySelector('[data-talk-bubble]'); if (!b) return null; const sc = b.querySelector('[data-talk-scene]')?.textContent ?? ''; return (b.firstElementChild?.textContent ?? '').slice(sc.length) }) as Promise<string | null>
  const opts = () => p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-talk-option]')].map(e => (e.textContent ?? '').replace(/^›/, '').replace(/short$/i, '').trim())) as Promise<string[]>
  const pick = (label: string) => p.evaluate((l: string) => { const b = [...document.querySelectorAll<HTMLButtonElement>('[data-talk-option]')].find(e => (e.textContent ?? '').includes(l)); b?.click(); return !!b }, label)
  const store = (suffix: string) => p.evaluate((s: string) => { const k = Object.keys(localStorage).find(x => x.endsWith(s)); return k ? JSON.parse(localStorage.getItem(k) ?? 'null') : null }, suffix) as Promise<any>
  const greg = async () => { await A('open', 'greg'); await poll(async () => !!(await bubble()), 8000); await sleep(400); return { line: (await bubble()) ?? '', opts: await opts() } }
  const closeTalk = async () => { await p.keyboard.press('Escape'); await sleep(500); if (await p.$('[data-talk-choices]')) { await pick(ANSWERS.bye); await sleep(500) } }
  const zoneIs = (z: string, ms = 30000) => poll(async () => (await A('zone')) === z, ms)
  return { p, A, bubble, opts, pick, store, greg, closeTalk, zoneIs }
}
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
  await p.mouse.click(box.x, box.y); return true
}

try {
  // ── A · a FRESH profile ──
  {
    const { p, A, pick, store, greg, closeTalk, zoneIs } = await page()
    await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
    await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 })
    ok(await poll(() => p.evaluate(() => !!document.querySelector('[data-panel="birth"]')), 90000), 'A. fresh profile: the birth gate')
    await tapText(p, /^BE BORN/)
    ok(await poll(() => p.evaluate(() => !!document.querySelector('[data-creator-done]')), 45000), 'A. the creator')
    await (await p.$('[data-creator-done]'))?.click()
    ok(await zoneIs('glade', 60000), `A. born in the Glade (zone ${await A('zone')})`)
    await sleep(3000)
    let g = await greg(); await closeTalk()   // the first E writes the tutorial save
    let t = await store('open.tutorial.v1')
    ok(t?.live === true && t?.folded === false, `A. the newborn's save: live, folded=${t?.folded}`)
    await A('travel', { kind: 'home' }); await sleep(4000)
    ok((await A('zone')) === 'glade', `A. no garden yet: 'home' keeps the keeper in the Glade (zone ${await A('zone')})`)
    // walk the save to the fold beat (the tutorial heard, the first settlement thanked), keeping the newborn's own flag
    await p.evaluate(() => { const k = Object.keys(localStorage).find(x => x.endsWith('open.tutorial.v1'))!; const o = JSON.parse(localStorage.getItem(k)!); Object.assign(o, { greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], b2: 'accepted' }); localStorage.setItem(k, JSON.stringify(o)) })
    g = await greg()
    ok(!g.opts.includes(ANSWERS.ground) && !g.opts.includes(TOUR_ASK) && !g.opts.includes(FOLD_TEXT.ask), `A. before the settlement: no 'My ground', no tour, no fold (${g.opts.join(' / ')})`)
    await closeTalk()
    await p.evaluate(() => { const k = Object.keys(localStorage).find(x => x.endsWith('open.tutorial.v1'))!; const o = JSON.parse(localStorage.getItem(k)!); o.m70 = 'thanked'; localStorage.setItem(k, JSON.stringify(o)) })
    await A('resetGarden'); await sleep(300); await A('grant', 60); await sleep(500)
    g = await greg()
    ok(g.line === FOLD_TEXT.offer && g.opts[0] === FOLD_TEXT.ask, `A. at the fold beat Greg offers the fold ('${g.line}' / ${g.opts.join(' / ')})`)
    await pick(FOLD_TEXT.ask); await sleep(800)
    g = { line: (await (async () => { await poll(async () => (await p.evaluate(() => document.querySelector('[data-talk-bubble]')?.textContent ?? '')).includes('not enough'), 6000); return p.evaluate(() => { const b = document.querySelector('[data-talk-bubble]'); const sc = b?.querySelector('[data-talk-scene]')?.textContent ?? ''; return (b?.firstElementChild?.textContent ?? '').slice(sc.length) }) })()) ?? '', opts: [] }
    ok(g.line === FOLD_TEXT.short(60), `A. at 60 grey matter Greg refuses with the reason ('${g.line}')`)
    t = await store('open.tutorial.v1'); let gd = await store('ather.garden.v1')
    ok(t?.folded === false && gd?.grey === 60, `A. refused: nothing spent (grey ${gd?.grey}), still unfolded`)
    await p.screenshot({ path: `${out}/a-refuse.png` })
    await closeTalk()
    await A('grant', 70); await sleep(500)
    gd = await store('ather.garden.v1'); const before = gd?.grey
    g = await greg(); await pick(FOLD_TEXT.ask)
    ok(await poll(async () => (await p.evaluate(() => document.querySelector('[data-talk-bubble]')?.textContent ?? '')).includes(FOLD_TEXT.done.slice(0, 12)), 8000), 'A. at 130 the fold goes through')
    t = await store('open.tutorial.v1'); gd = await store('ather.garden.v1')
    ok(before === 130 && gd?.grey === before - FOLD_COST, `A. grey matter ${before} -> ${gd?.grey}: exactly ${FOLD_COST} spent`)
    ok(t?.folded === true, 'A. the folded flag is saved')
    await p.screenshot({ path: `${out}/a-folded.png` })
    await pick(FOLD_TEXT.go)
    ok(await zoneIs('plot', 30000), `A. 'To my garden': the garden's gate opens, the plot loads (zone ${await A('zone')})`)
    await sleep(3000)
    ok((await A('zone')) === 'plot', 'A. and stays there (no bounce back to the Glade)')
    await p.screenshot({ path: `${out}/a-garden.png` })
    await p.reload({ waitUntil: 'load', timeout: 240000 })
    await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(5000)
    t = await store('open.tutorial.v1'); gd = await store('ather.garden.v1')
    ok(t?.folded === true && gd?.grey === 30, `A. reload: still folded, ${gd?.grey} grey matter`)
    await A('travel', { kind: 'home' })
    ok(await zoneIs('plot', 30000), `A. reload: home = the plot (zone ${await A('zone')})`)
    g = await greg()
    ok(!g.opts.includes(FOLD_TEXT.ask), `A. Greg never offers the fold twice (${g.line.slice(0, 40)} / ${g.opts.join(' / ')})`)
    await p.close()
  }

  // ── B · an EXISTING garden (a pre-M71 save: no 'folded' field) ──
  {
    const extra: string[] = []
    for (let j = 0; j < GRID && extra.length < 2; j++) for (let i = 0; i < GRID && extra.length < 2; i++) if (ringOf(i, j) === 1) extra.push(sqId(i, j))
    const owned = [...STARTING_SQUARES, ...extra]
    const { p, A, store, greg, zoneIs } = await page()
    await p.evaluateOnNewDocument((owned: string[], layout: number) => {
      if (sessionStorage.getItem('seeded')) return
      sessionStorage.setItem('seeded', '1')
      localStorage.setItem('ather:shimmer:birthRune', 'star')
      localStorage.setItem('ather.garden.v1', JSON.stringify({ owned, grey: 77, pages: 10, layout }))
      localStorage.setItem('open.tutorial.v1', JSON.stringify({ v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null, m70: 'thanked', m70node: null, m70side: 'none' }))
    }, owned, LAYOUT)
    await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
    await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(5000)
    ok((await A('zone')) === 'plot', `B. an existing garden loads on its plot (zone ${await A('zone')})`)
    await A('travel', { kind: 'glade' }); await zoneIs('glade', 30000)
    await A('travel', { kind: 'home' })
    ok(await zoneIs('plot', 30000), `B. home = the plot (zone ${await A('zone')})`)
    await sleep(3000)
    ok((await A('zone')) === 'plot', 'B. and stays there')
    const g = await greg()
    ok(g.opts.includes(ANSWERS.ground) && !g.opts.includes(FOLD_TEXT.ask) && g.line !== FOLD_TEXT.offer, `B. Greg: 'My ground', no fold step (${g.opts.join(' / ')})`)
    const gd = await store('ather.garden.v1'), t = await store('open.tutorial.v1')
    ok(gd?.grey === 77 && owned.every(s => gd?.owned?.includes(s)) && gd?.owned?.length === owned.length, `B. the garden is intact: ${gd?.owned?.length}/${owned.length} squares, ${gd?.grey} grey`)
    ok(t?.folded !== false, `B. the save is not marked unfolded (folded=${t?.folded})`)
    await p.screenshot({ path: `${out}/b-existing.png` })
    await p.close()
  }
  ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} catch (e) { ok(false, `threw: ${String(e).slice(0, 300)}`) } finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'ALL PASS')
process.exit(fails ? 1 : 0)
