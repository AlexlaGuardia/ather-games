// Close shots of Rune Hold storefronts on the continent (signs, doors): npx tsx scripts/front-shot.mts <front ids…> (URL=, HOUR=). Writes /tmp/front-<id>.png
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { planTown } from '../src/app/shimmer/open/towns/plan'
const meta = JSON.parse(readFileSync('public/open/continent.json','utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength/2))
const i = meta.places.findIndex(p=>p.id==='rune-hold'); const pl = planTown(R, meta.places[i], i)
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
const p = await b.newPage(); await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune','star')); await p.setViewport({width:1280,height:720})
await p.goto(`${process.env.URL ?? 'http://localhost:3203'}/shimmer/open/continent?hour=${process.env.HOUR ?? 18}`, { waitUntil:'load', timeout:240000 })
await p.waitForFunction(() => !!(window as any).__drive?.state, { timeout: 240000 }); await wait(2000); await p.keyboard.press('KeyX')
const sq = meta.network!.junctions.find(j=>j.kind==='square'&&j.place==='rune-hold')!
await p.evaluate((x,z)=>(window as any).__drive.tp(x,z,0,0), sq.x, sq.z); await wait(15000)
for (const id of process.argv.slice(2)) { const bb = pl.buildings.find(q=>q.front===id); if (!bb) { console.log('none', id); continue }
  const fx=Math.cos(bb.yaw), fz=Math.sin(bb.yaw), d = bb.d/2 + 14
  const cx = bb.x + fx*d, cz = bb.z + fz*d, cy = Math.max(R.heightAt(cx,cz), bb.y1) + 2.2
  await p.evaluate(q=>(window as any).__drive.shot(q), [cx, cy, cz, bb.x, bb.y1 + 3, bb.z]); await wait(5000)
  await p.screenshot({ path: `/tmp/front-${id}.png` }); console.log('shot', id) }
await b.close()
