// ── THE FIRST RINSTICK IS EARNED, PLAYED (BETA M22, play / Jin 4 ccb58127, 11-18) ───────────────────────────────────────
// Alex 11-18: 'a side mission to unlock the default fishing rod.. maybe crafting the fishing room starts this side quest'.
//   A. an OLD save (born before M22: rune, bag, no quest flag) keeps the worn rinstick, quest = done
//   B. a FRESH keeper born through the real birth gate: flag = none, NO rinstick, still none after a reload (the bag has been
//      saved by then: hub's catch); the journal's rinning pointer says 'Build a Rinnshop'; in the Wilds with bait in hand a
//      cast says the no-Rinnshop line and spends no bait
//   C. (ruling 4½) a Rinnshop standing (seeded raised) -> the quest starts; FENNEL stands by its door, E talks: ask, agree
//      -> the quest moves to the Moonwell and the journal says so
//   D. the MOONWELL (M67 s1b-3: it stands in Greg's garden in the CLOSED Glade now, zone 'glade', not in the Wilds; the keeper goes
//      there by the real __ather.travel({ kind: 'glade' }). B's cast stays in the Wilds on purpose: casting is a Wilds act): at noon nothing counts ('come back at dusk'); at dusk holding bait nothing counts ('put it away'); hold
//      R to stow (the stance, hub's rule), sit still by the water -> a rinn comes up (the wait completes)
//   E. walking over the bank takes the SHED SCALE
//   F. the Rinnshop bench binds it: the worn rinstick in hand, the scale used, the quest still open
//   G. Fennel takes the first catch (SETUP: a glowfin put in the bag) -> done, the catch handed over, the line struck
//   H. 0 page errors
// Landing a rinn with the stick is rinning-check's job (unchanged code path). Hooks: __ather tp/tools/zone/stance (movement,
// reading), __rinquest quest/journal/said/moonwell (reading). The talk answers, the bench button, E, R and walking are real.
//   npx tsx scripts/rinquest-check.mts [--url https://ather.games]
import puppeteer, { type Page } from 'puppeteer-core'
import { benchOf, type Room } from '../src/app/shimmer/open/ather/rooms'
import { RINQUEST_LINES, RINQUEST_STEPS, RINQUEST_KEY } from '../src/app/shimmer/open/ather/rinquest'
import { fennelSpot } from '../src/app/shimmer/open/ather/fennel'
import { SCALE_AT } from '../src/app/shimmer/open/ather/moonwell'
import { RINNSHOP_LINE } from '../src/app/shimmer/open/business/skill-pointers'
import { aimAt } from './lib/aim.mts'
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
const ready = (p: Page) => poll(() => p.evaluate(() => typeof (window as any).__ather?.tools === 'function' && typeof (window as any).__ather?.tp === 'function' && typeof (window as any).__rinquest?.quest === 'function'), 240000)
const countIn = async (p: Page, id: string) => (((await stored(p, 'open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]).reduce((a, s) => a + (s?.id === id ? s.n : 0), 0)
const bait = async (p: Page) => (((await stored(p, 'open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]).reduce((a, s) => a + (s?.id === 'bait' ? s.n : 0), 0)
async function holdBaitInWilds(p: Page) {
  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  ok(await poll(async () => (await A(p, 'zone')) === 'wilds', 240000), '   in the Wilds')
  await sleep(3000); await p.mouse.click(500, 350); await sleep(800)
  const slot = (((await stored(p, 'open.inv.v1'))?.slots ?? []) as ({ id: string } | null)[]).findIndex(s => s?.id === 'bait')
  await p.keyboard.press(String(slot + 1)); await sleep(1200)
}
// the Moonwell is in the closed Glade now (zone 'glade'): go there the way a keeper does, by the real travel (home=1: no saved
// Wilds spot to resume instead). Retried: the hook can fire before the page takes arrivals.
async function toGlade(p: Page, hour: number) {
  await p.goto(`${url}/shimmer/open/ather?hour=${hour}&home=1`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => typeof (window as any).__ather?.travel === 'function', { timeout: 240000 })
  for (let i = 0; i < 40 && (await A(p, 'zone')) !== 'glade'; i++) { await A(p, 'travel', { kind: 'glade' }); await sleep(4000) }
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
  await p.goto(`${url}/shimmer/open/ather?hour=13&home=1`, { waitUntil: 'load', timeout: 240000 }); await ready(p); await sleep(2500)
  const t = await A(p, 'tools') as Record<string, { toolId: string } | undefined>
  ok(t.rinning?.toolId === 'worn_rinstick', `A. an old save keeps the worn rinstick (${t.rinning?.toolId ?? 'none'})`)
  ok(((await Q(p, 'quest')) as { state: string })?.state === 'done', 'A. ...and reads as done')
  await p.close()
}

// ── B: a fresh birth ──
const p = await page()
await p.goto(`${url}/shimmer/open/ather?hour=13&home=1`, { waitUntil: 'load', timeout: 240000 }); await sleep(6000)
ok(await poll(() => p.evaluate(() => !!document.querySelector('[data-panel="birth"]')), 60000), 'B. the birth gate shows for a new keeper')
ok(await tapText(p, /^BE BORN/), 'B. tapped BE BORN')
ok(await poll(() => p.evaluate(() => !document.querySelector('[data-panel="birth"]')), 30000), 'B. the gate closes')
await sleep(2500); await tapText(p, /^Tap to start$/); await ready(p); await sleep(8000)
ok(((await stored(p, RINQUEST_KEY)) as { state: string } | null)?.state === 'none', `B. the birth wrote the quest flag = none (${JSON.stringify(await stored(p, RINQUEST_KEY))})`)
ok(!((await A(p, 'tools')) as Record<string, unknown>).rinning, 'B. a new keeper has NO rinstick')
// M68 s3b: a LIVE tutorial keeper's quest starts at Fennel in the GLADE (glade-fennel-check); the Rinnshop start below is the
// path a keeper from before the tutorial (live:false) still walks, so this keeper reads as one from here on (reload applies it)
await p.evaluate(() => localStorage.setItem('open.tutorial.v1', JSON.stringify({ v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null })))
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

// ── C: the Rinnshop stands -> Fennel comes -> the talk sends you to the Moonwell at dusk ──
await p.evaluate((room: Room) => localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [room], chests: [], pieces: [] })), SHOP)
await p.goto(`${url}/shimmer/open/ather?hour=13&home=1`, { waitUntil: 'load', timeout: 240000 }); await ready(p); await sleep(2500); await p.mouse.click(500, 350)
ok(await poll(async () => ((await Q(p, 'quest')) as { state: string }).state === 'active', 30000), 'C. a standing Rinnshop starts the quest')
ok(await poll(async () => ((await Q(p, 'journal')) as { id: string; title: string }[]).some(e => e.id === 'rinquest' && e.title === RINQUEST_STEPS[0].title), 10000), `C. the journal says '${RINQUEST_STEPS[0].title}'`)
const fs = fennelSpot({ v: 1, rooms: [SHOP], chests: [], pieces: [] } as never)!
const talkTo = async () => { await A(p, 'tp', fs.x - Math.sin(fs.yaw) * -1.6, fs.z - Math.cos(fs.yaw) * -1.6, fs.yaw + Math.PI); await sleep(2500); await aimAt(p, fs.x, fs.z, 0.8); await p.keyboard.press('e') }
const bubble = () => p.evaluate(() => document.querySelector('[data-talk-bubble]')?.textContent ?? '')
const pickAnswer = async (label: string) => {
  const ok2 = await p.evaluate((l: string) => { const e = [...document.querySelectorAll<HTMLElement>('[data-talk-option]')].find(x => (x.textContent ?? '').includes(l)); e?.click(); return !!e }, label)
  await sleep(1500); return ok2
}
await talkTo()
ok(await poll(async () => (await bubble()).includes('Fennel'), 20000), `C. Fennel stands by the Rinnshop and E talks (bubble: ${(await bubble()).slice(0, 60)})`)
// lark's lines (3f0dab22, live 11-19) made the meeting three screens: ask -> 'Anything I should bring?' -> agree
ok(await pickAnswer('How does one give itself') && await pickAnswer('Anything I should bring') && await pickAnswer("I'll go at dusk"), 'C. the talk: ask, ask what to bring, then agree to go')
ok(await poll(async () => ((await Q(p, 'quest')) as { step: number }).step === 1, 10000), 'C. ...the quest moves to the Moonwell')
const jw = (await Q(p, 'journal')) as { id: string; title: string }[]
ok(jw.some(e => e.id === 'rinquest' && e.title === RINQUEST_STEPS[1].title), `C. the journal says '${RINQUEST_STEPS[1].title}'`)

// ── D: the Moonwell. Wrong hour first (nothing counts), then DUSK: holding bait (nothing counts), then hands empty + still ──
const mw = (await Q(p, 'moonwell')) as { x: number; z: number; r: number }
const sitBy = async () => { await A(p, 'tp', mw.x + mw.r + 1.2, mw.z, Math.PI / 2); await sleep(1500) }
await toGlade(p, 13)
ok(await poll(async () => (await A(p, 'zone')) === 'glade', 240000), '   in the closed Glade (noon)')
await sleep(5000); await p.mouse.click(500, 350); await sitBy()
ok(await poll(async () => ((await Q(p, 'said')) as string[]).includes(RINQUEST_LINES.waitTime), 20000), 'D. at noon the water says: come back at dusk')
await sleep(15000)
ok(((await Q(p, 'quest')) as { step: number }).step === 1, 'D. ...and 15 s of sitting at noon changes nothing')
await toGlade(p, 19)
ok(await poll(async () => (await A(p, 'zone')) === 'glade', 240000), '   in the closed Glade (dusk)')
await sleep(5000); await p.mouse.click(500, 350)
const baitSlot = (((await stored(p, 'open.inv.v1'))?.slots ?? []) as ({ id: string } | null)[]).findIndex(s => s?.id === 'bait')
await p.keyboard.press(String(baitSlot + 1)); await sleep(800)
await sitBy()
ok(await poll(async () => ((await Q(p, 'said')) as string[]).includes(RINQUEST_LINES.waitHeld), 20000), 'D. holding bait at dusk, the water says: put it away')
await sleep(15000)
ok(((await Q(p, 'quest')) as { step: number }).step === 1, 'D. ...and holding bait it never counts')
// put it away: the stowed stance (hold R), the hub's rule: hands empty = stowed, not just 'no item'
await p.keyboard.down('KeyR'); await sleep(900); await p.keyboard.up('KeyR'); await sleep(800)
ok(((await A(p, 'stance')) as { kind: string }).kind === 'stowed', `D. hold R stows (stance ${JSON.stringify(await A(p, 'stance'))})`)
await sitBy()
const waited = await poll(async () => ((await Q(p, 'quest')) as { step: number }).step === 2, 120000)
if (!waited) console.log('  diag:', JSON.stringify(await p.evaluate(() => { const a = (window as any).__ather; const s = a.state(); return { wait: (window as any).__moonwell?.wait?.(), rising: (window as any).__moonwell?.rising?.(), stance: a.stance(), px: s.px, pz: s.pz, py: s.py, said: (window as any).__rinquest?.said?.()?.slice(-3), mw: (window as any).__rinquest?.moonwell?.() } })))
ok(waited, 'D. still, hands empty, at dusk by the water: a rinn comes up (the wait completes)')
ok(((await Q(p, 'said')) as string[]).includes(RINQUEST_LINES.surfaced), 'D. ...and says so')

// ── E: the scale on the bank (SCALE_AT is in the Glade's coords now; the keeper is still in the Glade from D) ──
await A(p, 'tp', SCALE_AT.x, SCALE_AT.z); await sleep(1500)
ok(await poll(async () => ((await Q(p, 'quest')) as { step: number }).step === 3, 20000) && (await countIn(p, 'shed_scale')) === 1, 'E. walking over the bank takes the shed scale')

// ── F: bind it at the Rinnshop bench ──
await p.goto(`${url}/shimmer/open/ather?hour=13&home=1`, { waitUntil: 'load', timeout: 240000 }); await ready(p); await sleep(2500); await p.mouse.click(500, 350)
const b = benchOf(SHOP)
await A(p, 'tp', b.x, b.z - 1.4, 0); await sleep(2500)
await aimAt(p, b.x, b.z, 0.6)
await p.keyboard.press('e')
ok(await poll(() => p.evaluate(() => { document.querySelector<HTMLElement>('[data-bench-tab="rinsticks"][aria-selected="false"]')?.click(); return !!document.querySelector('[data-panel="bench"] [data-rinquest-step="bind"] button:not([disabled])') }), 20000), 'F. E at the Rinnshop bench offers to bind the scale')
await p.evaluate(() => document.querySelector<HTMLElement>('[data-rinquest-step="bind"] button')?.click())
ok(await poll(async () => ((await A(p, 'tools')) as Record<string, { toolId: string } | undefined>).rinning?.toolId === 'worn_rinstick', 15000), 'F. the bind puts the worn rinstick in hand')
ok((await countIn(p, 'shed_scale')) === 0 && ((await Q(p, 'quest')) as { stick?: boolean; state: string }).stick === true, 'F. ...the scale is used, the stick saved, the quest still open')
await p.keyboard.press('Escape'); await sleep(600)

// ── G: Fennel gets the first catch (SETUP, stated: a glowfin put in the bag; landing one is rinning-check's job) ──
await p.evaluate(() => { const v = JSON.parse(localStorage.getItem('open.inv.v1')!); const i = v.slots.findIndex((x: unknown) => !x); v.slots[i] = { id: 'glowfin', n: 1 }; localStorage.setItem('open.inv.v1', JSON.stringify(v)) })
await p.reload({ waitUntil: 'load', timeout: 240000 }); await ready(p); await sleep(2500); await p.mouse.click(500, 350)
await talkTo()
ok(await poll(async () => (await bubble()).includes('First catch'), 20000) && await pickAnswer('Thank you') && await pickAnswer('(leave)') && await pickAnswer('Save me a seat, Fennel'), 'G. Fennel asks for the first catch, and takes it')
ok(await poll(async () => ((await Q(p, 'quest')) as { state: string }).state === 'done', 10000) && (await countIn(p, 'glowfin')) === 0, 'G. ...the quest is done, the catch handed over')
ok(((await Q(p, 'journal')) as { id: string; struck: boolean }[]).some(e => e.id === 'rinquest' && e.struck), 'G. ...the journal line struck')
ok(((await A(p, 'tools')) as Record<string, { toolId: string } | undefined>).rinning?.toolId === 'worn_rinstick', 'G. ...the stick stays in hand')

ok(errs.length === 0, `H. 0 page errors${errs.length ? ': ' + errs.join(' | ') : ''}`)
await br.close()
console.log(fails ? `rinquest-check: ${fails} FAIL` : 'rinquest-check: PASS')
process.exit(fails ? 1 : 0)
