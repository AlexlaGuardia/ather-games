// ── Screenshot an owner-gated page on a lane's own dev server ──────────────────────────────────
// Run: npx tsx scripts/page-shot.mts <path> [out.png] [--port 3202] [--wait 2500]
//
// `world-shot.mts` drives the 3D world and knows about draw counts settling. This is the flat
// version for a DOM page — the dev editors and /shimmer/dev/* looking-glasses, which are exactly
// the surfaces where "green in tsc, green in the runtime guard, wrong on screen" keeps happening.
//
// ⚠ IT VISITS /owner FIRST. `proxy.ts` 403s all of /shimmer/dev/*, so a shot taken without the
// cookie is a picture of an error page — and at a glance that is indistinguishable from a page
// that rendered nothing. It fails loudly on a non-200 rather than shooting whatever came back.
//
// ⚠ AND IT WAITS FOR THE IMAGES. A CSS background-image is fetched AFTER the document settles, so
// `networkidle2` alone can photograph a grid of empty frames — which is precisely what an absent
// portrait looks like. Pass --wait for slower grids.

import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const flag = (n: string, d: string) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1] }
const path = args.find(a => a.startsWith('/')) ?? '/'
const out = args.find(a => a.endsWith('.png')) ?? 'page-shot.png'
const port = flag('--port', '3202')
const wait = Number(flag('--wait', '2500'))

const key = /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim()
if (!key) { console.error('no OWNER_KEY in .env — an owner-gated page would shoot a 403'); process.exit(1) }

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
await page.setViewport({ width: Number(flag('--width', '1500')), height: Number(flag('--height', '1000')) })
// ⚠ `domcontentloaded`, NEVER `networkidle2`, ON THIS HOP — /owner answers 307 with the cookie in
// the response headers and a `location` of **https://ather.games/room**, an absolute PRODUCTION
// url. On a lane dev server that walks the browser straight off localhost onto the live site, which
// never idles, so the shot died in a 30s navigation timeout before reaching the page it was asked
// for — an owner-gate failure wearing the costume of a slow page. The cookie is already set by the
// time the redirect is received; nothing here needs the destination to finish loading.
// (world lane, 2026-08-27.)
await page.goto(`http://localhost:${port}/owner?key=${key}`, { waitUntil: 'domcontentloaded' })
// ⚠ `load` + the explicit `--wait`, NOT `networkidle2` — AND THE TOOL COULD NOT DO THE JOB ITS OWN
// HEADER DESCRIBES UNTIL THIS CHANGED. A Next DEV server holds an HMR websocket open forever, so
// the idle condition never fires and every shot against a lane dev server died in a navigation
// timeout, while the same call against the built prod server (no HMR socket) worked fine. So the
// one surface this script exists for — `tools/devwin.sh <lane>` previews of /shimmer/dev/* — was
// the one it could not photograph. `--wait` is what actually covers the settling the header is
// worried about; idle never was, on this server. (world lane, 2026-08-27.)
const res = await page.goto(`http://localhost:${port}${path}`, { waitUntil: 'load' })
if (!res || res.status() !== 200) {
  console.error(`✗ ${path} answered ${res?.status()} — refusing to photograph it (403 = the owner gate, and a shot of it looks like an empty page)`)
  await browser.close(); process.exit(1)
}
await new Promise(r => setTimeout(r, wait))
await page.screenshot({ path: out })
console.log(`shot ${path} → ${out}`)
await browser.close()
