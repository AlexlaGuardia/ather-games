// ── #682 SAVE-ISOLATION REPRO ────────────────────────────────────────────────────────────────
// Drives the REAL /shimmer/play3d page in a real browser against an ISOLATED dev server
// (:3205, own data/accounts.db). Nothing here re-implements hydrate, the save key, or the
// push — a mirror of the code under test would prove nothing about the code under test.
//
// Two claims, measured SEPARATELY because they are different events:
//   C1 (confusion): with A's save in localStorage, signing in as B leaves B playing A's world.
//   C2 (data loss): a CHANGED save under B's session uploads A's world into B's cloud row.
// C2 needs the save to actually change — flushPersist early-returns when json is unchanged.
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'

const TOKENS = process.env.REPRO_TOKENS ?? '/tmp/ather-repro-tokens.json'
const S = process.env.REPRO_OUT ?? '/tmp'
const tok = JSON.parse(readFileSync(TOKENS, 'utf8'))
const ORIGIN = process.env.REPRO_ORIGIN ?? 'http://localhost:3205'
const PLAY = `${ORIGIN}/shimmer/play3d`

// ⚠⚠ NEVER AGAINST PRODUCTION. This rig SEEDS ACCOUNTS AND OVERWRITES CLOUD SAVES to prove a
// data-loss bug. Pointed at :3200 it would write test accounts into the live accounts.db and
// could destroy a real garden — the exact thing it exists to prevent. It refuses rather than
// trusting whoever runs it to have read this comment.
if (ORIGIN.includes(':3200') || /ather\.games/.test(ORIGIN)) {
  console.error('REFUSING: :3200 / ather.games is PRODUCTION. Run this against an isolated dev server with its own data/accounts.db.')
  process.exit(2)
}

const SETTLE = Number(process.env.SETTLE ?? 25)
const SAVE_KEY = 'ather:save:shimmer'   // the ANON slot; per-account slots suffix it

let OWNER_KEY = ''
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const m = /^OWNER_KEY=(.*)$/.exec(line.trim())
  if (m) OWNER_KEY = m[1].replace(/^["']|["']$/g, '')
}

const out: Record<string, unknown> = {}
const log = (...a: unknown[]) => console.log(...a)

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle',
         '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,760'],
})

const setSession = async (page: any, jwt: string) => {
  await browser.deleteCookie({ name: 'ather_session', domain: 'localhost' } as any).catch(() => {})
  await page.setCookie({ name: 'ather_session', value: jwt, domain: 'localhost', path: '/' })
}

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 760 })
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))

  // Born, epoch current — so the game MOUNTS instead of showing the birth ritual. Real rune id.
  // Deliberately does NOT seed the save: the save must arrive through hydrateFromCloud itself.
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('ather:epoch', '2')
    localStorage.setItem('ather:shimmer:birthRune', 'barrier')
    localStorage.setItem('ather:shimmer:runes', JSON.stringify(['barrier']))
  })

  // ── STEP 1 — A plays on a blank device ────────────────────────────────────────────────────
  await setSession(page, tok.A.cookie)
  if (OWNER_KEY) await page.goto(`${ORIGIN}/owner?key=${encodeURIComponent(OWNER_KEY)}`, { waitUntil: 'networkidle2', timeout: 30_000 })
  await page.goto(PLAY, { waitUntil: 'networkidle2', timeout: 60_000 })
  await new Promise(r => setTimeout(r, SETTLE * 1000))

  out.step1_session = await page.evaluate(() => fetch('/api/auth/session', { cache: 'no-store' }).then(r => r.json()).then(d => d.session?.user_id ?? null))
  const slots = () => page.evaluate((pre: string) => Object.fromEntries(
    Object.keys(localStorage).filter(k => k.startsWith(pre))
      .map(k => [k, (localStorage.getItem(k) ?? '').slice(0, 60)])), SAVE_KEY)
  out.step1_slots = await slots()
  log(`STEP 1 (cookie A): session=${out.step1_session}`); console.log('  slots:', out.step1_slots)

  // ── STEP 2 — sign in as B in the SAME browser (same profile, same localStorage) ────────────
  await setSession(page, tok.B.cookie)
  await page.goto(PLAY, { waitUntil: 'networkidle2', timeout: 60_000 })
  await new Promise(r => setTimeout(r, SETTLE * 1000))

  out.step2_session = await page.evaluate(() => fetch('/api/auth/session', { cache: 'no-store' }).then(r => r.json()).then(d => d.session?.user_id ?? null))
  out.step2_slots = await slots()
  out.step2_cloud_B = await page.evaluate(() => fetch('/api/saves?game=shimmer', { cache: 'no-store' }).then(r => r.json()).then(d => d.save?.data ?? null))
  log(`STEP 2 (cookie B): session=${out.step2_session}`)
  console.log('  slots:', out.step2_slots)
  log(`  B's cloud row -> ${String(out.step2_cloud_B).slice(0, 90)}`)
  await page.screenshot({ path: `${S}/step2-B-sees.png` })

  // ── STEP 3 — make the save CHANGE under B's session, then let the push fire ────────────────
  // This is the step that separates "B looked at A's world" from "B overwrote their garden".
  const NOMOVE = process.env.NOMOVE === '1'
  if (!NOMOVE) {
  await page.keyboard.press('KeyT'); await new Promise(r => setTimeout(r, 400))
  await page.keyboard.type('/tp 40 40'); await page.keyboard.press('Enter')
  await new Promise(r => setTimeout(r, 400)); await page.keyboard.press('Escape')
  await new Promise(r => setTimeout(r, SETTLE * 1000))
  // Walk too, in case tp alone does not dirty the blob.
  for (const k of ['KeyW', 'KeyD'] as const) {
    await page.keyboard.down(k); await new Promise(r => setTimeout(r, 1200)); await page.keyboard.up(k)
  }
  } else { await new Promise(r => setTimeout(r, 20_000)) }  // idle only: no key, no mouse, nothing
  // Push is debounced 8s; pagehide flushes it via sendBeacon. Wait past the debounce, then flush.
  await new Promise(r => setTimeout(r, 12_000))
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
  await new Promise(r => setTimeout(r, 3_000))

  out.step3_slots = await slots()
  out.errors = errors.slice(0, 5)
  console.log('STEP 3 slots:', out.step3_slots)
} finally {
  await browser.close()
}
console.log('\n===JSON===\n' + JSON.stringify(out, null, 1))
