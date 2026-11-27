// ── BETA M238 HER FAVOURITE (BONDED) MOVE (2026-11-27, play-M238) ─────────────────────────────────────────────────────
// canon game/shimmer-battles.md › THE BONDED MOVE (Magii 4204f49 / 933293c / a32928c). Runs DESKTOP 1280 then 390.
//  TALK (owner + ?spirits=3d, a seeded bloomed fox; stages patched into her pot by evaluateOnNewDocument before each load):
//   W. bond 254 (one short of max): E on her = Follow / Open, NO 'Pick a bond'.
//   M. bond 255 (reload): 'Pick a bond' shows; it lists her known moves (base form: raw/neutral, no element move);
//      pick Storm Scatter -> her pot saves fav + known moves; the talk again: no 'Pick a bond'; reload: still saved, still gone.
//   E. an EVOLUTION (reload: element storm, the bond's first day moved 14 game days back = twist 2): 'Pick a bond' shows again;
//      pick another -> fav changes, its first day (= the twist) CARRIES.
//  CLASH (a dummy keeper, ?clashseed): her fox WITH a favourite throws it in her bout (data-clash-bonded = id:twist); her
//      second fox with NONE throws the seeded random known move the engine draws for that seed (not the old 'first move').
// ⚠ The Clash half writes the LIVE accounts db for a test keeper only (dummy_m238_a): her fair_clash rows are wiped start + end.
//   npx tsx scripts/m238-bonded-check.mts [--url https://ather.games] [--out docs/looks/m238-2026-11-27] [--only desk|390] [--skip talk|clash]
import puppeteer, { type Page } from 'puppeteer-core'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { BLOOM_MS, gameDay } from '../src/app/shimmer/open/ather/spirit-seeds'
import { aimAt } from './lib/aim.mts'
import { dismissStartCard } from './lib/start-card.mts'
import { fairDoor, tentsOf, type Network } from '../src/app/shimmer/open/ather/network'
import { tentEntrant, resolveBonded, bondSeed, defaultBonded } from '../src/app/shimmer/open/ather/clash-fight'
import { knownOf, twistOf } from '../src/app/shimmer/open/ather/spirit-bond-move'
if (!process.env.ATHER_SESSION_SECRET) { const m = readFileSync('.env', 'utf8').match(/^ATHER_SESSION_SECRET=(.*)$/m); if (m) process.env.ATHER_SESSION_SECRET = m[1].trim() }
const { upsertGoogleAccount, claimUsername, accountsDb } = await import('../src/lib/accounts/db')
const { mintSession } = await import('../src/lib/accounts/session')

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), outRoot = flag('--out', 'docs/looks/m238-2026-11-27'), only = flag('--only', ''), skip = flag('--skip', '')
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.error('no OWNER_KEY (env or .env)'); process.exit(2) }
const P = { x: -130, z: 102.5 }, KEEP = { x: P.x - 1.5, z: P.z + 2.5 }
const PLANTER = { id: 'vx-m238', item: 'spirit_planter', x: P.x, z: P.z, q: 0, placedAt: 1 }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: unknown, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const ARGS = ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ARGS })

const a0 = upsertGoogleAccount('dummy-m238-dummy_m238_a', null, null)
if (!a0.username) { const c = claimUsername(a0.user_id, 'dummy_m238_a'); if (!c.ok) throw new Error(`claim: ${JSON.stringify(c)}`) }
const KA = { id: a0.user_id, name: 'dummy_m238_a' }
const wipe = () => { accountsDb().prepare('DELETE FROM fair_clash WHERE user_id = ?').run(KA.id) }

async function talkPhase(p: Page, desk: boolean, out: string, errs: string[]) {
  const shot = async (n: string) => { try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
  await p.goto(`${new URL(url).origin}/owner?key=${encodeURIComponent(KEY!)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await p.goto(`${new URL(url).origin}/api/owner`, { waitUntil: 'load', timeout: 60000 })
  if (!await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner))) { ok(false, 'owner cookie took'); return }
  // each load: the FIRST seeds the keeper; later loads patch her pot per sessionStorage 'm238-stage' (before the game reads it)
  await p.evaluateOnNewDocument((at: number, pl: unknown) => {
    const K = 'ather.grimoire.v1'
    if (!sessionStorage.getItem('m238')) {
      sessionStorage.setItem('m238', '1')
      localStorage.setItem('ather:shimmer:birthRune', 'star')
      localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots: Array(32).fill(null), gifts: ['bait1'] }))
      localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: [pl] }))
      localStorage.setItem(K, JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots: { 'vx-m238': { seed: 'mana_seed_fox', at, bloomed: true, bond: 254 } }, met: [] }))
      localStorage.setItem('ather.spiritParty.v1', JSON.stringify(['vx-m238']))
      return
    }
    const st = sessionStorage.getItem('m238-stage'); if (!st) return
    sessionStorage.removeItem('m238-stage')
    const b = JSON.parse(localStorage.getItem(K) ?? 'null'), pot = b?.pots?.['vx-m238']; if (!pot) return
    if (st === 'max') pot.bond = 255
    if (st === 'evo') { pot.element = 'storm'; if (pot.fav) pot.fav.day -= 14 }
    localStorage.setItem(K, JSON.stringify(b))
  }, Date.now() - BLOOM_MS - 60000, PLANTER)
  const pot = () => p.evaluate(() => JSON.parse(localStorage.getItem('ather.grimoire.v1') ?? 'null')?.pots?.['vx-m238'] ?? null)
  const load = async (stage?: string) => {
    if (stage) await p.evaluate(s => sessionStorage.setItem('m238-stage', s), stage)
    await p.goto(`${url}/shimmer/open/ather?hour=14&spirits=3d`, { waitUntil: 'load', timeout: 240000 })
    await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(2500)
    try { await dismissStartCard(p) } catch (e) { console.log(`(start card: ${String(e).slice(0, 120)})`) }
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

  // ── W. one short of max
  await load()
  const w = await talk()
  ok(w.length > 0 && w.some(o => /^Open/.test(o)) && !w.some(o => /Pick a bond/.test(o)), `W bond 254: the talk (${w.join(' / ')}) has no 'Pick a bond'`)
  await shot('w-below-max'); await p.keyboard.press('Escape'); await sleep(500)
  // ── M. maxed
  await load('max')
  const b0 = await pot()
  const m = await talk()
  ok(b0?.bond === 255 && /^Pick a bond/.test(m[0] ?? ''), `M bond ${b0?.bond}: 'Pick a bond' in Feed's old slot (${m.join(' / ')})`)
  await shot('m-0-ask')
  ok(await choose(/^Pick a bond/), 'M Pick a bond opens'); await sleep(800)
  const list = await opts()
  const want = knownOf({ seed: 'mana_seed_fox', at: 1, bloomed: true, bond: 255 } as any, 'fox')
  ok(list.length === want.length + 1 && list.some(o => /^Storm Scatter/.test(o)) && /^Not now/.test(list[list.length - 1]), `M it lists her ${want.length} known moves + Not now (${list.join(' / ')})`)
  await shot('m-1-moves')
  await choose(/^Storm Scatter/); await sleep(1200)
  const b1 = await pot()
  ok(b1?.fav?.id === 'storm_scatter' && b1.fav.form === 'base' && Array.isArray(b1.moves) && b1.moves.length === want.length, `M picked: saved fav ${JSON.stringify(b1?.fav)}, ${b1?.moves?.length} known moves`)
  await shot('m-2-picked')
  const m2 = await talk()
  ok(m2.length > 0 && !m2.some(o => /Pick a bond/.test(o)), `M after the pick: 'Pick a bond' gone (${m2.join(' / ')})`)
  await p.keyboard.press('Escape'); await sleep(500)
  await load()
  const b2 = await pot(), m3 = await talk()
  ok(b2?.fav?.id === 'storm_scatter' && m3.length > 0 && !m3.some(o => /Pick a bond/.test(o)), `M reload: favourite kept (${b2?.fav?.id}), option still gone (${m3.join(' / ')})`)
  await p.keyboard.press('Escape'); await sleep(500)
  // ── E. evolution
  await load('evo')
  const e0 = await pot(), day = gameDay(Date.now())
  const e = await talk()
  ok(e0?.element === 'storm' && /^Pick a bond/.test(e[0] ?? ''), `E evolved (${e0?.element}): 'Pick a bond' shows again (${e.join(' / ')})`)
  ok(twistOf(e0, day) === 2, `E her twist before the re-pick: ${twistOf(e0, day)}`)
  await choose(/^Pick a bond/); await sleep(800)
  const el = await opts()
  const re = el.find(o => !/^(Storm Scatter|Not now)/.test(o) && !/^Mana Pulse|^Spirit Ward/.test(o)) ?? el[0]
  await choose(new RegExp('^' + re.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))); await sleep(1200)
  const e1 = await pot()
  ok(e1?.fav && e1.fav.id !== 'storm_scatter' && e1.fav.form === 'storm' && e1.fav.day === e0.fav.day && twistOf(e1, day) === 2, `E re-pick ${re}: fav ${JSON.stringify(e1?.fav)}, twist CARRIED ${twistOf(e1, day)}`)
  await shot('e-repicked')
  ok(errs.length === 0, `talk: 0 page errors (${errs.join(' ; ')})`)
}

async function clashPhase(p: Page, out: string, errs: string[]) {
  const net = await (await fetch(`${url}/open/wilds/network-s1.json`, { cache: 'no-store' })).json() as Network
  const clash = tentsOf(net).filter(x => x.contest === 'clash'), easyNo = clash.findIndex(x => x.level === 'easy'), t = clash[easyNo]
  // a seed where the no-favourite fox's random move differs from the old 'first species move' default
  const POT_B = { seed: 'mana_seed_fox', at: 1, bloomed: true }
  const knownB = knownOf(POT_B as any, 'fox'), EB = { ...tentEntrant('fox', 'base', 'easy'), known: knownB }
  let SEED = 0
  for (let s = 1; s < 500 && !SEED; s++) if (resolveBonded(EB, bondSeed(s * 1000 + 1, 0)).id !== defaultBonded('fox', 'base', 12).id) SEED = s
  const expectB = resolveBonded(EB, bondSeed(SEED * 1000 + 1, 0))
  console.log(`   clash seed ${SEED}: no-favourite fox expects ${expectB.id} (old default ${defaultBonded('fox', 'base', 12).id})`)
  const day = gameDay(Date.now())
  const POTS = { 'vx-a': { seed: 'mana_seed_fox', at: 1, bloomed: true, bond: 255, moves: knownB, fav: { id: 'storm_scatter', form: 'base', day: day - 14 } }, 'vx-b': POT_B }
  await p.setCookie({ name: 'ather_session', value: mintSession(KA.id, KA.name), domain: new URL(url).hostname, path: '/', httpOnly: true })
  const TUT = { v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: [], gifts: ['pruner', 'spike'], b2: 'none', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }
  await p.evaluateOnNewDocument((s: any) => {
    if (sessionStorage.getItem('m238c')) return; sessionStorage.setItem('m238c', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.tutorial.v1', JSON.stringify(s.TUT))
    localStorage.setItem('open.rinquest.v1', JSON.stringify({ v: 1, state: 'done', step: 0 }))
    for (const pre of ['', `u:${s.id}:`]) {
      localStorage.setItem(`${pre}ather.grimoire.v1`, JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots: s.POTS, met: [] }))
      localStorage.setItem(`${pre}ather.spiritParty.v1`, JSON.stringify(['vx-a', 'vx-b']))
    }
  }, { TUT, POTS, id: KA.id } as any)
  await p.goto(`${url}/shimmer/open/ather?hour=14&clashx=20&clashseed=${SEED}`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.travel, { timeout: 180000, polling: 1000 })
  await sleep(3000)
  try { await dismissStartCard(p) } catch { for (let i = 0; i < 3; i++) { await p.keyboard.press('Escape'); await sleep(600) }; await dismissStartCard(p).catch(() => {}) }
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
    await p.keyboard.press('KeyE'); await sleep(1500)
    for (let i = 0; i < 20 && !(await p.$('[data-signup-enter] button')); i++) await sleep(500)
  }
  const run = async (sid: string) => {
    await openTent()
    const s = await p.$(`[data-signup-spirit="${sid}"]`); if (!s) return null
    await s.click(); await sleep(300); await (await p.$('[data-signup-enter] button'))!.click()
    try { await p.waitForSelector('[data-clash-ring="ring"]', { timeout: 60000 }) }
    catch (e) { await p.screenshot({ path: `${out}/x-${sid}-no-ring.png` }).catch(() => {}); throw e }
    const bonded: Record<string, string> = {}
    for (let i = 0; i < 1200; i++) {
      const st = await p.evaluate(() => { const e = document.querySelector('[data-clash-bonded]') as HTMLElement | null; return { b: e?.dataset.clashBonded ?? null, i: e?.dataset.clashBout ?? null, res: (document.querySelector('[data-clash-ring-result]') as HTMLElement | null)?.dataset.clashRingResult } })
      if (st.b && st.i !== null && !bonded[st.i]) { bonded[st.i] = st.b; await p.screenshot({ path: `${out}/c-${sid}-bout${st.i}.png` }).catch(() => {}) }
      if (st.res) break
      await sleep(250)
    }
    const ex = await p.$('[data-clash-exit]'); if (ex) { await ex.click(); await sleep(800) }
    return bonded
  }
  const ba = await run('vx-a') ?? {}
  ok(Object.keys(ba).length > 0 && Object.values(ba).every(v => v === 'storm_scatter:2'), `C her favourite in every bout of hers: ${JSON.stringify(ba)} (want storm_scatter:2, a Lv29 move above the Lv12 tent)`)
  const bb = await run('vx-b') ?? {}
  const wantB = Object.fromEntries(Object.keys(bb).map(i => [i, `${resolveBonded(EB, bondSeed(SEED * 1000 + Number(i), 0)).id}:0`]))
  ok(Object.keys(bb).length > 0 && JSON.stringify(bb) === JSON.stringify(wantB), `C none picked: the seeded RANDOM known move per bout ${JSON.stringify(bb)} (want ${JSON.stringify(wantB)}; bout 1 differs from the old first move: ${expectB.id})`)
  ok(errs.length === 0, `clash: 0 page errors (${errs.join(' ; ')})`)
}

try {
  wipe()
  for (const desk of [true, false]) {
    if (only && only !== (desk ? 'desk' : '390')) continue
    const tag = desk ? 'desk' : '390', out = `${outRoot}/${tag}`; mkdirSync(out, { recursive: true })
    for (const phase of ['talk', 'clash'] as const) {
      if (skip === phase) continue
      console.log(`── ${tag} ${phase}`)
      const p = await (await br.createBrowserContext()).newPage()
      if (desk) await p.setViewport({ width: 1280, height: 800 })
      else await p.setViewport(phase === 'clash' ? { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { width: 390, height: 844 })
      const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
      await p.evaluateOnNewDocument('window.__name = (f) => f')
      try { if (phase === 'talk') await talkPhase(p, desk, out, errs); else await clashPhase(p, out, errs) }
      catch (e) { ok(false, `${tag} ${phase} threw: ${String(e).slice(0, 200)}`) }
      await p.close()
    }
  }
} finally { await br.close(); wipe() }
console.log(fails ? `${fails} FAIL` : 'ALL PASS')
process.exit(fails ? 1 : 0)
