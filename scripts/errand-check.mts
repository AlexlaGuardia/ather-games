// Check: THE FIRST ERRAND starts at Greg's (Magii + Alex 11-16). A born keeper (Star) TALKS to Gregory in the Ather (BETA M13):
// the gems box offers the birth letter's material, Take them puts it in the bag, and the box then points to the Fire
// School runesmith in Redstair and on to the Enchant Temple. (The cut + imbue are scripts/runesmith-check.mts.)
// M67 s1b-3: Greg sits at Moonwell Glade, which stands in Greg's garden in the CLOSED Glade (zone 'glade') now, not in the Wilds:
// the keeper goes there by the real __ather.travel({ kind: 'glade' }) and talks to him on his bench there.
// npx tsx scripts/errand-check.mts  (URL= to point elsewhere). Writes /tmp/errand-<n>.png
import puppeteer from 'puppeteer-core'
import { ANSWERS } from '../src/app/shimmer/open/ather/greg-talk'
import { GREG } from '../src/app/shimmer/open/ather/plot'                  // the OLD plot anchor (kept: TABLE/rooms hang off it)
import { gregSpot } from '../src/app/shimmer/open/ather/moonwell-glade'   // M30 part 2: where Greg sits now
import { aimAt } from './lib/aim.mts'
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const URL = process.env.URL ?? 'https://ather.games'
const br = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await br.newPage()
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e)))
// a fresh keeper on the FIRST load only (a reload must keep what Greg gave)
await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star'); if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.removeItem('open.inv.v1'); localStorage.removeItem('open.loadout.v1'); localStorage.removeItem('open.errand.v1') } localStorage.setItem('open.tutorial.v1', JSON.stringify({ v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null }))   // M68 s2: this check is the errand, not Greg's tutorial talk (glade-tutorial-check walks that)
 })
await p.setViewport({ width: 960, height: 600 })
let fails = 0
const ok = (c: boolean, m: string) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) fails++ }
const poll = async (fn: () => Promise<boolean>, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(500) } return false }
await p.goto(`${URL}/shimmer/open/ather`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__ather?.open, { timeout: 240000 }); await wait(2000)
// BETA M30 part 2: Greg is NOT on the plot; he sits at Moonwell Glade (M67: in the closed Glade), on the locked-look rig
await p.waitForFunction(() => typeof (window as any).__ather?.tp === 'function', { timeout: 120000 }); await wait(1500)
const prompt = () => p.evaluate(() => /E · Gregory/.test(document.body.innerText))
await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z), GREG.x - 0.6, GREG.z); await wait(1200)
ok(!(await prompt()) && (await p.evaluate(() => (window as any).__greg)) === undefined, 'on the plot there is NO Greg (no E prompt at his old spot, no rig)')
await p.keyboard.press('KeyE'); await wait(600)
ok(!(await p.$('[data-talk-choices]')), 'E at his old spot opens no conversation')
await p.keyboard.press('KeyJ'); await wait(800)
ok(/Moonwell Glade/.test(await p.evaluate(() => document.body.innerText)), 'the errand journal line points at Greg at Moonwell Glade')
await p.keyboard.press('Escape'); await wait(500)
const toGlade = async () => {
  for (let i = 0; i < 40 && (await p.evaluate(() => (window as any).__ather.zone())) !== 'glade'; i++) { await p.evaluate(() => (window as any).__ather.travel({ kind: 'glade' })); await wait(4000) }
  const g = gregSpot()
  const up = await poll(async () => !!(await p.evaluate(() => (window as any).__greg)), 90000)
  await wait(4000)   // the arrival settles (no tile to stream in the closed Glade); THEN walk to his bench
  // 1.6 m in front of him (figure yaw: forward = (sin, cos)); he faces the green, so this is the side a keeper walks up from
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z), g.x + Math.sin(g.yaw) * 1.6, g.z + Math.cos(g.yaw) * 1.6); await wait(2500)
  await p.mouse.click(480, 300); await wait(500)
  await aimAt(p, g.x, g.z, 1.0)   // M60: E only on what the crosshair is on
  return up
}
ok(await toGlade(), 'in the closed Glade, Greg is drawn on the rig, sitting')
{ const g = await p.evaluate(() => (window as any).__greg), s = gregSpot()
  ok(g?.pose === 'sit' && g?.look === 'gregory' && Math.hypot(g.x - s.x, g.z - s.z) < 0.01, `his rig stands at his bench in the Glade (${g?.x?.toFixed?.(1)}, ${g?.z?.toFixed?.(1)})`) }
ok(await poll(async () => await prompt(), 6000), 'the E prompt names Gregory at his bench')
if (!(await prompt())) console.log('   dbg keeper', JSON.stringify(await p.evaluate(() => (window as any).__folk?.keeper?.())), 'greg', JSON.stringify(gregSpot()), (await p.evaluate(() => document.body.innerText)).split('\n').filter(l => /^E ·/.test(l)).join('|'))
await p.screenshot({ path: '/tmp/errand-0.png' })
// BETA M13: talking to Greg is a conversation: his line in a bubble over his name, the keeper answers (E picks the lit answer)
const bubble = () => p.evaluate(() => document.querySelector('[data-talk-bubble]')?.textContent ?? '')
const answers = () => p.evaluate(() => [...document.querySelectorAll('[data-talk-option]')].map(e => (e.textContent ?? '').replace('›', '').trim()))
await p.keyboard.press('KeyE')   // the real E at Greg (not the hook)
ok(await poll(async () => !!(await p.$('[data-talk-choices]')) && /Now then/.test(await bubble())), "E at Greg starts a conversation: his first send-off line in a bubble")
ok(!(await p.$('[data-panel="greg"]')), 'the ground screen does NOT open with it (one thing at a time)')
const first = await answers()
ok(first.includes(ANSWERS.ground) && first.includes(ANSWERS.bye), `the first answers include the ground screen and goodbye (${first.join(' / ')})`)
const sendOff: string[] = [await bubble()]
await p.keyboard.press('ArrowDown'); await wait(200)   // M32: a newborn's first answer is the tour; the send-off is the next one
for (let k = 0; k < 3; k++) { await p.keyboard.press('KeyE'); await wait(500); sendOff.push(await bubble()) }
ok(sendOff.length === 4 && /Now then\. A Blankstone, and the gems to go on it\./.test(sendOff[0]) && /Yours is the Fire School runesmith, at Redstair\./.test(sendOff[1]), `Greg's send-off, lark's lines one bubble each, seat filled in (${sendOff.map(x => x.slice(0, 18)).join(' | ')})`)
ok((await answers()).join() === ANSWERS.take, `the last line offers ${ANSWERS.take}`)
await p.screenshot({ path: '/tmp/errand-1.png' })
await p.keyboard.press('KeyE'); await wait(1200)
const bag = await p.evaluate(() => (JSON.parse(localStorage.getItem('open.inv.v1') ?? '{"slots":[]}').slots as any[]).filter(Boolean).map(s => `${s.id}x${s.n}`))
ok(bag.includes('blankstonex1') && bag.includes('raw_mana_shardx2') && bag.includes('violet_crystalx1'), `the gems are in the bag (${bag.join(' ')})`)
ok(!(await p.$('[data-talk-choices]')), 'taking them ends the conversation')
await p.keyboard.press('KeyE'); await poll(async () => !!(await p.$('[data-talk-bubble]')), 8000)
const txt = await bubble()
ok(/Redstair first, Keeper, then the Citadel\. Blue and I will keep\./.test(txt), `then Greg's repeat line points the way (lark, signed 11-16): "${txt.trim()}"`)
await p.keyboard.press('ArrowDown'); await wait(200)
const sel = await p.evaluate(() => document.querySelector('[data-talk-sel]')?.getAttribute('data-talk-option'))
ok(sel === '1', `the arrows move the pick (lit answer ${sel})`)
await p.keyboard.press('ArrowUp'); await wait(200); await p.keyboard.press('KeyE')
ok(await poll(async () => !!(await p.$('[data-panel="greg"]')) && !(await p.$('[data-talk-choices]')), 5000), `"${ANSWERS.ground}" opens the ground screen alone`)
await p.keyboard.press('Escape'); await wait(500)
await p.screenshot({ path: '/tmp/errand-2.png' })
ok(await p.evaluate(() => JSON.parse(localStorage.getItem('open.errand.v1') ?? '{}').given === true), 'the gems are given once (the flag holds)')
await p.reload({ waitUntil: 'load', timeout: 240000 }); await p.waitForFunction(() => !!(window as any).__ather?.open, { timeout: 240000 }); await wait(1500)
await toGlade(); await p.keyboard.press('KeyE')
ok(await poll(async () => /Redstair first/.test(await bubble())) && !(await answers()).includes(ANSWERS.take), 'after a reload Greg does not hand them out again')
ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
await br.close()
console.log(fails ? `errand-check: ${fails} FAIL` : 'errand-check: PASS')
process.exit(fails ? 1 : 0)
