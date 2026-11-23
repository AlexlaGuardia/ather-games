// Check (BETA M93 s3): IDRIS at the Enchant Temple. A keeper with the Repeater + the Charred Rifle, one Unattuned sigil and three
// letters (Star, Manalic, Barrier) walks to the Temple, E, answers "Idris", meets Idris (lark's first-talk lines, once), picks
// Star then Manalic, confirms, and the cut lands: Loadout.fit.repeater.sigil = [star, manalic], the blank and both letters spent,
// 2 fees taken. The Charred Rifle is not offered (no socket). A second visit opens on greet.repeat; the 3rd slot takes Barrier
// with no blank in the bag. Every Idris line and scene on screen is checked WORD FOR WORD against the signed text (athernyx 7a25a8e).
//   npx tsx scripts/idris-check.mts  (URL= to point elsewhere). Writes /tmp/idris-<n>.png
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { doorByKey } from '../src/app/shimmer/open/business/doors'
import { letterItem } from '../src/app/shimmer/open/business/letters'
import { newInv, give } from '../src/app/shimmer/open/shared/inventory'
import { DOOR_ASK } from '../src/app/shimmer/open/continent/door-talk'
import { SIGIL_CUT_FEE } from '../src/app/shimmer/open/business/idris'
import { IDRIS_LINES, IDRIS_SCENES, type IdrisLineId } from '../src/app/shimmer/open/business/idris-lines'
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
let inv = newInv(); inv = give(inv, 'sigil_blank', 1).inv
for (const r of ['star', 'manalic', 'barrier']) inv = give(inv, letterItem(r), 1).inv
const loadout = { v: 1, guns: ['charred-rifle', 'repeater'], primary: 'charred-rifle', secondary: 'repeater', kael: true,
  vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: null }], tactical: 'starter-bracelet', signature: 'starter-glove' }
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const URL = process.env.URL ?? 'https://ather.games'
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await br.newPage()
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
// seed once (the first document only), so the second visit reads what the cut wrote
await p.goto(`${URL}/shimmer/open/ather`, { waitUntil: 'load', timeout: 240000 })
await p.evaluate((invJson, loJson) => { localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.inv.v1', invJson); localStorage.setItem('open.loadout.v1', loJson); localStorage.removeItem('ather:trade:trial-ledger'); localStorage.removeItem('open.idris.met') }, JSON.stringify(inv), JSON.stringify(loadout))
await p.setViewport({ width: 960, height: 640 })
let fails = 0, shot = 0
const ok = (c: boolean, m: string) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) fails++ }
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(500) } return false }
await p.goto(`${URL}/shimmer/open/continent?hour=12`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__drive?.state && !!(window as any).__market, { timeout: 240000 }); await wait(2000)
await p.keyboard.press('KeyW'); await wait(500)
const key = 'front:enchant-temple'
const goTo = async () => {
  const d = doorByKey(R, key)!, fx = Math.cos(d.b.yaw), fz = Math.sin(d.b.yaw), yaw = Math.atan2(fx, fz)
  await p.evaluate((x, z) => (window as any).__drive.tp(x + 30, z + 30, 0, 0), d.at.x, d.at.z); await wait(6000)
  await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, -0.08), d.at.x + fx, d.at.z + fz, yaw); await wait(3000)
  ok(await poll(async () => await p.evaluate(() => (window as any).__market.reach()) === 'front:enchant-temple'), 'the Temple door in reach')
  await p.keyboard.press('KeyE')
}
const marks = () => p.evaluate(() => JSON.parse(localStorage.getItem('ather:trade:trial-ledger') ?? '{"marks":1500}').marks ?? 1500)
const bagHas = (id: string) => p.evaluate((id) => (JSON.parse(localStorage.getItem('open.inv.v1') ?? '{"slots":[]}').slots as any[]).filter(Boolean).filter(s => s.id === id).reduce((a, s) => a + s.n, 0), id)
const sigil = () => p.evaluate(() => JSON.parse(localStorage.getItem('open.loadout.v1') ?? '{}').fit?.repeater?.sigil ?? null)
const answers = () => p.evaluate(() => [...document.querySelectorAll('[data-talk-option]')].map(e => (e.textContent ?? '').replace('›', '').trim()))
const answer = async (label: string) => { await p.evaluate((l) => ([...document.querySelectorAll<HTMLElement>('[data-talk-option]')].find(e => (e.textContent ?? '').includes(l)))?.click(), label); await wait(900) }
const lines = () => p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-panel="idris-panel"] [data-idris-line]')].map(e => e.dataset.idrisLine))
const click = (sel: string) => p.evaluate((s) => { const b = document.querySelector<HTMLElement>(`${s} button`) ?? document.querySelector<HTMLElement>(s); if (!b || (b as HTMLButtonElement).disabled) return false; b.click(); return true }, sel)
const openIdris = async () => {
  await goTo()
  ok(await poll(async () => (await answers()).includes(DOOR_ASK.idris), 15000), `the Temple's answers carry Idris: ${(await answers()).join(' / ')}`)
  await answer(DOOR_ASK.idris)
  ok(await poll(async () => !!(await p.$('[data-panel="idris-panel"]')), 15000), "Idris's counter opens")
}
const startMarks = await marks()
// WORD FOR WORD (signed, athernyx 7a25a8e): every line on screen reads exactly 'Idris: <signed line>', every scene box exactly
// the signed scene. The game strings = the canon file is idris-signed-lines.test.ts; this proves what the page renders.
const exact = async (where: string) => {
  const got = await p.evaluate(() => ({
    lines: [...document.querySelectorAll<HTMLElement>('[data-panel="idris-panel"] [data-idris-line]')].map(e => [e.dataset.idrisLine!, (e.textContent ?? '').trim()]),
    barks: [...document.querySelectorAll<HTMLElement>('[data-panel="idris-panel"] [data-idris-bark]')].map(e => [e.dataset.idrisBark!, (e.textContent ?? '').trim()]),
    scenes: [...document.querySelectorAll<HTMLElement>('[data-panel="idris-panel"] [data-idris-scene]')].map(e => (e.textContent ?? '').trim()),
  }))
  const all = [...got.lines, ...got.barks] as [IdrisLineId, string][]
  const bad = all.filter(([id, t]) => t !== `Idris: ${IDRIS_LINES[id]}`)
  ok(all.length > 0 && bad.length === 0, `${where}: ${all.length} line(s) word for word${bad.length ? ' · OFF: ' + bad.map(([id, t]) => `${id}="${t}"`).join(' | ') : ': ' + all.map(([, t]) => `"${t}"`).join(' ')}`)
  const sBad = got.scenes.filter(t => t !== IDRIS_SCENES.first && t !== IDRIS_SCENES.done)
  ok(sBad.length === 0, `${where}: ${got.scenes.length} scene box(es) word for word${sBad.length ? ' · OFF: ' + sBad.join(' | ') : ''}`)
}
// 1) first talk
await openIdris()
const l1 = await lines()
ok(['idris.greet.first.1', 'idris.greet.first.2', 'idris.greet.first.3', 'idris.offer'].every(id => l1.includes(id)), `first talk: lark's greet.first.1-3 + offer (${l1.join(', ')})`)
ok(await p.evaluate((t) => (document.querySelector('[data-panel="idris-panel"]')?.textContent ?? '').includes(t), IDRIS_LINES['idris.greet.first.1']!), 'the first line shows as text, not its id')
await exact('first talk')
const guns = await p.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-idris-gun]')].map(e => e.dataset.idrisGun))
ok(JSON.stringify(guns) === '["repeater"]', `only socketed guns offered (${guns.join(',')})`)
await p.screenshot({ path: `/tmp/idris-${++shot}.png` })
// 2) pick Star then Manalic; Barrier (Compact) stays pickable; cut
ok(await click('[data-idris-letter="star"]'), 'pick Star'); await wait(300)
ok(await click('[data-idris-letter="manalic"]'), 'pick Manalic'); await wait(300)
ok(await p.evaluate(() => document.querySelector<HTMLElement>('[data-idris-letter="manalic"]')?.dataset.picked === '2'), 'Manalic is pick #2')
await p.screenshot({ path: `/tmp/idris-${++shot}.png` })
ok(await click('[data-idris-cut]'), 'Cut it pressed'); await wait(500)
ok(!!(await p.$('[data-idris-confirm="star,manalic"] [data-idris-line="idris.confirm"]')), 'confirm: idris.confirm over the two picks in order')
await exact('confirm')
await p.screenshot({ path: `/tmp/idris-${++shot}.png` })
ok(await click('[data-idris-do]'), 'confirmed'); await wait(1200)
ok(JSON.stringify(await sigil()) === '["star","manalic"]', `the Repeater's sigil = ${JSON.stringify(await sigil())}`)
ok((await bagHas('sigil_blank')) === 0 && (await bagHas(letterItem('star'))) === 0 && (await bagHas(letterItem('manalic'))) === 0 && (await bagHas(letterItem('barrier'))) === 1, 'the blank + both letters spent, Barrier kept')
ok((await marks()) === startMarks - 2 * SIGIL_CUT_FEE, `two fees taken (${startMarks} -> ${await marks()})`)
ok((await lines()).includes('idris.done') && !!(await p.$('[data-idris-scene]')), 'idris.done with its scene')
await exact('done')
await p.screenshot({ path: `/tmp/idris-${++shot}.png` })
// 3) second visit: greet.repeat; the 3rd slot takes Barrier with no blank in the bag
await p.evaluate(() => document.querySelector<HTMLElement>('[data-panel="idris-panel"] button[aria-label]')?.click()); await wait(800)
await openIdris()
const l2 = await lines()
ok(l2.includes('idris.greet.repeat') && !l2.includes('idris.greet.first.1'), `second visit: greet.repeat (${l2.join(', ')})`)
await exact('second visit')
ok(await click('[data-idris-letter="barrier"]'), 'pick Barrier'); await wait(300)
ok(await click('[data-idris-cut]'), 'Cut it'); await wait(400)
ok(await click('[data-idris-do]'), 'confirmed'); await wait(1200)
ok(JSON.stringify(await sigil()) === '["star","manalic","barrier"]', `the 3rd rune with no blank: ${JSON.stringify(await sigil())}`)
await p.screenshot({ path: `/tmp/idris-${++shot}.png` })
ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
console.log(fails ? `FAIL (${fails})` : 'PASS')
await br.close()
process.exit(fails ? 1 : 0)
