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
await page.goto(`http://localhost:${port}/owner?key=${key}`, { waitUntil: 'networkidle2' })
const res = await page.goto(`http://localhost:${port}${path}`, { waitUntil: 'networkidle2' })
if (!res || res.status() !== 200) {
  console.error(`✗ ${path} answered ${res?.status()} — refusing to photograph it (403 = the owner gate, and a shot of it looks like an empty page)`)
  await browser.close(); process.exit(1)
}
await new Promise(r => setTimeout(r, wait))
await page.screenshot({ path: out })
console.log(`shot ${path} → ${out}`)
await browser.close()
