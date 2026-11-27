// ── BETA M203 THE GRIMOIRE GETS A PAGE PER SECOND FORM: OWNER + ?spirits=3d (2026-11-26, play-M203) ─────────────────────
// Alex 11-26 (reverses 11-14 'no evolution pages'): each second form a keeper's spirit takes gets its own new page, SEEN,
// numbered after the pages already filled (discovery order); one page per form however many keepers take it.
// s2 (RULED 142d15d, Magii + Alex 11-26): form pages COUNT toward the 10 / 15 / 25 ring tiers like base pages, each page = one.
// SETUP (stated): book = 9 base pages (fox first); a bloomed fox planter (party, following) whose Earth form stat bar is met
// (30 growths + 5 GRD), a grimoire pedestal beside it; bag = 3 Earth Meals.
//  A. the pedestal before: 9 pages, no form page; the ground's page count (HUD Grimoire = what canBuy reads): 9, ring sealed.
//  B. evolve her the M204 way: feed 3 Earth Meals in her panel.
//  C. the pedestal: page 10 = her form (fox, earth, Seen, the form's name + its 2D art), base 9, tier count 10;
//     the ground's page count: 10, the first ring OPEN.
//  D. reload: page 10 still there, the ring still open.  E. a second fox keeper takes the same Earth form (save edit +
//     reload): still ONE form page, still 10.
//   npx tsx scripts/m203-form-pages-check.mts [--url http://localhost:3202] [--out docs/looks/m203-2026-11-26]
import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { BLOOM_MS } from '../src/app/shimmer/open/ather/spirit-seeds'
import { secondFormName } from '../src/app/shimmer/spirits/evolution'
import { aimAt } from './lib/aim.mts'
import { RING_PAGES } from '../src/app/shimmer/open/ather/plot'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', 'docs/looks/m203-2026-11-26')
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.error('no OWNER_KEY (env or .env)'); process.exit(2) }
const P = { x: -130, z: 102.5 }, KEEP = { x: P.x - 1.5, z: P.z + 2.5 }
const PLANTER = { id: 'vx-check', item: 'spirit_planter', x: P.x, z: P.z, q: 0, placedAt: 1 }
const PEDESTAL = { id: 'gp-check', item: 'grimoire_pedestal', x: -126, z: 102.5, q: 0, placedAt: 1 }
const REC = { form: 'base', g: { grd: 5 }, plays: 5, xp: 0, grown: 30 }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.goto(`${new URL(url).origin}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await p.goto(`${new URL(url).origin}/api/owner`, { waitUntil: 'load', timeout: 60000 })
  if (!await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner))) { ok(false, 'owner cookie took'); process.exit(1) }
  await p.evaluateOnNewDocument((pieces: unknown, at: number, rec: unknown) => {
    if (sessionStorage.getItem('m203')) return; sessionStorage.setItem('m203', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null)
    slots[0] = { id: 'waymark', n: 12 }; slots[1] = { id: 'earth_meal', n: 3 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces }))
    localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: ['fox', 'owl', 'axolotl', 'water-bear', 'turtle', 'frog', 'firefly', 'rabbit', 'bat'].map((species, i) => ({ species, stage: 'seen', at: i + 1 })), pots: { 'vx-check': { seed: 'mana_seed_fox', at, bloomed: true } }, met: [] }))
    localStorage.setItem('ather.spiritParty.v1', JSON.stringify(['vx-check']))
    localStorage.setItem('ather.spiritFollow.v1', JSON.stringify(['vx-check']))
    localStorage.setItem('ather.spiritStats.v1', JSON.stringify({ 'vx-check': rec }))
  }, [PLANTER, PEDESTAL], Date.now() - BLOOM_MS - 60000, REC)
  const shot = async (n: string) => { try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
  const click = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (!b) return false; await p.mouse.click(b.x, b.y); return true }
  const load = async () => { await p.goto(`${url}/shimmer/open/ather?hour=14&spirits=3d`, { waitUntil: 'load', timeout: 180000 }); await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500) }
  const tp = (x: number, z: number) => p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), x, z)
  // the grimoire key on this profile (a garden key may be prefixed): the one holding her pot
  const bookKey = () => p.evaluate(() => Object.keys(localStorage).filter(x => x.endsWith('ather.grimoire.v1')).find(k => !!JSON.parse(localStorage.getItem(k)!)?.pots?.['vx-check']) ?? null)
  type Ped = { open: boolean; count: string | null; forms: string | null; pages: { n: number; sp: string; form: string; stage: string; img: string | null }[] }
  async function pedestal(): Promise<Ped> {
    for (let k = 0; k < 4; k++) {
      await tp(PEDESTAL.x, PEDESTAL.z + 1.3); await sleep(1500); await aimAt(p, PEDESTAL.x, PEDESTAL.z, 0.9); await p.keyboard.press('e'); await sleep(1200)
      if (await p.evaluate(() => !!document.querySelector('[data-panel="grimoire"]'))) break
      await p.keyboard.press('Escape'); await sleep(400)
    }
    return p.evaluate(() => {
      const g = document.querySelector('[data-panel="grimoire"]'), c = g?.querySelector('[data-grimoire-count]')
      return { open: !!g, count: c?.getAttribute('data-grimoire-count') ?? null, forms: c?.getAttribute('data-grimoire-forms') ?? null,
        pages: [...(g?.querySelectorAll('[data-page]') ?? [])].map(b => ({ n: Number(b.getAttribute('data-page')), sp: b.getAttribute('data-species') ?? '', form: b.getAttribute('data-form') ?? '', stage: b.getAttribute('data-stage') ?? '', img: b.querySelector('img')?.getAttribute('src') ?? null })).filter(x => x.stage !== 'empty') }
    }) as Promise<Ped>
  }
  // M203 s2: the ring tier as the page reads it: the HUD's Grimoire chip = pagesNow, the number Greg's canBuy and the
  // ground panel are handed (garden grants + every grimoire page, base and form)
  async function ground(): Promise<{ pages: number; ring: number }> {
    const t = await p.evaluate(() => document.querySelector('[data-hud="status"]')?.textContent ?? '')
    const pages = Number(/Grimoire\s*(\d+)/.exec(t)?.[1] ?? -1)
    return { pages, ring: RING_PAGES.filter(r => pages >= r).length - 1 }
  }
  const filled = (d: Ped) => d.pages.map(x => `${x.n}:${x.sp}${x.form ? '/' + x.form : ''}:${x.stage}`).join(' ')

  // ── A. before: two base pages
  await load()
  const a = await pedestal()
  ok(a.open && a.pages.length === 9 && a.count === '9' && a.forms === '0', `A before: 9 base pages, no form page (${filled(a)})`)
  await shot('a-before'); await p.keyboard.press('Escape'); await sleep(500)
  const ga = await ground()
  ok(ga.pages === 9 && ga.ring === 0, `A the ground's page count: 9, the 10-page ring sealed (pages ${ga.pages}, rings open past the first: ${ga.ring})`)

  // ── B. evolve her the M204 way (3 Earth Meals fed in her panel)
  await tp(KEEP.x, KEEP.z)
  for (let i = 0; i < 60; i++) { await sleep(500); if (await p.evaluate(() => !!(window as any).__spiritModel?.trots?.fox)) break }
  let formEl: string | null = null
  for (let k = 0; k < 10 && !formEl; k++) {
    await sleep(3000)
    const t = await p.evaluate(() => { const q = (window as any).__spiritModel?.trots?.fox; return q ? { x: q.x, z: q.z, y: q.y, h: q.h } : null }) as { x: number; z: number; y: number; h: number } | null
    if (!t) continue
    await aimAt(p, t.x, t.z, t.y - (await p.evaluate((x, z) => (window as any).__ather.ground(x, z), t.x, t.z) as number) + t.h * 0.5, 4)
    await p.keyboard.press('e'); await sleep(900)
    const picked = await p.evaluate(() => { const b = [...document.querySelectorAll('[data-talk-option]')].find(x => (x.textContent ?? '').replace('›', '').trim().startsWith('Open')) as HTMLButtonElement | undefined; b?.click(); return !!b })
    if (!picked) { await p.keyboard.press('Escape'); await sleep(400); continue }
    await sleep(2000)
    for (let m = 0; m < 3; m++) { await click('[data-feed-meal="earth_meal"]'); await sleep(1000) }
    formEl = await p.evaluate(() => document.querySelector('[data-panel="spirit"] [data-form-element]')?.getAttribute('data-form-element') ?? null)
  }
  ok(formEl === 'earth', `B three Earth Meals fed: she takes her Earth form (${formEl})`)
  await shot('b-evolved'); await p.keyboard.press('Escape'); await sleep(600)

  // ── C. the pedestal: page 3 = her form
  const name = secondFormName({ species: 'fox' }, 'earth')
  const c = await pedestal()
  const f3 = c.pages.find(x => x.n === 10)
  ok(c.pages.length === 10 && !!f3 && f3.sp === 'fox' && f3.form === 'earth' && f3.stage === 'seen', `C a new page 10 for her form, Seen, after the 9 base pages (${filled(c)})`)
  ok(f3?.img === '/spirits/grimoire/fox-earth.webp', `C its picture is the locked 2D form art (${f3?.img})`)
  ok(c.count === '10' && c.forms === '1', `C the tier count is 10 (9 base + 1 form), forms 1 (${c.count}, ${c.forms})`)
  await click('[data-page="10"]'); await sleep(600)
  const title = await p.evaluate(() => document.querySelector('[data-page-open="10"]')?.textContent ?? '')
  ok(title.includes(name) && title.includes('Seen'), `C page 10 opens: ${name}, Seen (${title.slice(0, 80)})`)
  const fit = await p.evaluate(() => { const e = document.querySelector('[data-panel="grimoire"]'); if (!e) return null; const r = e.getBoundingClientRect(); return r.left >= -0.5 && r.right <= innerWidth + 0.5 })
  ok(fit === true, 'C the grimoire fits 390 wide')
  // M200 (play-M200, the M203 find): the grimoire's Party roster names her by her FORM now, not her base name
  const rosterName = await p.evaluate(() => document.querySelector('[data-roster-spirit="vx-check"]')?.getAttribute('data-roster-name') ?? document.querySelector('[data-roster-spirit="vx-check"]')?.textContent ?? null)
  ok(rosterName === name, `C the Party roster names her ${name}, not her base name (${rosterName})`)
  await shot('c-form-page'); await p.keyboard.press('Escape'); await sleep(500)
  const gc = await ground()
  ok(gc.pages === 10 && gc.ring === 1, `C TIER: the form page crosses the 10-page ring (pages ${gc.pages}, ring ${gc.ring})`)

  // ── D. reload: it stays
  await load()
  const d = await pedestal()
  ok(filled(d) === filled(c), `D after a reload: the same pages (${filled(d)})`)
  await p.keyboard.press('Escape'); await sleep(500)
  const gd = await ground()
  ok(gd.pages === 10 && gd.ring === 1, `D TIER after a reload: still 10, the ring still open (pages ${gd.pages}, ring ${gd.ring})`)

  // ── E. a second fox keeper in the same Earth form: no second page
  const k = await bookKey()
  ok(!!k, `E the book save found (${k})`)
  await p.evaluate((key: string, at: number) => { const b = JSON.parse(localStorage.getItem(key)!); b.pots['vx-two'] = { seed: 'mana_seed_fox', at, bloomed: true, element: 'earth', meals: ['earth', 'earth', 'earth'] }; localStorage.setItem(key, JSON.stringify(b)) }, k!, Date.now() - BLOOM_MS - 60000)
  await load()
  const e = await pedestal()
  ok(e.pages.filter(x => x.form === 'earth' && x.sp === 'fox').length === 1 && e.pages.length === 10 && e.count === '10', `E a second keeper of the same form: still one form page (${filled(e)})`)
  await shot('e-no-double')
  const ge = await ground()
  ok(ge.pages === 10 && ge.ring === 1, `E TIER: no double, still 10 (pages ${ge.pages}, ring ${ge.ring})`)
  ok(errs.length === 0, `0 page errors ${errs.join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `${fails} FAIL` : 'ALL PASS')
process.exit(fails ? 1 : 0)
