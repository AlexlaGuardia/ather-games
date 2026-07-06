// MANA'NANA ather-surge power — run: npx tsx src/app/manana/lib/match3.ather.test.ts
import { W, H, idx, gem, puffCell, collarCell, atherSurge, isSpecial, isPuff, isCollared, type Cell } from './match3'

let seed = 555111
const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
let ok = 0, bad = 0
const chk = (n: string, c: boolean, x = '') => { c ? ok++ : (bad++, console.error('  FAIL:', n, x)) }

const filler = (): Cell[] => Array.from({ length: W * H }, (_, i) => gem((((i % W) + 2 * Math.floor(i / W)) % 6)))
const countSpecials = (b: Cell[]) => b.filter(isSpecial).length

// forges exactly n specials from plain orbs
{
  const b = filler()
  const out = atherSurge(b, rng, 3)
  chk('forges 3 specials', countSpecials(out) === 3, `got ${countSpecials(out)}`)
  chk('forged orbs keep a real colour', out.filter(isSpecial).every((c) => c.color >= 0))
}

// never overwrites puffs, collars, or existing specials
{
  const b = filler()
  b[idx(0, 0)] = puffCell()
  b[idx(1, 0)] = collarCell(2)
  b[idx(2, 0)] = { color: 3, kind: 'prism' }
  const out = atherSurge(b, rng, 5)
  chk('puff untouched', isPuff(out[idx(0, 0)]))
  chk('collar untouched', isCollared(out[idx(1, 0)]))
  chk('existing prism untouched', out[idx(2, 0)].kind === 'prism')
  chk('added exactly 5 NEW specials (prism was already there)', countSpecials(out) === 6, `got ${countSpecials(out)}`)
}

// caps at available candidates (never loops forever on a full/blocked board)
{
  const b = Array.from({ length: W * H }, () => puffCell()) // no plain orbs at all
  const out = atherSurge(b, rng, 4)
  chk('no candidates → forges nothing, returns', countSpecials(out) === 0)
}

console.log(`\nather: ${ok} passed, ${bad} failed`)
if (bad) process.exit(1)
