// M234 s1 (canon game/alchemy.md › THE RECIPES SIT-DOWN, 11-27): the potions + the earth infusion were RENAMED and the saved
// ids kept. A test keeper's bag SAVED WITH THE OLD IDS (potion:health/mana/wisdom, starlight_tincture, golden_tonic) is opened
// (+ athernyx 1d9035f: alc:goldleaf_steep, the Nook's product, now a SIMMER) in the open-world Glade: every stack is there, its slot title reads the NEW name, and no old name shows anywhere on the page.
// Fresh profile, never a real save. Desktop opens the bag with I; --phone (390x844 touch) taps the "pack" button.
//   npx tsx scripts/m234-potion-names-check.mts [--url https://ather.games] [--out dir] [--phone]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { dismissStartCard } from './lib/start-card.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m234'), PHONE = process.argv.includes('--phone')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const OLD = /Health Draught|Mana Draught|Starlight Tincture|Lull Draught|Golden Tonic|Goldleaf Steep|Shard Steep/i
const KEPT: [string, number, string][] = [
  ['potion:health:D', 3, 'Health Salve · D'], ['potion:mana:S', 2, 'Mana Elixir · S'], ['potion:wisdom:A', 1, 'Starlight Tonic · A'],
  ['starlight_tincture', 4, 'Starlight Tonic'], ['golden_tonic', 5, 'Golden Glaze'], ['alc:goldleaf_steep:B', 1, 'Goldleaf Simmer · B'],
]
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport(PHONE ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1280, height: 800 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument((kept: [string, number, string][]) => {
    if (sessionStorage.getItem('m234.seeded')) return; sessionStorage.setItem('m234.seeded', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.tutorial.v1', JSON.stringify({ v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null }))
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'waymark', n: 3 }
    kept.forEach(([id, n], i) => { slots[10 + i] = { id, n } })
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  }, KEPT)
  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(2500)
  if (PHONE) await dismissStartCard(p)
  if (PHONE) {
    const b = await p.evaluate(() => { const e = [...document.querySelectorAll<HTMLElement>('[data-touch-cluster] button, button')].find(x => /(^|\s)pack$/i.test((x.innerText ?? '').trim())); const r = e?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null })
    ok(!!b, '0. phone: the pack button is there')
    if (b) await p.touchscreen.tap(b.x, b.y)
  } else await p.keyboard.press('KeyI')
  await sleep(1200)
  ok(!!(await p.$('[data-panel="pack-bag"]')), '1. the bag opens')
  const titles = await p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-panel="pack-bag"] [data-slot]')].map(e => e.title))
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('open.inv.v1') ?? 'null')?.slots ?? [])
  for (const [id, n, name] of KEPT) {
    const have = (saved as ({ id: string; n: number } | null)[]).reduce((a, s) => a + (s?.id === id ? s.n : 0), 0)
    ok(have === n, `2. the old save's ${id} x${n} is still in the bag (${have})`)
    ok(titles.some(t => t === `${name}${n > 1 ? ` × ${n}` : ''}`), `3. a slot reads "${name}${n > 1 ? ` × ${n}` : ''}"`)
  }
  const oldTitle = titles.filter(t => OLD.test(t)); const page = await p.evaluate(() => document.body.innerText)
  ok(!oldTitle.length && !OLD.test(page), `4. no old name on the page (titles ${JSON.stringify(oldTitle)}, text ${OLD.exec(page)?.[0] ?? 'none'})`)
  if (PHONE) { const fit = await p.evaluate(() => { const r = document.querySelector('[data-panel="pack-bag"]')?.getBoundingClientRect(); return r ? { l: r.left, r: r.right, w: innerWidth, s: document.documentElement.scrollWidth } : null }); ok(!!fit && fit.l >= -1 && fit.r <= fit.w + 1 && fit.s <= fit.w + 1, `5. phone: the bag fits 390 (${JSON.stringify(fit)})`) }
  await p.screenshot({ path: `${out}/bag-${PHONE ? '390' : 'desk'}.png` })
  ok(!errs.length, `6. no page errors (${errs.join(' | ').slice(0, 200)})`)
} finally { await br.close() }
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
