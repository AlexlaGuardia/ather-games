// ── THE FIRST RINSTICK IS EARNED, PLAYED (BETA M22, play / Jin 4 ccb58127, 11-18) ───────────────────────────────────────
// Alex 11-18: 'a side mission to unlock the default fishing rod.. maybe crafting the fishing room starts this side quest'.
//   A. an OLD save (born before M22: rune, bag, no quest flag) keeps the worn rinstick, quest = done
//   B. a FRESH keeper born through the real birth gate: flag = none, NO rinstick, still none after a reload (the bag has been
//      saved by then: hub's catch); the journal's rinning pointer says 'Build a Rinnshop'; in the Wilds with bait in hand a
//      cast says the no-Rinnshop line and spends no bait
//   C. a Rinnshop standing in the garden (seeded raised in the save) -> the quest starts (active) and the journal shows its
//      step; E at the bench -> the step's button -> worn rinstick in hand, quest done, journal line struck
//   D. back in the Wilds with bait: the cast passes the stick gate ('Aim at open water', not the no-stick line)
//   E. 0 page errors
// Landing a rinn with the stick is rinning-check's job (unchanged code path). Hooks: __ather tp/tools/cast/zone (movement,
// reading, the click's own handler), __rinquest quest/journal/said (reading). The bench button is a real click.
//   npx tsx scripts/rinquest-check.mts [--url https://ather.games]
import puppeteer, { type Page } from 'puppeteer-core'
import { benchOf, type Room } from '../src/app/shimmer/open/ather/rooms'
import { RINQUEST_LINES, RINQUEST_STEPS, RINQUEST_KEY } from '../src/app/shimmer/open/ather/rinquest'
import { RINNSHOP_LINE } from '../src/app/shimmer/open/business/skill-pointers'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const SHOP: Room = { id: 'rinquest-check', kind: 'rinnshop', x: -100, z: 100, q: 0, placedAt: 1, doneAt: 2, store: [] }

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
const page = async () => { const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1000, height: 700 }); p.on('pageerror', e => errs.push(String(e).slice(0, 200))); await p.evaluateOnNewDocument('window.__name = (f) => f'); return p }
const poll = async (f: () => Promise<boolean>, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }
const A = (p: Page, fn: string, ...a: unknown[]) => p.evaluate((f, args) => (window as any).__ather[f](...args), fn, a)
const Q = (p: Page, fn: string) => p.evaluate(f => (window as any).__rinquest?.[f]?.() ?? null, fn)
const stored = (p: Page, k: string) => p.evaluate(k => JSON.parse(localStorage.getItem(k) ?? 'null'), k)
const ready = (p: Page) => poll(() => p.evaluate(() => typeof (window as any).__ather?.tools === 'function' && typeof (window as any).__rinquest?.quest === 'function'), 240000)
const bait = async (p: Page) => (((await stored(p, 'open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]).reduce((a, s) => a + (s?.id === 'bait' ? s.n : 0), 0)
async function holdBaitInWilds(p: Page) {
  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  ok(await poll(async () => (await A(p, 'zone')) === 'wilds', 240000), '   in the Wilds')
  await sleep(3000); await p.mouse.click(500, 350); await sleep(800)
  const slot = (((await stored(p, 'open.inv.v1'))?.slots ?? []) as ({ id: string } | null)[]).findIndex(s => s?.id === 'bait')
  await p.keyboard.press(String(slot + 1)); await sleep(1200)
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

// ── A: an old save ──
{
  const p = await page()
  await p.evaluateOnNewDocument(() => {
    if (sessionStorage.getItem('rq')) return; sessionStorage.setItem('rq', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'waymark', n: 12 }; slots[1] = { id: 'bait', n: 10 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
  })
  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 }); await ready(p); await sleep(2500)
  const t = await A(p, 'tools') as Record<string, { toolId: string } | undefined>
  ok(t.rinning?.toolId === 'worn_rinstick', `A. an old save keeps the worn rinstick (${t.rinning?.toolId ?? 'none'})`)
  ok(((await Q(p, 'quest')) as { state: string })?.state === 'done', 'A. ...and reads as done')
  await p.close()
}

// ── B: a fresh birth ──
const p = await page()
await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 }); await sleep(6000)
ok(await poll(() => p.evaluate(() => !!document.querySelector('[data-panel="birth"]')), 60000), 'B. the birth gate shows for a new keeper')
ok(await tapText(p, /^BE BORN/), 'B. tapped BE BORN')
ok(await poll(() => p.evaluate(() => !document.querySelector('[data-panel="birth"]')), 30000), 'B. the gate closes')
await sleep(2500); await tapText(p, /^Tap to start$/); await ready(p); await sleep(8000)
ok(((await stored(p, RINQUEST_KEY)) as { state: string } | null)?.state === 'none', `B. the birth wrote the quest flag = none (${JSON.stringify(await stored(p, RINQUEST_KEY))})`)
ok(!((await A(p, 'tools')) as Record<string, unknown>).rinning, 'B. a new keeper has NO rinstick')
// hub's catch: a new keeper's bag gets saved soon after birth; make sure it IS saved (10 bait), then reload
if (!(await stored(p, 'open.inv.v1'))) await p.evaluate(() => { const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'waymark', n: 12 }; slots[1] = { id: 'bait', n: 10 }; localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] })) })
await p.reload({ waitUntil: 'load', timeout: 240000 }); await ready(p); await sleep(3000)
ok(!!(await stored(p, 'open.inv.v1')) && !((await A(p, 'tools')) as Record<string, unknown>).rinning, 'B. still none after a reload, with the bag saved')
const j0 = await Q(p, 'journal') as { id: string; title: string }[]
ok(j0.some(e => e.id === 'skill-rinning' && e.title === RINNSHOP_LINE.title) && !j0.some(e => e.id === 'rinquest'), `B. the journal points at the Rinnshop (${j0.find(e => e.id === 'skill-rinning')?.title})`)
await holdBaitInWilds(p)
const b0 = await bait(p)
await A(p, 'cast'); await sleep(800)
ok(((await Q(p, 'said')) as string[]).includes(RINQUEST_LINES.noShop) && b0 > 0 && (await bait(p)) === b0, `B. bait at the water says where the first rinstick comes from, no bait spent (${b0} -> ${await bait(p)})`)

// ── C: the Rinnshop stands -> the quest -> the bench ──
await p.evaluate((room: Room) => localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [room], chests: [], pieces: [] })), SHOP)
await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 }); await ready(p)
ok(await poll(async () => ((await Q(p, 'quest')) as { state: string }).state === 'active', 30000), 'C. a standing Rinnshop starts the quest')
ok(await poll(async () => ((await Q(p, 'journal')) as { id: string; title: string }[]).some(e => e.id === 'rinquest' && e.title === RINQUEST_STEPS[0].title), 10000), `C. the journal shows '${RINQUEST_STEPS[0].title}'`)
const b = benchOf(SHOP)
await A(p, 'tp', b.x, b.z - 1.4, 0); await sleep(2500); await p.mouse.click(500, 350); await sleep(800)
await p.keyboard.press('e')
ok(await poll(() => p.evaluate(() => !!document.querySelector('[data-panel="bench"] [data-rinquest-step]')), 20000), 'C. E at the Rinnshop bench shows the quest step')
await p.evaluate(() => document.querySelector<HTMLElement>('[data-rinquest-step] button')?.click())
ok(await poll(async () => ((await A(p, 'tools')) as Record<string, { toolId: string } | undefined>).rinning?.toolId === 'worn_rinstick', 15000), 'C. the step puts the worn rinstick in hand')
ok(((await Q(p, 'quest')) as { state: string }).state === 'done' && ((await stored(p, RINQUEST_KEY)) as { state: string }).state === 'done', 'C. ...quest done, and saved')
ok(((await Q(p, 'journal')) as { id: string; struck: boolean }[]).some(e => e.id === 'rinquest' && e.struck), 'C. ...the journal line struck')
ok(await p.evaluate(() => document.querySelector('[data-rinstick-held]')?.getAttribute('data-rinstick-held') === 'worn_rinstick'), 'C. ...and the bench says it is in hand')
await p.keyboard.press('Escape'); await sleep(500)

// ── D: the cast passes the gate ──
await holdBaitInWilds(p)
await A(p, 'cast'); await sleep(800)
const said = (await Q(p, 'said')) as string[]
ok(!said.includes(RINQUEST_LINES.noShop) && !said.includes(RINQUEST_LINES.inQuest) && ((await A(p, 'tools')) as Record<string, unknown>).rinning !== undefined, `D. bait at the water casts (or asks for aim), no no-stick line (${said.slice(-2).join(' | ')})`)

ok(errs.length === 0, `E. 0 page errors${errs.length ? ': ' + errs.join(' | ') : ''}`)
await br.close()
console.log(fails ? `rinquest-check: ${fails} FAIL` : 'rinquest-check: PASS')
process.exit(fails ? 1 : 0)
