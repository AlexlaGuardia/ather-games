// Check: THE LETTER CHAIN on the continent (Magii + Alex 11-16). With one letter's material in the bag (Blankstone,
// 2 raw shards, a violet crystal) and the starting 1,500 Marks: walk to Redstair's runesmith, E, cut a Star letter;
// walk to the Enchant Temple in the Citadel, E, Idony's counter, imbue Greg's bracelet with a one-letter Star word.
// npx tsx scripts/runesmith-check.mts  (URL= to point elsewhere). Writes /tmp/smith-<n>.png
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { doorByKey } from '../src/app/shimmer/open/business/doors'
import { recipeOf, wordsFor, CUT_FEE, IMBUE_FEE, letterItem } from '../src/app/shimmer/open/business/letters'
import { newInv, give } from '../src/app/shimmer/open/shared/inventory'
import { RUNESMITH_CUT, IDONY_HUSH } from '../src/app/shimmer/open/business/errand-lines'
import { DOOR_ASK } from '../src/app/shimmer/open/continent/door-talk'   // the answer labels lark writes: a reword never stales the check
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
let inv = newInv(); for (const x of recipeOf('star')) inv = give(inv, x.id, x.n).inv
const word = wordsFor('bracelet').find(w => w.letters.length === 1 && w.letters[0] === 'star')!
console.log('word', word.id, word.name)
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const URL = process.env.URL ?? 'https://ather.games'
const br = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await br.newPage()
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e)))
await p.evaluateOnNewDocument((invJson) => { localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.inv.v1', invJson); localStorage.removeItem('open.loadout.v1'); localStorage.removeItem('ather:trade:trial-ledger') }, JSON.stringify(inv))
await p.setViewport({ width: 960, height: 600 })
let fails = 0, shot = 0
const ok = (c: boolean, m: string) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) fails++ }
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(500) } return false }
await p.goto(`${URL}/shimmer/open/continent?hour=12`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__drive?.state && !!(window as any).__market, { timeout: 240000 }); await wait(2000)
await p.keyboard.press('KeyW'); await wait(500)
const goTo = async (key: string) => {
  const d = doorByKey(R, key)!, fx = Math.cos(d.b.yaw), fz = Math.sin(d.b.yaw), yaw = Math.atan2(fx, fz)
  await p.evaluate((x, z) => (window as any).__drive.tp(x + 30, z + 30, 0, 0), d.at.x, d.at.z); await wait(6000)
  await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, -0.08), d.at.x + fx, d.at.z + fz, yaw); await wait(3000)
  ok(await poll(async () => await p.evaluate(() => (window as any).__market.reach()) === key), `${key}: in reach`)
  await p.keyboard.press('KeyE')
}
const marks = () => p.evaluate(() => JSON.parse(localStorage.getItem('ather:trade:trial-ledger') ?? '{"marks":1500}').marks ?? 1500)
const bagHas = (id: string) => p.evaluate((id) => (JSON.parse(localStorage.getItem('open.inv.v1') ?? '{"slots":[]}').slots as any[]).filter(Boolean).filter(s => s.id === id).reduce((a, s) => a + s.n, 0), id)
// BETA M13 part 3: a counter TALKS first (continent/door-talk.ts): the line in a bubble over the door, the answers below
const bubble = () => p.evaluate(() => document.querySelector('[data-talk-bubble]')?.textContent ?? '')
const answers = () => p.evaluate(() => [...document.querySelectorAll('[data-talk-option]')].map(e => (e.textContent ?? '').replace('›', '').trim()))
const answer = async (label: string) => { await p.evaluate((l) => ([...document.querySelectorAll<HTMLElement>('[data-talk-option]')].find(e => (e.textContent ?? '').includes(l)))?.click(), label); await wait(800) }
// 1) Redstair: cut the Star letter
await goTo('smith:fire')
ok(await poll(async () => (await bubble()).includes(RUNESMITH_CUT), 15000) && !(await p.$('[data-panel="smith-panel"]')), `E at the runesmith talks first, no panel yet ("${(await bubble()).slice(0, 60)}")`)
ok((await answers()).join('|') === `${DOOR_ASK.cut}|${DOOR_ASK.bye}`, `the answers: ${(await answers()).join(' / ')}`)
await p.screenshot({ path: `/tmp/smith-${++shot}.png` })
await answer(DOOR_ASK.cut)
ok(await poll(async () => !!(await p.$('[data-panel="smith-panel"] [data-letter="star"]')), 15000), "Redstair's runesmith counter lists the Star letter")
await p.screenshot({ path: `/tmp/smith-${++shot}.png` })
await p.evaluate(() => [...document.querySelectorAll<HTMLButtonElement>('[data-letter="star"] button')].find(b => /Cut/.test(b.textContent ?? ''))?.click()); await wait(1200)
ok((await bagHas(letterItem('star'))) === 1 && (await bagHas('blankstone')) === 0, 'cut: a Star letter in the bag, the Blankstone spent')
ok((await marks()) === 1500 - CUT_FEE, `cut fee taken (${await marks()})`)
await p.evaluate(() => document.querySelector<HTMLElement>('[data-panel="smith-panel"] button[aria-label]')?.click()); await wait(800)
// 2) the Citadel: Idony imbues Greg's bracelet
await goTo('front:enchant-temple')
ok(await poll(async () => (await bubble()).includes(IDONY_HUSH), 15000), `the Temple: Idony at her bench, hushed ("${(await bubble()).slice(0, 60)}")`)
ok((await answers()).includes(DOOR_ASK.inscribe) && (await answers()).includes(DOOR_ASK.letters), `the Temple's answers: ${(await answers()).join(' / ')}`)
await answer(DOOR_ASK.inscribe)
ok(await poll(async () => !!(await p.$(`[data-panel="idony-panel"] [data-word="${word.id}"][data-ready]`)), 15000), `Idony: ${word.name} is ready (its letter is in the bag)`)
await p.screenshot({ path: `/tmp/smith-${++shot}.png` })
await p.evaluate((id) => [...document.querySelectorAll<HTMLButtonElement>(`[data-word="${id}"] button`)].find(b => /Imbue/.test(b.textContent ?? ''))?.click(), word.id); await wait(1200)
// Idony's beat (lark, signed 11-16): she works, stops at the last seat, the keeper SAYS the word, the cord closes
const lines: string[] = []
let said = false
// ...now in the talk bubble over her door, one step per answer (the panel closes when she starts)
ok(await poll(async () => !!(await p.$('[data-talk-bubble]')) && !(await p.$('[data-panel="idony-panel"]')), 10000), "Idony's beat moves into the talk bubble")
for (let k = 0; k < 12 && (await p.$('[data-talk-option]')); k++) {
  const t = `${await bubble()} › ${(await answers()).join('|')}`; lines.push(t)
  if (/Say it/.test(t)) { said = true; await p.screenshot({ path: `/tmp/smith-${++shot}.png` }) }
  await p.keyboard.press('KeyE'); await wait(700)   // E answers the lit (only) option, the way a keeper would
}
ok(said && lines.some(l => /On the bench\. Say nothing yet\./.test(l)) && lines.some(l => /That first letter is yours/.test(l)) && lines.some(l => /It was only ever waiting on you/.test(l)), `Idony's beat plays, and the keeper says the word (${lines.length} steps)`)
const lo = await p.evaluate(() => JSON.parse(localStorage.getItem('open.loadout.v1') ?? '{}'))
ok(lo.vessels?.find((v: any) => v.id === 'starter-bracelet')?.word === word.id, `Greg's bracelet carries ${word.name}`)
ok((await bagHas(letterItem('star'))) === 0 && (await marks()) === 1500 - CUT_FEE - IMBUE_FEE, `the letter + imbue fee spent (${await marks()} Marks left)`)
// 3) the Star Temple on the Spine's highest peak: its runesmith cuts the Star letter too (schools.md: either seat)
await p.evaluate(() => document.querySelector<HTMLElement>('[data-panel="idony-panel"] button[aria-label]')?.click()); await wait(800)
{ const d = doorByKey(R, 'smith:star')!, fx = Math.cos(d.b.yaw), fz = Math.sin(d.b.yaw)
  await p.evaluate((x, z) => (window as any).__drive.tp(x + 40, z + 40, 0, 0), d.at.x, d.at.z); await wait(6000)
  await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, -0.05), d.at.x + fx * 14, d.at.z + fz * 14, Math.atan2(fx, fz)); await wait(5000)
  await p.screenshot({ path: `/tmp/smith-${++shot}.png` }) }
await goTo('smith:star')
await poll(async () => (await bubble()).includes(RUNESMITH_CUT), 15000); await answer(DOOR_ASK.cut)
ok(await poll(async () => !!(await p.$('[data-panel="smith-panel"][data-seat="star"], [data-panel="smith-panel"] [data-seat="star"]')) && !!(await p.$('[data-letter="star"]')), 15000), "the Star Temple's runesmith, on the peak, cuts Star")
ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
await br.close()
console.log(fails ? `runesmith-check: ${fails} FAIL` : 'runesmith-check: PASS')
process.exit(fails ? 1 : 0)
