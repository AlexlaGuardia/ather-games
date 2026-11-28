// M246 prod check: SMASH REDO, THE BELL SHOW (smash-bell-view.tsx) in the Clash ring.
//   1 BENCH (owner, /shimmer/dev?mode=fair&event=smash): a normal swing = intro + shout-out -> walk (her back to the camera) ->
//     strike -> gauge -> score, in the hundreds, no crack; a CRAFTED 9001 (the bench's test hook, ?smashscore=) cracks the bell
//     and the Moglin judge's line shows; the bench writes nothing.
//   2 WORLD (test keeper dummy_m233_a, non-owner): E at the Smash tent, Enter -> the same beats with HER spirit, the score lands
//     on the season board (a try spent); keeper B reads A's score on the one board.
//   3 LOBBY (dummy_m233_a + dummy_m233_b in one chord): both ready up -> both play the bell show: the same order, the same
//     scores, the same winner; back at the panel the same contest + champion.
//   4 0 page errors.
// ⚠ Writes the LIVE accounts db for the two test keepers only (their fair_smash rows + tries + saves wiped at start and end).
//   OWNER_KEY=... npx tsx scripts/m246-smash-check.mts [--phone] [--part bench|world|all] [--x 2] [--shots] [--url https://ather.games] [--out dir]
import puppeteer, { type Page, type Browser } from 'puppeteer-core'
import { mkdirSync, readFileSync } from 'fs'
import { dismissStartCard } from './lib/start-card.mts'
import { fairDoor, tentsOf, tentLabel, type Network } from '../src/app/shimmer/open/ather/network'
if (!process.env.ATHER_SESSION_SECRET) {
  const m = readFileSync('.env', 'utf8').match(/^ATHER_SESSION_SECRET=(.*)$/m)
  if (m) process.env.ATHER_SESSION_SECRET = m[1].trim()
}
const { upsertGoogleAccount, claimUsername, accountsDb } = await import('../src/lib/accounts/db')
const { mintSession } = await import('../src/lib/accounts/session')

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), PHONE = process.argv.includes('--phone'), PART = flag('--part', 'all'), X = Number(flag('--x', '2'))
/** --shots: a slow shot pass (?bellx=0.3: every beat several seconds, past the WebGL screenshot's lag) */
const SHOTS = process.argv.includes('--shots'), BX = SHOTS ? '&bellx=0.3' : ''
const out = flag('--out', '/tmp/m246') + (PHONE ? '-390' : '-desk'), KEY = process.env.OWNER_KEY
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const errs: string[] = [], fails: string[] = []
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails.push(m) }
const VIEW = PHONE ? { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { width: 1440, height: 900 }
const tag = PHONE ? '390' : 'desk'

const keeper = (n: string) => {
  const a = upsertGoogleAccount(`dummy-m233-${n}`, null, null)
  if (!a.username) { const c = claimUsername(a.user_id, n); if (!c.ok) throw new Error(`claim ${n}: ${JSON.stringify(c)}`) }
  return { id: a.user_id, name: a.username ?? n }
}
const KA = keeper('dummy_m233_a'), KB = keeper('dummy_m233_b')
const wipe = () => { for (const t of ['fair_smash', 'fair_smash_tries', 'saves']) { try { accountsDb().prepare(`DELETE FROM ${t} WHERE user_id IN (?, ?)`).run(KA.id, KB.id) } catch (e) { console.log(`   (wipe ${t}: ${String(e).slice(0, 80)})`) } } }
const CHORD = `M246${Math.random().toString(36).slice(2, 7).toUpperCase()}`

/** the bell show's recorder, in the page: every 40 ms it notes the beat log, the score, the crack, the judge line, the shout-out,
 *  and whether her back was to the camera during the walk + strike (a poll from outside misses a 400 ms beat) */
const RECORDER = () => {
  const w = window as any
  w.__bell = { logs: [] as string[], score: '', cracked: false, judge: '', shout: '', backWalk: [] as string[], backStrike: [] as string[], order: '', winner: '', rows: '' }
  // her facing is stamped by the page's frame loop (data-bell-back); a MutationObserver sees every beat + facing change, a slow poll does not
  let obsOn: Element | null = null
  const watch = () => {
    const v = document.querySelector('[data-smash-bell-view]'); if (!v || v === obsOn) return
    obsOn = v
    const read = () => { const d = (v as HTMLElement).dataset, r = w.__bell; if (d.bellBeat === 'walk') r.backWalk.push(d.bellBack ?? ''); if (d.bellBeat === 'strike') r.backStrike.push(d.bellBack ?? '') }
    new MutationObserver(read).observe(v, { attributes: true, attributeFilter: ['data-bell-beat', 'data-bell-back'] }); read()
  }
  setInterval(watch, 100)
  setInterval(() => {
    const v = document.querySelector('[data-smash-bell-view]') as HTMLElement | null; if (!v) return
    const r = w.__bell, d = v.dataset
    if (d.bellLog) r.logs = [d.bellLog]
    if (d.bellScore) r.score = d.bellScore
    if (d.bellCracked === '1') r.cracked = true
    const j = document.querySelector('[data-bell-judge-line]') as HTMLElement | null; if (j) r.judge = j.innerText
    const s = document.querySelector('[data-bell-shout]') as HTMLElement | null; if (s) r.shout = s.innerText
    if (d.bellOrder) r.order = d.bellOrder
    if (d.bellWinner) r.winner = d.bellWinner
    const rows = [...document.querySelectorAll('[data-bell-row]')].map(e => `${(e as HTMLElement).dataset.bellRow}=${(e as HTMLElement).dataset.bellRowScore}`).join(' ')
    if (rows) r.rows = rows
  }, 40)
}
const rec = (p: Page) => p.evaluate(() => { const r = (window as any).__bell; return r ? { ...r, log: r.logs[r.logs.length - 1] ?? '', logs: undefined } : null })
const beatsIn = (log: string, i: number) => log.split(',').filter(x => x.endsWith(`:${i}`)).map(x => x.split(':')[0])
/** wait for the show's end card, shooting each beat once as it comes (at --x 1 every beat is on screen long enough) */
async function playOut(p: Page, shot: string | null, ms = 120000) {
  const seen = new Set<string>(), t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const b = await p.evaluate(() => { const v = document.querySelector('[data-smash-bell-view]') as HTMLElement | null; return v ? `${v.dataset.bellBeat}:${v.dataset.bellI}` : null })
    if (b && shot && !seen.has(b)) { seen.add(b); await sleep(b.startsWith('intro') ? 500 : 150); await p.screenshot({ path: `${out}/${shot}-${b.replace(':', '')}.png` }) }
    if (b?.startsWith('end')) return true
    await sleep(150)
  }
  return false
}

const br: Browser = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  // ── 1 · BENCH (owner) ──
  if (PART === 'all' || PART === 'bench') {
    if (!KEY) { ok(false, '1. no OWNER_KEY: the bench part needs the owner'); } else {
      const p = await (await br.createBrowserContext()).newPage(); await p.setViewport(VIEW)
      p.on('pageerror', e => errs.push(`bench: ${String(e).slice(0, 200)}`))
      const writes: string[] = []
      p.on('request', q => { const u = q.url(); if (u.startsWith(url) && new URL(u).pathname.startsWith('/api/') && !['GET', 'HEAD'].includes(q.method())) writes.push(`${q.method()} ${u}`) })
      await p.evaluateOnNewDocument('window.__name = (f) => f')
      await p.evaluateOnNewDocument(RECORDER)
      if (PHONE) await p.evaluateOnNewDocument(() => { try { localStorage.setItem('shimmer-inspector-collapsed', 'true') } catch { /* */ } })
      await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
      const bench = async (q: string) => {
        await p.goto(`${url}/shimmer/dev?mode=fair&clashx=${X}${BX}${q}`, { waitUntil: 'load', timeout: 240000 })
        await dismissStartCard(p, 3000).catch(() => false)
        await p.waitForSelector('[data-fair-dev]', { timeout: 120000 })
        await p.click('[data-fair-tab="smash"]'); await sleep(500)
        await p.select('[data-fair-pick="you"] [data-fair-species]', 'frog'); await sleep(300)
        await p.$eval('[data-fair-pick="you"] [data-fair-level]', e => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!; set.call(e, '1'); e.dispatchEvent(new Event('input', { bubbles: true })) }); await sleep(300)
        await p.click('[data-fair-run]')
        await p.waitForSelector('[data-smash-bell-view]', { timeout: 30000 })
      }
      // 1a a normal swing
      await bench('')
      const end1 = await playOut(p, SHOTS ? `bench-${tag}-normal` : null)
      const r1 = await rec(p)
      const b1 = beatsIn(r1?.log ?? '', 0)
      ok(end1 && b1.join() === 'intro,walk,strike,gauge,score', `1a. bench: the beats play in order (${b1.join(' > ')})`)
      ok(!!r1?.shout && r1.backWalk.includes('1') && r1.backStrike.length > 0 && r1.backStrike.every((x: string) => x === '1'), `1b. the intro shouts out ("${r1?.shout}"); she walks out and strikes with her BACK to the camera (walk ${r1?.backWalk.slice(-3).join('')}, strike ${[...new Set(r1?.backStrike)].join('')})`)
      ok(Number(r1?.score) >= 100 && Number(r1?.score) < 1000 && !r1?.cracked, `1c. a fresh frog's score is in the hundreds, the bell holds (${r1?.score})`)
      await p.screenshot({ path: `${out}/bench-${tag}-normal-end.png` })
      // 1d the crafted 9001
      await bench('&smashscore=9001')
      const end2 = await playOut(p, SHOTS ? `bench-${tag}-9001` : null)
      const r2 = await rec(p)
      const b2 = beatsIn(r2?.log ?? '', 0)
      ok(end2 && b2.join() === 'intro,walk,strike,gauge,crack,score' && r2?.score === '9001', `1d. a crafted 9001: gauge -> CRACK -> score (${b2.join(' > ')}; score ${r2?.score})`)
      ok(r2?.cracked && !!r2.judge && !/over\s*nine\s*thousand/i.test(r2.judge), `1e. the bell cracks and the Moglin judge yells ("${r2?.judge}")`)
      ok(writes.length === 0, `1f. the bench wrote nothing (${writes.join(', ')})`)
      await p.close()
    }
  }

  // ── 2 + 3 · WORLD + LOBBY (test keepers) ──
  if (PART === 'all' || PART === 'world') {
    wipe()
    const net = await (await fetch(`${url}/open/wilds/network-s1.json`, { cache: 'no-store' })).json() as Network
    const smash = tentsOf(net).find(x => x.contest === 'smash')!
    const TUT = { v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: [], gifts: ['pruner', 'spike'], b2: 'none', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }
    const open = async (k: { id: string; name: string }, pot: string, seed: string): Promise<Page> => {
      const p = await (await br.createBrowserContext()).newPage(); await p.setViewport(VIEW)
      p.on('pageerror', e => errs.push(`${k.name}: ${String(e).slice(0, 200)}`))
      await p.setCookie({ name: 'ather_session', value: mintSession(k.id, k.name), domain: new URL(url).hostname, path: '/', httpOnly: true })
      await p.evaluateOnNewDocument('window.__name = (f) => f')
      await p.evaluateOnNewDocument(RECORDER)
      await p.evaluateOnNewDocument((s: any) => {
        if (sessionStorage.getItem('m246-seeded')) return
        sessionStorage.setItem('m246-seeded', '1')
        localStorage.setItem('ather:epoch', '2'); localStorage.setItem('ather:mp:party', s.chord)
        localStorage.setItem('open.tutorial.v1', JSON.stringify(s.TUT))
        localStorage.setItem('open.rinquest.v1', JSON.stringify({ v: 1, state: 'done', step: 0 }))
        for (const pre of ['', `u:${s.id}:`]) {
          localStorage.setItem(`${pre}ather:shimmer:birthRune`, 'star'); localStorage.setItem(`${pre}ather:shimmer:runes`, JSON.stringify(['star']))
          localStorage.setItem(`${pre}open.tutorial.v1`, JSON.stringify(s.TUT))
          localStorage.setItem(`${pre}ather.grimoire.v1`, JSON.stringify({ v: 1, pages: [{ species: s.sp, stage: 'seen', at: 1 }], pots: { [s.pot]: { seed: s.seed, at: 1, bloomed: true } }, met: [] }))
          localStorage.setItem(`${pre}ather.spiritParty.v1`, JSON.stringify([s.pot]))
          localStorage.setItem(`${pre}ather.spiritStats.v1`, JSON.stringify({ [s.pot]: { form: 'base', g: { pwr: 10 }, plays: 0, xp: 0, grown: 12 } }))
        }
      }, { TUT, id: k.id, pot, chord: CHORD, seed, sp: seed.replace('mana_seed_', '') } as any)
      await p.goto(`${url}/shimmer/open/ather?hour=14&clashx=${X}${BX}`, { waitUntil: 'load', timeout: 240000 })
      await p.waitForFunction(() => !!(window as any).__ather?.travel, { timeout: 180000, polling: 1000 })
      await sleep(3000)
      try { await dismissStartCard(p) } catch { for (let i = 0; i < 3; i++) { await p.keyboard.press('Escape'); await sleep(600) }; await dismissStartCard(p).catch(() => {}) }
      for (let i = 0; i < 4 && await p.evaluate(() => /Resume[\s\S]{0,40}Tooltips/.test(document.body.innerText)); i++) { await p.keyboard.press('Escape'); await sleep(600) }
      return p
    }
    const A = (p: Page, fn: string, ...a: unknown[]) => p.evaluate((f: string, x: unknown[]) => (window as any).__ather?.[f]?.(...x), fn, a)
    const look = (from: { x: number; z: number }, at: { x: number; z: number }) => Math.atan2(-(at.x - from.x), -(at.z - from.z))
    const openTent = async (p: Page) => {
      await p.keyboard.press('Escape'); await sleep(500)
      const t = smash, d = fairDoor(t), word = tentLabel(t), back = { x: t.x + Math.sin(t.yaw) * 40, z: t.z + Math.cos(t.yaw) * 40 }
      if ((await A(p, 'zone')) !== 'wilds') {
        for (let i = 0; i < 6 && !(await A(p, 'wmGoto', back.x, back.z)); i++) await sleep(2000)
        for (let k = 0; k < 40 && (await A(p, 'zone')) !== 'wilds'; k++) await sleep(1000)
        await sleep(6000)
      }
      await p.evaluate((a: any) => { const X = (window as any).__ather; X.tp(a.x, a.z, a.yaw); X.look?.(a.yaw, -0.05) }, { ...d, yaw: look(d, t) })
      let txt = ''
      for (let i = 0; i < 60 && !txt.includes(`E · the Thistledown Fair · ${word}`); i++) { await sleep(500); txt = await p.evaluate(() => document.body.innerText); if (i % 12 === 11) await p.evaluate((a: any) => (window as any).__ather.tp(a.x, a.z, a.yaw), { ...d, yaw: look(d, t) }) }
      await p.keyboard.press('KeyE')
      for (let i = 0; i < 30 && !(await p.$('[data-panel="smash"]')); i++) await sleep(500)
      return !!(await p.$('[data-panel="smash"]'))
    }
    const clickIn = async (p: Page, sel: string) => { const b = await p.$(`${sel} button`) ?? await p.$(sel); if (!b) return false; await p.evaluate(e => (e as HTMLButtonElement).click(), b); return true }

    // 2 · solo, keeper A
    const pa = await open(KA, 'vx-m246a', 'mana_seed_fox')
    const opened = await openTent(pa)
    for (let i = 0; i < 20 && !(await pa.$('[data-smash-tries="3"]')); i++) await sleep(500)
    ok(opened && !!(await pa.$('[data-smash-tries="3"]')) && !(await pa.$('[data-smash-pole]')), '2a. E at Smash: the sign-up panel, three tries, no old pole')
    await clickIn(pa, '[data-signup-enter]')
    const view = await pa.waitForSelector('[data-smash-bell-view]', { timeout: 20000 }).catch(() => null)
    const endA = view ? await playOut(pa, SHOTS ? `world-${tag}` : null, 240000) : false
    const ra = await rec(pa), ba = beatsIn(ra?.log ?? '', 0)
    ok(!!view && endA && ba.join() === 'intro,walk,strike,gauge,score', `2b. Enter -> the bell show in the ring: ${ba.join(' > ')}`)
    ok(/keeper/i.test(ra?.shout ?? '') && ra?.backStrike.length > 0 && ra.backStrike.every((x: string) => x === '1'), `2c. the shout-out to her keeper ("${ra?.shout}"); she strikes with her back to the camera`)
    ok(Number(ra?.score) >= 100 && Number(ra?.score) < 2000 && !ra?.cracked, `2d. her score: ${ra?.score}`)
    await pa.screenshot({ path: `${out}/world-${tag}-end.png` })
    await clickIn(pa, '[data-smash-exit]'); await sleep(1500)
    const st = await pa.evaluate(() => ({ hit: (document.querySelector('[data-smash-hit]') as HTMLElement | null)?.dataset.smashHit, best: (document.querySelector('[data-smash-best]') as HTMLElement | null)?.dataset.smashBest, tries: (document.querySelector('[data-smash-tries]') as HTMLElement | null)?.dataset.smashTries, rows: [...document.querySelectorAll('[data-smash-row]')].map(r => `${(r as HTMLElement).dataset.smashRow}:${(r as HTMLElement).dataset.best}`) }))
    ok(st.hit === ra?.score && st.best === ra?.score && st.tries === '2' && st.rows.includes(`${KA.name}:${ra?.score}`), `2e. back at the panel: the score is A's best, a try spent, on the board (${JSON.stringify(st)})`)
    await pa.screenshot({ path: `${out}/world-${tag}-board.png` })
    const bBoard = await (await fetch(`${url}/api/fair/smash`, { headers: { cookie: `ather_session=${mintSession(KB.id, KB.name)}` } })).json() as { top: { who: string; best: number; mine: boolean }[] }
    ok(bBoard.top.some(r => r.who === KA.name && String(r.best) === ra?.score && !r.mine), `2f. keeper B reads the one board and sees A's ${ra?.score}`)

    // 3 · lobby, A + B
    const pb = await open(KB, 'vx-m246b', 'mana_seed_owl')
    const [oa, ob] = await Promise.all([openTent(pa), openTent(pb)])
    const lob = (p: Page) => p.evaluate(() => Number((document.querySelector('[data-signup-lobby]') as HTMLElement | null)?.dataset.signupLobby ?? 0))
    let la = await lob(pa), lb = await lob(pb)
    for (let i = 0; i < 30 && (la !== 2 || lb !== 2); i++) { await sleep(500); la = await lob(pa); lb = await lob(pb) }
    ok(oa && ob && la === 2 && lb === 2, `3a. both keepers at the Smash panel see each other (${la}/${lb})`)
    await pa.evaluate(() => { (window as any).__bell.logs = []; (window as any).__bell.winner = ''; (window as any).__bell.order = '' })
    await clickIn(pb, '[data-lobby-ready]'); await sleep(1200); await clickIn(pa, '[data-lobby-ready]')
    const [va, vb] = await Promise.all([pa.waitForSelector('[data-smash-bell-view]', { timeout: 30000 }).catch(() => null), pb.waitForSelector('[data-smash-bell-view]', { timeout: 30000 }).catch(() => null)])
    const [ea, eb] = await Promise.all([playOut(pa, SHOTS ? `lobby-${tag}-a` : null, 300000), playOut(pb, null, 300000)])
    const [qa, qb] = [await rec(pa), await rec(pb)]
    await pa.screenshot({ path: `${out}/lobby-${tag}-a-end.png` }); await pb.screenshot({ path: `${out}/lobby-${tag}-b-end.png` })
    ok(!!va && !!vb && ea && eb, '3b. both keepers play the bell show to its end')
    ok(!!qa?.order && qa.order === qb?.order && qa.order.split('|').length === 2, `3c. the same order for both (${qa?.order} / ${qb?.order})`)
    ok(!!qa?.rows && qa.rows === qb?.rows && !/=(\s|$)/.test(qa.rows), `3d. the same scores for both (${qa?.rows} / ${qb?.rows})`)
    const top = qa?.rows ? Math.max(...qa.rows.split(' ').map((s: string) => Number(s.split('=')[1]))) : -1
    ok(!!qa?.winner && qa.winner === qb?.winner && Number(qa.winner.split(':')[1]) === top, `3e. the same winner, the highest (${qa?.winner} / ${qb?.winner}, top ${top})`)
    await clickIn(pa, '[data-smash-exit]'); await clickIn(pb, '[data-smash-exit]'); await sleep(1500)
    const champ = (p: Page) => p.evaluate(() => (document.querySelector('[data-smash-contest]') as HTMLElement | null)?.dataset.smashChampion ?? '')
    const [ca, cb] = [await champ(pa), await champ(pb)]
    ok(!!ca && ca === cb, `3f. back at the panel: the same contest champion (${ca} / ${cb})`)
  }
  ok(errs.length === 0, `4. no page errors (${errs.slice(0, 3).join(' | ')})`)
} finally {
  await br.close()
  if (PART !== 'bench') wipe()
}
console.log(fails.length ? `FAIL ${fails.length}` : 'PASS', `· shots ${out}`)
process.exit(fails.length ? 1 : 0)
