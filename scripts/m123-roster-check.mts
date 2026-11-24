// ── BETA M123 s1: THE GRIMOIRE PEDESTAL FOR AN EXISTING KEEPER + ITS ROSTER, PLAYED AT 390x844 (OWNER + ?spirits=3d) ──────────
// SETUP (stated): a LEGACY keeper (no live tutorial: every gift marked given, so Beat 1 never handed the grimoire) with NO
// pedestal anywhere; 3 Spirit Planters holding 9 bloomed spirits (M122 slots: '<planter>', '#2', '#3' each); party = the 8
// that are NOT 'pa#2'. Hooks: travel/open/tp/look (movement + reading only).
//  1. Glade, E at Greg: his talk offers the signed 'Spirits?'; picking it puts ONE Grimoire Pedestal in the bag and his bubble
//     is the signed grimoire line; asked again, no 'Spirits?'.
//  2. Home: hold the pedestal from the hotbar, E sets it (works has it, bag has none).
//  3. E at the pedestal: the grimoire opens with the ROSTER: all 9 bloomed spirits listed (incl. 'pa#2'), party 8 / 8.
//     Ask 'pa#2' along while full -> refused (still 8). Let 'pb' roam, ask 'pa#2' along -> party has pa#2, not pb, 8 / 8.
//  4. Reload, E at the pedestal: the swap persists (roster + the saved party). 0 page errors.
//   npx tsx scripts/m123-roster-check.mts [--url https://ather.games] [--out dir]      (OWNER_KEY from env or .env; run on the box)
import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { aimAt } from './lib/aim.mts'
import { ANSWERS } from '../src/app/shimmer/open/ather/greg-talk'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games').replace(/\/$/, ''), out = flag('--out', '/tmp/m123-roster')
mkdirSync(out, { recursive: true })
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.error('no OWNER_KEY (env or .env)'); process.exit(2) }
const SPIRITS_LINE = 'Spirits?', GRIM_LINE = 'This is a grimoire. I keep trying to grow what we know of them with it.'
const PL = [{ id: 'pa', x: -134, z: 98.5 }, { id: 'pb', x: -136.6, z: 98.5 }, { id: 'pc', x: -139.2, z: 98.5 }]
const PIECES = PL.map(q => ({ id: q.id, item: 'spirit_planter', x: q.x, z: q.z, q: 0, placedAt: 1 }))
const SP = ['fox', 'axolotl', 'owl', 'bat', 'frog', 'rabbit', 'turtle', 'firefly', 'hummingbird']
const KEYS = PL.flatMap(q => [q.id, `${q.id}#2`, `${q.id}#3`])
const at0 = Date.now() - 20 * 86400000
const POTS = Object.fromEntries(KEYS.map((k, i) => [k, { seed: `mana_seed_${SP[i]}`, at: at0 + i, v: 2, tends: [], bloomed: true }]))
const PARTY = KEYS.filter(k => k !== 'pa#2')
const TUT = { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const poll = async (f: () => Promise<boolean>, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await p.goto(`${url}/api/owner`, { waitUntil: 'load', timeout: 60000 })
  if (!await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner))) { ok(false, 'owner cookie took'); process.exit(1) }
  await p.evaluateOnNewDocument((s: { pieces: unknown[]; pots: unknown; party: string[]; tut: unknown }) => {
    if (sessionStorage.getItem('m123')) return; sessionStorage.setItem('m123', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'waymark', n: 12 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: s.pieces }))
    localStorage.setItem('open.tutorial.v1', JSON.stringify(s.tut))
    localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots: s.pots, met: [] }))
    for (const k of ['ather.spiritFollow.v1', 'ather.spiritFed.v1', 'ather.trainAssign.v1', 'open.bank.v1']) localStorage.removeItem(k)
    localStorage.setItem('ather.spiritParty.v1', JSON.stringify(s.party))
  }, { pieces: PIECES, pots: POTS, party: PARTY, tut: TUT })
  const A = (fn: string, ...args: unknown[]) => p.evaluate((f: string, a: unknown[]) => (window as any).__ather?.[f]?.(...a), fn, args)
  const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k) as Promise<any>
  const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
  const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
  const tp = async (x: number, z: number, yaw: number) => { await A('tp', x, z, yaw); await sleep(1500); await shot('_f') }
  const click = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (b) await p.mouse.click(b.x, b.y); return !!b }
  const bubble = () => p.evaluate(() => { const b = document.querySelector('[data-talk-bubble]'); if (!b) return null; const sc = b.querySelector('[data-talk-scene]')?.textContent ?? ''; return (b.firstElementChild?.textContent ?? '').slice(sc.length) }) as Promise<string | null>
  const opts = () => p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-talk-option]')].map(e => (e.textContent ?? '').replace(/^›/, '').replace(/short$/i, '').trim())) as Promise<string[]>
  const pick = (label: string) => p.evaluate((l: string) => { const b = [...document.querySelectorAll<HTMLButtonElement>('[data-talk-option]')].find(e => (e.textContent ?? '').replace(/^›/, '').trim().startsWith(l)); b?.click(); return !!b }, label)
  const greg = async () => { await A('open', 'greg'); await poll(async () => !!(await bubble()), 10000); await sleep(500); return { line: (await bubble()) ?? '', opts: await opts() } }
  const closeTalk = async () => { await p.keyboard.press('Escape'); await sleep(500); if ((await opts()).length) { await pick(ANSWERS.bye); await sleep(500) } }
  const boot = async () => { await p.goto(`${url}/shimmer/open/ather?hour=14&spirits=3d`, { waitUntil: 'load', timeout: 240000 }); await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(4000) }
  const count = (inv: any, id: string) => ((inv?.slots ?? []) as ({ id: string; n: number } | null)[]).filter(s => s?.id === id).reduce((a, s) => a + s!.n, 0)
  const roster = () => p.evaluate(() => ({
    open: !!document.querySelector('[data-panel="grimoire"]'), roster: !!document.querySelector('[data-roster]'),
    n: Number(document.querySelector('[data-party-count]')?.getAttribute('data-party-count') ?? -1),
    ids: [...document.querySelectorAll('[data-roster-spirit]')].map(e => e.getAttribute('data-roster-spirit')),
    inP: [...document.querySelectorAll('[data-roster-spirit][data-in-party="1"]')].map(e => e.getAttribute('data-roster-spirit')),
  })) as Promise<{ open: boolean; roster: boolean; n: number; ids: string[]; inP: string[] }>
  const eAt = async (x: number, z: number, ty: number) => { await tp(x, z + 1.3, 0); await aimAt(p, x, z, ty); await p.keyboard.press('e'); await sleep(1200) }

  await boot()
  // 1. Greg hands the grimoire
  await A('travel', { kind: 'glade' }); ok(await poll(async () => (await A('zone')) === 'glade', 60000), '1. in the Glade (Greg is drawn there)'); await sleep(4000)
  let g = await greg()
  ok(g.opts.includes(SPIRITS_LINE), `1. Greg offers '${SPIRITS_LINE}' to a pedestal-less legacy keeper (${g.opts.join(' / ')})`)
  ok(await pick(SPIRITS_LINE), '1. picked it'); await sleep(900)
  ok(count(await read('open.inv.v1'), 'grimoire_pedestal') === 1, '1. ONE Grimoire Pedestal in the bag')
  const said = (await bubble()) ?? ''
  ok(said.includes(GRIM_LINE), `1. his bubble is the signed grimoire line ('${said.slice(0, 80)}')`)
  ok(!(await opts()).includes(SPIRITS_LINE), '1. no second Spirits? once owned'); await shot('m123-1-greg'); await closeTalk()
  g = await greg(); ok(!g.opts.includes(SPIRITS_LINE), `1. asked again: no Spirits? (${g.opts.join(' / ')})`); await closeTalk()
  ok(count(await read('open.inv.v1'), 'grimoire_pedestal') === 1, '1. still exactly one')
  // 2. home, hold it, set it
  await A('travel', { kind: 'home' }); await poll(async () => (await A('zone')) !== 'glade', 60000); await sleep(5000)
  const slot = ((await read('open.inv.v1'))?.slots ?? []).findIndex((s: any) => s?.id === 'grimoire_pedestal')
  ok(slot >= 0 && slot < 8, `2. the pedestal is on the hotbar (slot ${slot + 1})`)
  await tp(-130.1, 102.53, Math.PI)
  await p.keyboard.press(`Digit${slot + 1}`); await sleep(1000); await shot('m123-2-ghost')
  await p.keyboard.press('e'); await sleep(1500)
  const ped = ((await read('open.works.v1'))?.pieces ?? []).find((q: any) => q.item === 'grimoire_pedestal')
  ok(!!ped && count(await read('open.inv.v1'), 'grimoire_pedestal') === 0, `2. set on the plot (${ped ? `${ped.x.toFixed(2)},${ped.z.toFixed(2)}` : 'none'}), bag has none`)
  if (!ped) throw new Error('no pedestal placed')
  await p.keyboard.press('Digit1').catch(() => {}); await sleep(300); await p.keyboard.press('Digit1').catch(() => {}); await sleep(300)
  // 3. the roster
  const openPed = async () => { for (let k = 0; k < 3; k++) { await eAt(ped.x, ped.z, 0.95); if (await poll(async () => (await roster()).roster, 6000)) return true; await p.keyboard.press('Escape'); await sleep(500) } return false }
  ok(await openPed(), '3. E at the pedestal opens the grimoire with its roster')
  let r = await roster(); await shot('m123-3-roster')
  ok(r.ids.length === 9 && KEYS.every(k => r.ids.includes(k)), `3. all 9 bloomed spirits listed, incl. pa#2 (${r.ids.join()})`)
  ok(r.n === 8 && !r.inP.includes('pa#2'), `3. party 8 / 8 without pa#2 (${r.inP.join()})`)
  await click('[data-roster-spirit="pa#2"] [data-act="ask"] button'); await sleep(700)
  r = await roster(); ok(r.n === 8 && !r.inP.includes('pa#2'), '3. asking pa#2 along with a full party is refused (still 8)')
  await click('[data-roster-spirit="pb"] [data-act="roam"] button'); await sleep(700)
  await click('[data-roster-spirit="pa#2"] [data-act="ask"] button'); await sleep(700)
  r = await roster(); await shot('m123-4-swapped')
  ok(r.n === 8 && r.inP.includes('pa#2') && !r.inP.includes('pb'), `3. swap: pb roams, pa#2 in, 8 / 8 (${r.inP.join()})`)
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.endsWith('ather.spiritParty.v1')) ?? '') ?? '[]')) as string[]
  ok(saved.includes('pa#2') && !saved.includes('pb') && saved.length === 8, '3. the party save holds the swap')
  // 4. reload
  await p.keyboard.press('Escape'); await sleep(500)
  await boot()
  ok(await openPed(), '4. reload: E at the pedestal opens the roster')
  r = await roster(); await shot('m123-5-reload')
  ok(r.ids.length === 9 && r.n === 8 && r.inP.includes('pa#2') && !r.inP.includes('pb'), `4. the swap persists (${r.inP.join()})`)
  ok(((await read('open.works.v1'))?.pieces ?? []).some((q: any) => q.item === 'grimoire_pedestal'), '4. the pedestal is still placed')
  ok(errs.length === 0, `0 page errors (${errs.join(' | ')})`)
} catch (e) { ok(false, `threw: ${String(e).slice(0, 300)}`) }
await br.close()
console.log(fails ? `FAIL (${fails})` : 'PASS: M123 s1 a legacy keeper gets the grimoire from Greg (signed Spirits? / grimoire line), sets the pedestal, the roster lists all 9 bloomed spirits incl. a #2 planter slot, a full party refuses, a swap persists across reload; 390x844 owner')
process.exit(fails ? 1 : 0)
