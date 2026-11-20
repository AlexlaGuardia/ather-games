// moglin-card-check (BETA M46 slices 2+3): in a settlement, talk to a Moglin, Inspect -> its CARD: chibi portrait, name, home,
// trade, nine skill pips + luck. Untrusted (employed, nothing brought) = trade only; free (no hoop) = full card + luck. Back closes it.
//   npx tsx scripts/moglin-card-check.mts [--url https://ather.games] [--phone] [--shots <dir>]
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'
import { folkOf } from '../src/app/shimmer/open/ather/settlement-folk'
import { ASK } from '../src/app/shimmer/open/ather/folk-talk'
import { cardOf } from '../src/app/shimmer/open/ather/moglin-card'
import { freshTrust } from '../src/app/shimmer/open/ather/settlement-folk'
import { withGlade, type Network } from '../src/app/shimmer/open/ather/network'
import { nearestSpot } from '../src/app/shimmer/open/ather/folk-spots'   // M19: where each Moglin stands
import { builtFolkSpots } from '../src/app/shimmer/open/ather/settlement-lots'   // M39 s3: a trade's Moglin stands at its house door, the rest on the green's fan
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) fails++ }
const net = JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network
// a settlement with at least one free Moglin and one with a job
const st = net.settlements.find(s => { const f = folkOf(s, net.season); return f.some(x => !x.employed) && f.some(x => x.employed) })!
const folk = folkOf(st, net.season), free = folk.find(f => !f.employed)!, emp = folk.find(f => f.employed)!
console.log(`settlement ${st.name} (${st.biome}) · free ${free.name} the ${free.profession} · employed ${emp.name} wants ${emp.wants.map(w => `${w.n} ${w.id}`).join(', ')}`)
const tx = Math.floor((st.x + 500) / 1000), tz = Math.floor((st.z + 500) / 1000)
const tiles = JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as { tiles: { name: string; tx: number; ty: number }[] }
const tile = tiles.tiles.find(t => t.tx === tx && t.ty === tz)!
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const phone = process.argv.includes('--phone')   // set BEFORE the init script: an isMobile switch reloads about:blank, where localStorage throws
const p = await br.newPage(); await p.setViewport(phone ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 800, height: 500 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.removeItem('open.village.v1'); localStorage.removeItem('open.trust.v1') })
const shots = flag('--shots', '')
await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__ather?.travel, { timeout: 240000 }); await sleep(2000)
for (let i = 0; i < 40 && (await p.evaluate(() => (window as any).__ather.zone())) !== 'wilds'; i++) {
  await p.evaluate((T, x, z) => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'folk-check', tile: T, x, y: 0, z, biome: 2, made: 0 } }), tile.name, st.x - tx * 1000, st.z - tz * 1000)
  await sleep(4000)
}
ok((await p.evaluate(() => (window as any).__ather.zone())) === 'wilds', 'in the Wilds')
await sleep(8000)
await p.evaluate((x, z) => (window as any).__ather.tp(x, z), st.x, st.z); await sleep(4000)
await p.mouse.click(phone ? 200 : 500, phone ? 300 : 350); await sleep(800)
// M19: the settlement's folk STAND in it, every one of them, as the chibi (drawn only near the keeper)
const drawn = () => p.evaluate((id: string) => ((window as any).__folk?.drawn?.() ?? {})[id] as { id: string; x: number; z: number }[] | undefined, st.id)
ok(await (async () => { for (let t = 0; t < 15000; t += 500) { if ((await drawn())?.length === folk.length) return true; await sleep(500) } return false })(), `${st.name}: ${folk.length} Moglins stand in it (${(await drawn())?.length})`)
ok(((await p.evaluate(() => (window as any).__folk?.mapSettlements?.() ?? 0)) as number) === withGlade(net).settlements.length, 'the maps have every settlement to draw (the season\'s + Moonwell Glade, M30)')
const spots = builtFolkSpots(st, folk, net.season), kp = await p.evaluate(() => (window as any).__folk.keeper()) as { x: number; z: number }
const nearest = nearestSpot(spots, kp.x, kp.z)!
await p.keyboard.press('KeyE'); await p.mouse.move(5, 5)   // the pointer off the answers (a hover moves the pick)
const bubble = () => p.evaluate(() => document.querySelector('[data-talk-bubble]')?.firstElementChild?.textContent ?? '')
const nameOver = () => p.evaluate(() => document.querySelector('[data-talk-name]')?.textContent ?? '')
const answers = () => p.evaluate(() => [...document.querySelectorAll('[data-talk-option]')].map(e => (e.textContent ?? '').replace('›', '').trim()))
const poll = async (f: () => Promise<boolean>, ms = 15000) => { for (let t = 0; t < ms; t += 400) { if (await f()) return true; await sleep(400) } return false }
const lit = () => p.evaluate(() => Number(document.querySelector('[data-talk-sel]')?.getAttribute('data-talk-option') ?? -1))
const pick = async (label: string) => { const a = await answers(), i = a.indexOf(label); if (i < 0) return false
  for (let k = 0; k < a.length && await lit() !== i; k++) { await p.keyboard.press('ArrowDown'); await sleep(200) }   // arrows from wherever the pick sits
  if (await lit() !== i) return false
  await p.keyboard.press('KeyE'); await sleep(1500); return true }
// E in a settlement starts a conversation with ONE Moglin (M13): its dream in a bubble over its name, answers below
ok(await poll(async () => !!(await p.$('[data-talk-choices]'))), `E in ${st.name} starts a conversation`)
ok(!(await p.$('[data-panel="folk"]')), 'no folk panel: the talk is not a menu')
// M19: the talk opens on the Moglin NEAREST the keeper, and the camera aims at it (not the settlement's anchor)
const first = folk.find(f => f.id === nearest.id)!
const talkOn = () => p.evaluate(() => (window as any).__folkTalk ?? null) as Promise<{ on: string | null; at: { x: number; z: number } | null } | null>
const t0 = await talkOn()
ok(t0?.on === first.id && !!t0.at && Math.hypot(t0.at.x - nearest.x, t0.at.z - nearest.z) < 0.01, `E picks the nearest Moglin (${first.name}) and the camera aims at it (${JSON.stringify(t0)})`)
const at0 = folk.indexOf(first), others = folk.filter(f => f !== first), second = others.find((_, k) => k >= at0) ?? others[0]   // folk-talk.ts' "who else" order
ok(await bubble() === first.dream && await nameOver() === first.name, `a Moglin's dream in the bubble over its name (${first.name})`)
const hello = await answers()
// M46: Inspect opens the CARD. An employed Moglin (untrusted) shows trade only; a free one (no hoop) the full card.
const goTo = async (m: typeof folk[0]) => { for (let k = 0; k < folk.length && await nameOver() !== m.name; k++) { if (!(await pick(ASK.others))) break } return await nameOver() === m.name }
const card = () => p.evaluate(() => { const c = document.querySelector('[data-moglin-card]') as HTMLElement | null; if (!c) return null
  const r = c.getBoundingClientRect()
  return { text: c.textContent ?? '', full: c.hasAttribute('data-card-full'), luck: Number(c.querySelector('[data-card-luck]')?.getAttribute('data-card-luck') ?? -1),
    grades: [...c.querySelectorAll('[data-card-skill]')].map(e => [e.getAttribute('data-card-skill'), Number(e.getAttribute('data-card-grade'))] as [string, number]),
    canvas: !!c.querySelector('canvas'), box: { top: r.top, left: r.left, right: r.right, bottom: r.bottom }, vw: innerWidth, vh: innerHeight } })
ok(hello.includes(ASK.inspect), `hello offers ${ASK.inspect} (${hello.join(' | ')})`)
ok(!(await card()), 'no card before Inspect')
for (const m of [emp, free]) {
  ok(await goTo(m), `turn to ${m.name} (${m.employed ? 'employed' : 'free'})`)
  ok(await pick(ASK.inspect), `${m.name}: Inspect`)
  const c = await poll(async () => !!(await card()), 5000) ? await card() : null
  const want = cardOf(m, freshTrust(), st.name)
  ok(!!c, `${m.name}: the card opens`)
  if (c) {
    ok(c.text.includes(m.name) && c.text.includes(want.trade) && c.text.includes(st.name), `${m.name}: name, trade (${want.trade}), home (${st.name}) on the card`)
    ok(c.grades.length === 9 && c.grades.every(([s, g]) => g === (want.rows.find(r => r.skill === s)!.grade ?? 0)), `${m.name}: nine rows match the pure card (${c.grades.map(([s, g]) => `${s}:${g}`).join(' ')})`)
    ok(c.full === want.full && c.luck === (want.luck ?? 0), `${m.name}: ${want.full ? 'full card + luck' : 'trade only, luck hidden'} (luck ${c.luck})`)
    ok(c.canvas, `${m.name}: chibi portrait drawn`)
    ok(c.box.top >= 0 && c.box.left >= 0 && c.box.right <= c.vw && c.box.bottom <= c.vh, `${m.name}: card inside the ${c.vw}x${c.vh} view (${JSON.stringify(c.box)})`)
    if (shots) await p.screenshot({ path: `${shots}/card-${m.employed ? 'emp' : 'free'}${phone ? '-phone' : ''}.png` })
  }
  ok(await pick(ASK.back), `${m.name}: Back`)
  ok(!(await card()), `${m.name}: the card closes on Back`)
}
ok(await pick(ASK.bye), ASK.bye)
ok(errs.length === 0, `0 page errors${errs.length ? ': ' + errs.join(' | ') : ''}`)
await br.close()
console.log(fails ? `moglin-card-check: ${fails} FAIL` : 'moglin-card-check: PASS')
process.exit(fails ? 1 : 0)
