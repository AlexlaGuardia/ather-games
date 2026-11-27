// ── BETA M233 CLASH v2c FIGHT MEMORY (2026-11-27, play-M233v2c) ────────────────────────────────────────────────────────
// A test keeper (dummy_m233_v2c), her bloomed fox in a planter + party, NO lessons. Runs DESKTOP 1280 then 390:
//   P0 (play-clash-fix: Clash runs from a FRESH load first, as m238; the planter is seeded only for the garden loads) her pot: no lessons.
//   C1 Clash (easy tent, ?clashseed=S1, picked offline so her bout's log hits a trigger and she learns): after the run her
//      pot holds exactly the lesson(s) the engine predicts (clash-lessons.ts learnFrom on the same seeded bout).
//   P1 reload the garden: her panel lists the lesson (data-spirit-lesson) = it survived the reload.
//   C2 a second run (?clashseed=S2): her bout's log shows the learned TACTIC at work (data-clash-tactics), as predicted.
// 0 page errors. ⚠ writes the LIVE accounts db for the test keeper only: her fair_clash + saves rows are wiped start + end.
//   npx tsx scripts/m233-lessons-check.mts [--url https://ather.games] [--out docs/looks/m233-v2c-2026-11-27] [--only desk|390]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync, readFileSync } from 'fs'
import { BLOOM_MS } from '../src/app/shimmer/open/ather/spirit-seeds'
import { aimAt } from './lib/aim.mts'
import { dismissStartCard } from './lib/start-card.mts'
import { fairDoor, tentsOf, type Network } from '../src/app/shimmer/open/ather/network'
import { fightRunner } from '../src/app/shimmer/open/ather/clash-bout'
import { newBracket, nextBout, recordBout, runOver, hasYou, YOU } from '../src/app/shimmer/open/ather/clash-bracket'
import { clashLineup, evenSpirit } from '../src/app/shimmer/open/ather/fair-clash'
import { CLASH_SEASON } from '../src/app/shimmer/open/ather/fair-clash-rules'
import { learnFrom, LESSONS } from '../src/app/shimmer/open/ather/clash-lessons'
import { knownOf } from '../src/app/shimmer/open/ather/spirit-bond-move'
import type { Element, Species } from '../src/app/shimmer/spirits/spirit'
if (!process.env.ATHER_SESSION_SECRET) { const m = readFileSync('.env', 'utf8').match(/^ATHER_SESSION_SECRET=(.*)$/m); if (m) process.env.ATHER_SESSION_SECRET = m[1].trim() }
const { upsertGoogleAccount, claimUsername, accountsDb } = await import('../src/lib/accounts/db')
const { mintSession } = await import('../src/lib/accounts/session')

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), outRoot = flag('--out', 'docs/looks/m233-v2c-2026-11-27'), only = flag('--only', '')
const P = { x: -130, z: 102.5 }, KEEP = { x: P.x - 1.5, z: P.z + 2.5 }
const ID = 'vx-m233'
const PLANTER = { id: ID, item: 'spirit_planter', x: P.x, z: P.z, q: 0, placedAt: 1 }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: unknown, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const ARGS = ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ARGS })
const a0 = upsertGoogleAccount('dummy-m233-dummy_m233_v2c', null, null)
if (!a0.username) { const c = claimUsername(a0.user_id, 'dummy_m233_v2c'); if (!c.ok) throw new Error(`claim: ${JSON.stringify(c)}`) }
const KA = { id: a0.user_id, name: 'dummy_m233_v2c' }
// play-clash-fix: her cloud save too (test keeper only): a kept save was pulled over the seeded pot (run 4: P0 found last run's lessons)
const wipe = () => { accountsDb().prepare('DELETE FROM fair_clash WHERE user_id = ?').run(KA.id); accountsDb().prepare('DELETE FROM saves WHERE user_id = ?').run(KA.id) }

// ── the prediction: the ring's run replayed headless (same entrants, bracket, seeds; she learns between her bouts)
const POT0 = { seed: 'mana_seed_fox', at: 1, bloomed: true, bond: 40 }
const KNOWN = knownOf(POT0 as any, 'fox')
type Pred = { have: string[]; bouts: { i: number; tactics: Record<string, number>; learned: string | null }[] }
function predict(lessons: string[], S: number, lineup: { species: Species; element: Element }[]): Pred {
  const ents = [{ species: 'fox' as Species, element: 'base' as Element }, ...lineup]
  let b = newBracket(lineup.length), have = [...lessons]
  const bouts: Pred['bouts'] = []
  for (let g = 0; g < 10 && !runOver(b); g++) {
    const i = nextBout(b)!; const bt = b.bouts[i], swap = bt.b === YOU
    const [sa, sb] = swap ? [bt.b!, bt.a!] : [bt.a!, bt.b!]
    const side = (k: number) => ({ spirit: evenSpirit(ents[k].species, ents[k].element, 'easy'), keeper: k === YOU, bonded: null, known: k === YOU ? KNOWN : undefined, lessons: k === YOU ? have : undefined })
    const play = fightRunner.run(side(sa), side(sb), { tier: 'easy', seed: S * 1000 + i })
    play.at(1e6)
    const w = play.winner() === 'a' ? sa : sb
    if (hasYou(bt)) {
      const st = play.state!, foe = ents[sb]
      const tactics: Record<string, number> = {}
      for (const e of play.log!) if (e.kind === 'tactic' && e.side === 0 && e.tactic) tactics[e.tactic] = (tactics[e.tactic] ?? 0) + 1
      const learned = learnFrom(have, { side: 0, foe, won: w === YOU, hpEnd: st.f[0].hp / st.f[0].maxHp, ev: play.log! }, play.seed!)
      if (learned) have = [...have, learned]
      bouts.push({ i, tactics, learned })
    }
    b = recordBout(b, i, w)
  }
  return { have, bouts }
}
const tacOf = (id: string) => LESSONS.find(l => l.id === id)!.tactic

async function page(desk: boolean) {
  const p = await (await br.createBrowserContext()).newPage()
  if (desk) await p.setViewport({ width: 1280, height: 800 })
  else await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  return p
}

async function main(p: Page, desk: boolean, out: string, errs: string[]): Promise<Page> {
  const shot = async (n: string) => { try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
  const net = await (await fetch(`${url}/open/wilds/network-s1.json`, { cache: 'no-store' })).json() as Network
  const clash = tentsOf(net).filter(x => x.contest === 'clash'), t = clash[clash.findIndex(x => x.level === 'easy')]
  const lineup = clashLineup(CLASH_SEASON, clash.indexOf(t), 'easy')
  // S1: she learns in run 1; S2: in run 2 a learned lesson's tactic is at work in a bout of hers
  let S1 = 0, S2 = 0, p1: Pred | null = null, p2: Pred | null = null
  for (let s = 1; s < 400 && !S1; s++) { const r = predict([], s, lineup); if (r.have.length) { S1 = s; p1 = r } }
  for (let s = 1; s < 400 && p1 && !S2; s++) { const r = predict(p1.have, s, lineup); if (r.bouts.some(bo => p1!.have.some(l => (bo.tactics[tacOf(l)] ?? 0) >= 2))) { S2 = s; p2 = r } }
  console.log(`   tent #${clash.indexOf(t)} line-up ${lineup.map(f => f.species).join(',')} · S1 ${S1} learns ${JSON.stringify(p1?.bouts)} · S2 ${S2} ${JSON.stringify(p2?.bouts.map(b => b.tactics))}`)
  if (!S1 || !S2) { ok(false, 'found seeds offline'); return p }

  await p.setCookie({ name: 'ather_session', value: mintSession(KA.id, KA.name), domain: new URL(url).hostname, path: '/', httpOnly: true })
  const TUT = { v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: [], gifts: ['pruner', 'spike'], b2: 'none', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }
  // seeding (play-clash-fix): the FIRST load seeds her pot + party like m238's Clash phase (no planter: a garden-first run
  // never listed her at the tent sign-up); a garden load sets 'm233-garden' first and gets the planter that holds her.
  const seed = async (pg: Page, POT: unknown) => pg.evaluateOnNewDocument((s: any) => {
    const ids = ['', `u:${s.id}:`]
    if (!sessionStorage.getItem('m233v2c')) {
      sessionStorage.setItem('m233v2c', '1')
      // the birth rune is a PER-KEEPER key: anonymous-only left a fresh test keeper under 'Choose your Rune' (c1 shot 11-27)
      for (const pre of ids) localStorage.setItem(`${pre}ather:shimmer:birthRune`, 'star')
      localStorage.setItem('open.tutorial.v1', JSON.stringify(s.TUT))
      localStorage.setItem('open.rinquest.v1', JSON.stringify({ v: 1, state: 'done', step: 0 }))
      for (const pre of ids) {
        localStorage.setItem(`${pre}ather.grimoire.v1`, JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots: { [s.ID]: { ...s.POT, at: s.at } }, met: [] }))
        localStorage.setItem(`${pre}ather.spiritParty.v1`, JSON.stringify([s.ID]))
      }
    }
    if (sessionStorage.getItem('m233-garden')) {
      sessionStorage.removeItem('m233-garden')
      for (const pre of ids) {
        localStorage.setItem(`${pre}open.inv.v1`, JSON.stringify({ v: 1, slots: Array(32).fill(null), gifts: ['bait1'] }))
        localStorage.setItem(`${pre}open.works.v1`, JSON.stringify({ v: 1, rooms: [], chests: [], pieces: [s.PL] }))
      }
    }
  }, { TUT, POT, PL: PLANTER, ID, at: Date.now() - BLOOM_MS - 60000, id: KA.id } as any)
  await seed(p, POT0)
  const pot = (pg: Page = p) => pg.evaluate((pre: string, id: string) => JSON.parse(localStorage.getItem(`${pre}ather.grimoire.v1`) ?? 'null')?.pots?.[id] ?? null, `u:${KA.id}:`, ID)
  const load = async (q: string) => {
    await p.goto(`${url}/shimmer/open/ather?hour=14${q}`, { waitUntil: 'load', timeout: 240000 })
    await p.waitForFunction(() => !!(window as any).__ather?.travel, { timeout: 240000, polling: 1000 }); await sleep(3000)
    try { await dismissStartCard(p) } catch { for (let i = 0; i < 3; i++) { await p.keyboard.press('Escape'); await sleep(600) }; await dismissStartCard(p).catch(() => {}) }
  }
  const garden = async () => {
    await p.evaluate(() => sessionStorage.setItem('m233-garden', '1'))
    await load('')
    await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), KEEP.x, KEEP.z)
    for (let i = 0; i < 60; i++) { await sleep(500); if (await p.evaluate(() => !!(window as any).__spiritModel?.trots?.fox)) break }
    if (desk) await p.evaluate(`(function tr() { const g = window.__ather, q = window.__spiritModel?.trots?.fox
      if (g && q) { const s = g.state(), sx = s.px ?? s.x, sz = s.pz ?? s.z, dx = q.x - sx, dz = q.z - sz
        g.look(Math.atan2(-dx, -dz), Math.atan2(q.y + q.h * 0.5 - (g.ground(sx, sz) + 1.6), Math.hypot(dx, dz))) }
      requestAnimationFrame(tr) })()`)
  }
  // m240's aim: the pick on her, E in the same tick at desk (she trots; slow swiftshader frames)
  const aimHer = async (): Promise<boolean> => {
    for (let k = 0; k < 30; k++) {
      const t = await p.evaluate(() => { const q = (window as any).__spiritModel?.trots?.fox; return q ? { x: q.x, z: q.z, y: q.y, h: q.h } : null }) as { x: number; z: number; y: number; h: number } | null
      if (!t) { await sleep(1000); continue }
      const d = await p.evaluate((x, z) => { const s = (window as any).__ather.state(); return Math.hypot(x - (s.px ?? s.x), z - (s.pz ?? s.z)) }, t.x, t.z) as number
      if (d > 2.6 || d < 1) { await p.evaluate((x, z) => (window as any).__ather.tp(x + 1.8, z + 0.6, 0), t.x, t.z); await sleep(600); continue }
      await aimAt(p, t.x, t.z, t.y - (await p.evaluate((x, z) => (window as any).__ather.ground(x, z), t.x, t.z) as number) + t.h * 0.5, 2)
      for (let j = 0, miss = 0; j < 12; j++) {
        const r = await p.evaluate((desk: boolean) => {
          const on = (window as any).__ather.near()?.kind === 'spirit', pr = [...document.querySelectorAll('[data-prompt-line]')].map(e => e.textContent ?? '').join(' | ')
          const hit = on && /E · /.test(pr)
          if (hit && desk) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e' }))
          return { on, hit }
        }, desk)
        if (!r.on && ++miss > 2) break
        if (r.hit) { if (!desk) await p.keyboard.press('e'); return true }
        await sleep(200)
      }
    }
    return false
  }
  const opts = () => p.evaluate(() => [...document.querySelectorAll('[data-talk-option]')].map(x => (x.textContent ?? '').replace('›', '').trim()))
  const talk = async () => { for (let i = 0; i < 8; i++) { if (await aimHer()) { await sleep(1000); const o = await opts(); if (o.length) return o } await p.keyboard.press('Escape'); await sleep(400) } return [] as string[] }
  const choose = async (re: RegExp) => p.evaluate((src: string) => { const b = [...document.querySelectorAll('[data-talk-option]')].find(x => new RegExp(src).test((x.textContent ?? '').replace('›', '').trim())) as HTMLElement | undefined; b?.click(); return !!b }, re.source)

  const panel = async (): Promise<{ list: string | null; empty: boolean } | null> => {
    for (let k = 0; k < 3; k++) {
      const o = await talk()
      if (o.length && await choose(/^Open/)) {
        for (let i = 0; i < 20; i++) { await sleep(400); const r = await p.evaluate(() => { const e = document.querySelector('[data-spirit-lessons]') as HTMLElement | null; return e ? { list: e.dataset.spiritLessons ?? '', empty: !!document.querySelector('[data-spirit-lessons-empty]') } : null }); if (r) return r }
      }
      await p.keyboard.press('Escape'); await sleep(500)
    }
    return null
  }
  const A = (fn: string, ...a: unknown[]) => p.evaluate((f: string, x: unknown[]) => (window as any).__ather?.[f]?.(...x), fn, a)
  const d = fairDoor(t), yaw = Math.atan2(-(t.x - d.x), -(t.z - d.z)), back = { x: t.x + Math.sin(t.yaw) * 40, z: t.z + Math.cos(t.yaw) * 40 }
  const openTent = async () => {
    await p.keyboard.press('Escape'); await sleep(500)
    if ((await A('zone')) !== 'wilds') {
      for (let i = 0; i < 6 && !(await A('wmGoto', back.x, back.z)); i++) await sleep(2000)
      for (let k = 0; k < 40 && (await A('zone')) !== 'wilds'; k++) await sleep(1000)
      await sleep(6000)
    }
    for (let i = 0; i < 60; i++) {
      if (i % 12 === 0) await p.evaluate((a: any) => { const X = (window as any).__ather; X.tp(a.x, a.z, a.yaw); X.look?.(a.yaw, -0.05) }, { ...d, yaw })
      if (/E · the Thistledown Fair/.test(await p.evaluate(() => document.body.innerText))) break
      await sleep(500)
    }
    // desk: a page key press does not reach the game without pointer lock (m238 ran its Clash at 390 only): dispatch it, as aimHer
    for (let k = 0; k < 4 && !(await p.$('[data-signup-enter] button')); k++) {
      if (desk) await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e' })))
      else await p.keyboard.press('KeyE')
      await sleep(1500)
      for (let i = 0; i < 10 && !(await p.$('[data-signup-enter] button')); i++) await sleep(500)
    }
  }
  const run = async (tag: string) => {
    await openTent()
    const s = await p.$(`[data-signup-spirit="${ID}"]`)
    if (!s) {
      await shot(`${tag}-x-no-signup`)
      const dbg = await p.evaluate(() => ({ zone: (window as any).__ather?.zone?.(), panel: !!document.querySelector('[data-panel="clash"]'), spirits: [...document.querySelectorAll('[data-signup-spirit]')].map(e => (e as HTMLElement).dataset.signupSpirit) }))
      ok(false, `${tag}: her fox at the sign-up (${JSON.stringify(dbg)})`); return null
    }
    // DOM clicks (m242: a mouse click at desk can land on the locked canvas instead of the panel), Enter retried once
    await s.evaluate(e => (e as HTMLElement).click()); await sleep(400)
    let ring = false
    for (let k = 0; k < 2 && !ring; k++) {
      await p.evaluate(() => (document.querySelector('[data-signup-enter] button') as HTMLElement | null)?.click())
      ring = await p.waitForSelector('[data-clash-ring="ring"]', { timeout: 90000 }).then(() => true, () => false)
    }
    if (!ring) { await shot(`${tag}-x-no-ring`); ok(false, `${tag}: the ring mounted after Enter`); return null }
    console.log(`   ${tag}: ring up; her pot lessons as she entered ${JSON.stringify((await pot())?.lessons ?? [])}`)
    // an in-page observer keeps the LAST tactics value of each of her bouts (polling missed a bout's end at 20x: desk run 5)
    await p.evaluate(() => {
      const w = window as any; w.__m233tac = {}
      const grab = () => { const e = document.querySelector('[data-clash-keeper-bout="1"]') as HTMLElement | null; if (e?.dataset.clashBout != null && e.dataset.clashTactics != null) w.__m233tac[e.dataset.clashBout] = e.dataset.clashTactics }
      w.__m233obs?.disconnect(); w.__m233obs = new MutationObserver(grab); w.__m233obs.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-clash-tactics', 'data-clash-bout'] }); grab()
    })
    const seen = new Set<string>()
    for (let i = 0; i < 1500; i++) {
      const st = await p.evaluate(() => ({ b: (document.querySelector('[data-clash-keeper-bout="1"]') as HTMLElement | null)?.dataset.clashBout ?? null, res: (document.querySelector('[data-clash-ring-result]') as HTMLElement | null)?.dataset.clashRingResult }))
      if (st.b !== null && !seen.has(st.b)) { seen.add(st.b); await shot(`${tag}-bout${st.b}`) }
      if (st.res) break
      await sleep(250)
    }
    const tac = await p.evaluate(() => (window as any).__m233tac as Record<string, string>)
    await shot(`${tag}-result`)
    const ex = await p.$('[data-clash-exit]'); if (ex) { await ex.click(); await sleep(800) }
    return tac
  }

  // C1 (from a FRESH load, as m238): her pot starts with no lessons; after the run it holds the predicted one(s)
  await load(`&clashx=20&clashseed=${S1}`)
  const l0 = (await pot())?.lessons ?? []
  ok(l0.length === 0, `P0 before the run her pot has no lessons (${JSON.stringify(l0)})`)
  const t1 = await run('c1')
  const pot1 = await pot()
  const l1 = pot1?.lessons ?? []
  ok(JSON.stringify(l1) === JSON.stringify(p1!.have), `C1 after the run her pot holds ${JSON.stringify(l1)} (predicted ${JSON.stringify(p1!.have)}; her bouts ${JSON.stringify(t1)})`)
  // P1: reload into the garden: her panel lists the lesson
  await garden()
  const e1 = await panel()
  ok(e1 && !e1.empty && e1.list === p1!.have.join(','), `P1 reload: her panel lists ${e1?.list} (want ${p1!.have.join(',')})`)
  await shot('p1-panel-lessons'); await p.keyboard.press('Escape'); await sleep(500)
  // C2: the same keeper, reloaded again (no new session: a fresh context pulled her cloud save over the seeded pot)
  await load(`&clashx=20&clashseed=${S2}`)
  ok(JSON.stringify((await pot())?.lessons ?? []) === JSON.stringify(l1), `C2 after the reload her pot still holds ${JSON.stringify(l1)}`)
  const t2 = await run('c2') ?? {}
  const want = p1!.have.map(tacOf)
  const shown = Object.values(t2).join(',')
  ok(want.some(w => new RegExp(`\\b${w}:`).test(shown)), `C2 her bout's log shows the learned tactic at work: ${JSON.stringify(t2)} (lessons ${p1!.have.join(',')} -> ${want.join(',')})`)
  ok(errs.length === 0, `0 page errors (${errs.join(' ; ')})`)
  return p
}

try {
  wipe()
  for (const desk of [true, false]) {
    if (only && only !== (desk ? 'desk' : '390')) continue
    const tag = desk ? 'desk' : '390', out = `${outRoot}/${tag}`; mkdirSync(out, { recursive: true })
    console.log(`── ${tag}`)
    const p = await page(desk)
    const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
    try { await main(p, desk, out, errs) } catch (e) { ok(false, `${tag} threw: ${String(e).slice(0, 200)}`) }
    for (const c of br.browserContexts()) if (c !== br.defaultBrowserContext()) await c.close().catch(() => {})
    wipe()
  }
} finally { await br.close(); wipe() }
console.log(fails ? `${fails} FAIL` : 'ALL PASS')
process.exit(fails ? 1 : 0)
