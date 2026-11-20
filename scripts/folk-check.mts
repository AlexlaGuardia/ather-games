// folk-check: Moglin recruiting, played. Into the Wilds, stand in a settlement, press the real E: a CONVERSATION with one Moglin (BETA M13, bubble over its name, arrows + E to answer);
// "who else" turns to the next; an EMPLOYED one names its goods and will not come untrusted; a FREE one comes (the garden village holds it). Hooks are used for MOVEMENT (travel / tp) and READING only.
//   npx tsx scripts/folk-check.mts [--url https://ather.games]
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'
import { folkOf } from '../src/app/shimmer/open/ather/settlement-folk'
import { talkLine } from '../src/app/shimmer/open/ather/folk-lines'
import { itemDef } from '../src/app/shimmer/open/shared/inventory'
import { goodsText, ASK, giveLabel } from '../src/app/shimmer/open/ather/folk-talk'   // lark's labels: a reword never stales the check
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
const p = await br.newPage(); await p.setViewport({ width: 800, height: 500 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.removeItem('open.village.v1'); localStorage.removeItem('open.trust.v1') })
await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__ather?.travel, { timeout: 240000 }); await sleep(2000)
for (let i = 0; i < 40 && (await p.evaluate(() => (window as any).__ather.zone())) !== 'wilds'; i++) {
  await p.evaluate((T, x, z) => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'folk-check', tile: T, x, y: 0, z, biome: 2, made: 0 } }), tile.name, st.x - tx * 1000, st.z - tz * 1000)
  await sleep(4000)
}
ok((await p.evaluate(() => (window as any).__ather.zone())) === 'wilds', 'in the Wilds')
await sleep(8000)
await p.evaluate((x, z) => (window as any).__ather.tp(x, z), st.x, st.z); await sleep(4000)
await p.mouse.click(500, 350); await sleep(800)
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
ok(hello.includes(ASK.needs) === first.employed && hello.includes(ASK.room) && hello.includes(ASK.others) && hello.includes(ASK.bye), `answers: ${hello.join(' | ')}`)
ok(!(await bubble()).includes(second.dream), 'only this Moglin speaks, not the settlement')
// "Who else lives here?" turns to the next Moglin
ok(await pick(hello.find(a => /else/.test(a))!), 'ask who else lives here')
ok(await bubble() === second.dream && await nameOver() === second.name, `the next Moglin answers (${second.name})`)
ok((await talkOn())?.on === second.id, `the camera turns to ${second.name}`)
// the employed Moglin: "What do you need?" names its goods and offers only what is in the bag (empty: only Go on)
const goTo = async (m: typeof folk[0]) => { for (let k = 0; k < folk.length && await nameOver() !== m.name; k++) { if (!(await pick(ASK.others))) break } return await nameOver() === m.name }
ok(await goTo(emp), `turn to ${emp.name} (has work)`)
ok(await pick(ASK.needs), `ask ${emp.name} what it needs`)
const needs = await bubble(), ans = await answers()
const names = emp.wants.map(w => itemDef(w.id).name)
ok(needs === talkLine('trustFirst', emp.id, goodsText(emp.wants)) && ans.includes(ASK.back), `${emp.name}: its goods in the bubble (${needs})`)
const gives = ans.filter(a => a.startsWith(giveLabel(1, emp.wants[0].id).split(' ')[0] + ' '))
ok(gives.every(g => names.some(n => g.endsWith(n))), `give answers only for goods it wants (${gives.join(', ') || 'none in the bag'})`)
if (gives.length) {   // bring one good: it leaves the bag and the bubble asks only for what is still wanted
  const before = await p.evaluate(() => localStorage.getItem('open.trust.v1'))
  ok(await pick(gives[0]), `bring: ${gives[0]}`)
  const trustNow = await p.evaluate(() => localStorage.getItem('open.trust.v1'))
  ok(trustNow !== before && !(await answers()).includes(gives[0]), 'the goods are given once: trust recorded, the answer is gone')
}
ok(await pick(ASK.back), 'back to the greeting')
ok(await pick((await answers()).find(a => /room/.test(a))!), `ask ${emp.name} to keep a room before the goods: no recruit`)
ok((await answers()).includes(ASK.back), 'untrusted: back on the needs screen')
const v0 = await p.evaluate(() => JSON.parse(localStorage.getItem('open.village.v1') ?? 'null'))
ok(!v0 || !v0.moglins?.some((m: { id: string }) => m.id === emp.id), `${emp.name} is not in the garden village yet`)
// the free Moglin: "Would you keep a room for me?" and it comes
ok(await pick(ASK.back), 'back'); ok(await goTo(free), `turn to ${free.name} (free)`)
ok(await pick((await answers()).find(a => /room/.test(a))!), `ask ${free.name} to keep a room`); await sleep(800)
const village = await p.evaluate(() => JSON.parse(localStorage.getItem('open.village.v1') ?? 'null'))
ok(!!village && village.moglins?.some((m: { id: string }) => m.id === free.id), `${free.name} is in the garden village`)
ok(/./.test(await bubble()) && await nameOver() === free.name, `${free.name} answers in the bubble`)
ok(await pick(ASK.bye), ASK.bye); ok(await poll(async () => !(await p.$('[data-talk-choices]')), 5000), 'the conversation ends')
// M19: the recruited Moglin has left the settlement; the others stay where they stood
ok(await poll(async () => { const d = await drawn(); return !!d && d.length === folk.length - 1 && !d.some(x => x.id === free.id) }, 8000), `${free.name} is gone from ${st.name}, ${folk.length - 1} remain`)
const kept = (await drawn()) ?? []
ok(kept.every(k => { const o = spots.find(sp => sp.id === k.id); return !!o && Math.hypot(o.x - k.x, o.z - k.z) < 0.01 }), 'the rest did not move')
ok(errs.length === 0, `0 page errors ${errs.length ? JSON.stringify(errs) : ''}`)
await br.close()
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
