// One-off diagnostic: render a creature frame at the edge the build USES vs the edge its art was
// painted at, side by side. A reading taken from the generator needs a picture in the same
// coordinates before anyone acts on it (PATTERNS 2026-08-22, the bridges cross-section).
import sharp from 'sharp'
import { speciesArt } from '../src/app/shimmer/sprites/registry'

const SP = process.argv[2] ?? 'fox'
const art: any = speciesArt(SP)
if (!art) { console.error(`no art for ${SP}`); process.exit(1) }
const anim: any = art.anims['down_idle'] ?? Object.values(art.anims)[0]
const frame: Uint8Array = (anim.frames ?? anim)[0]
const pal: string[] = art.palette
const rgb = pal.map((h: string) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)])

const SCALE = 12, GAP = 16
async function tile(edge: number) {
  const buf = Buffer.alloc(edge * edge * 4)
  for (let i = 0; i < edge * edge; i++) {
    const v = frame[i] ?? 0
    const c = v ? (rgb[v - 1] ?? [255, 0, 255]) : null
    buf[i*4] = c ? c[0] : 24; buf[i*4+1] = c ? c[1] : 24; buf[i*4+2] = c ? c[2] : 32; buf[i*4+3] = 255
  }
  return sharp(buf, { raw: { width: edge, height: edge, channels: 4 } })
    .resize(edge * SCALE, edge * SCALE, { kernel: 'nearest' }).png().toBuffer()
}
const W = 32 * SCALE
const left = await tile(32)          // what ships
const right = await tile(16)         // what the art was painted at, upscaled to match height
const rightBig = await sharp(right).resize(W, W, { kernel: 'nearest' }).toBuffer()
await sharp({ create: { width: W * 2 + GAP, height: W, channels: 4, background: { r: 12, g: 12, b: 16, alpha: 1 } } })
  .composite([{ input: left, left: 0, top: 0 }, { input: rightBig, left: W + GAP, top: 0 }])
  .png().toFile(process.argv[3] ?? 'sprite-edge.png')
console.log(`${SP}: LEFT = edge 32 (what creature-atlas blits and SpriteRenderers derives) · RIGHT = edge 16 (what the art was painted at)`)
