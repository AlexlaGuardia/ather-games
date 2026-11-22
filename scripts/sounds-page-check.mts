// BETA M92: the sounds page declutter, on the real page with the owner cookie. Pending on top, Nay rows Try again / Remove,
// Approved collapsed at the bottom with Un-approve; every move survives a reload (it is written to sounds.json via the route).
// ⚠ IT WRITES THE REAL sounds.json (the route writes the file the server runs from), so it snapshots the file first and puts it
// back byte-for-byte at the end, then asserts the bytes match (not git: Alex's own votes may sit uncommitted in it). Run it on THIS box (needs OWNER_KEY + the file):
//   set -a; . ./.env; set +a; npx tsx scripts/sounds-page-check.mts [--url https://ather.games]
import puppeteer from 'puppeteer-core'
import { readFileSync, writeFileSync } from 'fs'

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const URL0 = flag('--url', 'https://ather.games'), FILE = 'src/app/shimmer/open/shared/sounds.json'
const KEY = process.env.OWNER_KEY
if (!KEY) { console.error('OWNER_KEY not set: set -a; . ./.env; set +a'); process.exit(2) }
const snap = readFileSync(FILE)
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
type Row = { id: string; status: string }
const disk = (): Row[] => JSON.parse(readFileSync(FILE, 'utf-8'))

const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
try {
  const p = await browser.newPage(); await p.setViewport({ width: 390, height: 844 })
  await p.goto(`${URL0}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'networkidle2', timeout: 30_000 })
  const load = async () => { await p.goto(`${URL0}/shimmer/dev/sounds`, { waitUntil: 'networkidle2', timeout: 30_000 }); await sleep(800) }
  const where = (id: string) => p.evaluate((i: string) => document.querySelector(`[data-sound="${i}"]`)?.closest('[data-section]')?.getAttribute('data-section') ?? null, id)
  const count = (s: string) => p.evaluate((x: string) => Number(document.querySelector(`[data-section="${x}"] [data-count]`)?.textContent), s)
  const click = (id: string, btn: string) => p.evaluate((i: string, b: string) => { (document.querySelector(`[data-sound="${i}"] [data-${b}]`) as HTMLButtonElement)?.click() }, id, btn)
  await load()
  const rows = disk(), n = (st: string) => rows.filter(r => r.status === st).length
  ok(await count('pending') === n('proposed') && await count('nay') === n('nay') && await count('approved') === n('yay'), `section counts match the file (pending ${n('proposed')} · nay ${n('nay')} · approved ${n('yay')})`)
  const order = await p.evaluate(() => [...document.querySelectorAll('[data-section]')].map(e => e.getAttribute('data-section')).join())
  ok(order === 'pending,nay,approved', `pending on top, approved at the bottom (${order})`)
  ok(await p.evaluate(() => !(document.querySelector('[data-section="approved"]') as HTMLDetailsElement).open), 'approved starts collapsed')
  const nays = rows.filter(r => r.status === 'nay').map(r => r.id), yays = rows.filter(r => r.status === 'yay').map(r => r.id)
  // TRY AGAIN: nay -> pending, survives a reload; then NAY it back
  const x = nays[0]
  await click(x, 'retry'); await sleep(800)
  ok(await where(x) === 'pending', `Try again moves ${x} to pending`)
  await load(); ok(await where(x) === 'pending' && disk().find(r => r.id === x)?.status === 'proposed', `${x} still pending after reload (file: proposed)`)
  await click(x, 'nay'); await sleep(800); ok(await where(x) === 'nay', `NAY sends ${x} back to nay`)
  // UN-APPROVE then YAY: yay -> pending -> approved
  const y = yays[0]
  await p.evaluate(() => { (document.querySelector('[data-section="approved"]') as HTMLDetailsElement).open = true })
  await click(y, 'unapprove'); await sleep(800); ok(await where(y) === 'pending', `Un-approve moves ${y} to pending`)
  await click(y, 'yay'); await sleep(800); ok(await where(y) === 'approved', `YAY moves ${y} to approved`)
  await load(); ok(await where(y) === 'approved', `${y} still approved after reload`)
  // the route refuses to remove a yay row
  const refused = await p.evaluate((i: string) => fetch('/shimmer/save-sound-vote', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: i }) }).then(r => r.status), y)
  ok(refused === 400 && disk().some(r => r.id === y), `DELETE on a yay row is refused (${refused})`)
  // REMOVE: the nay row leaves the file and the page, and stays gone after a reload
  const z = nays[nays.length - 1]
  await click(z, 'remove'); await sleep(800)
  ok(await where(z) === null && !disk().some(r => r.id === z) && disk().length === rows.length - 1, `Remove drops ${z} from the page and sounds.json`)
  await load(); ok(await where(z) === null, `${z} still gone after reload`)
} finally {
  await browser.close()
  writeFileSync(FILE, snap)
  ok(readFileSync(FILE).equals(snap), 'sounds.json restored byte-for-byte to its state before the run')
}
console.log(fails ? `FAIL: ${fails} assert(s) red` : 'PASS: M92 sounds page: pending top, nay Try again/Remove, approved collapsed + Un-approve, all survive reload; file restored')
process.exit(fails ? 1 : 0)
