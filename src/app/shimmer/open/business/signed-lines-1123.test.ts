// SIGNED LINES, WORD FOR WORD (Alex, 2026-11-23): the Enchant Temple door exchange (athernyx 491f462,
// shimmer-lines-idris-and-goodbyes.md Part 3, Main) and the placeholder batch items 1-3 (athernyx ef704e7,
// shimmer-lines-placeholders-2026-11-23.md, the 'new' column). Parses the canon files and diffs against what the game ships.
// Item 4 of the batch is SUPERSEDED by Part 3 and must NOT ship. Needs /root/athernyx; elsewhere it says SKIP.
//   npx tsx src/app/shimmer/open/business/signed-lines-1123.test.ts
import { existsSync, readFileSync } from 'node:fs'
import { DOOR_ASK, DOOR_REPLY } from '../continent/door-talk'
import { IDLE_LINES } from '../ather/moglins-idle'
import { FOLK_NO_ROOM } from '../ather/folk-talk'
import { FENNEL_THANKS, FENNEL_MORE } from '../ather/glade-fennel-talk'

const DOOR = '/root/athernyx/CANON/game/shimmer-lines-idris-and-goodbyes.md'
const BATCH = '/root/athernyx/CANON/game/shimmer-lines-placeholders-2026-11-23.md'
if (!existsSync(DOOR) || !existsSync(BATCH)) { console.log('SKIP: athernyx canon not on this machine'); process.exit(0) }
let fails = 0, n = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log(`✗ ${m}`) } }

// (A) Part 3, Main: "door.idris.ask       > Is Idris in?" / "door.idris.reply     IDONY: ..."
const door = readFileSync(DOOR, 'utf8')
ok(/## Part 3: Enchant Temple door[^\n]*SIGNED/.test(door), 'Part 3 is SIGNED')
const ask = door.match(/^door\.idris\.ask\s+> (.+)$/m)?.[1].trim(), reply = door.match(/^door\.idris\.reply\s+IDONY: (.+)$/m)?.[1].trim()
ok(!!ask && DOOR_ASK.idris === ask, `door.idris.ask: game "${DOOR_ASK.idris}" vs canon "${ask}"`)
ok(!!reply && DOOR_REPLY.idris === reply, `door.idris.reply: game "${DOOR_REPLY.idris}" vs canon "${reply}"`)

// (B) the batch: table rows "| `key` | who | current | new |", the 'new' column, "*(kept...)*" stripped
const batch = readFileSync(BATCH, 'utf8')
ok(/STATUS: items 1-3 SIGNED/.test(batch), 'batch items 1-3 are SIGNED')
const row = new Map<string, string>()
for (const m of batch.matchAll(/^\| `([A-Za-z_.]+)` \|[^|]*\|[^|]*\| (.+?) \|$/gm)) row.set(m[1], m[2].replace(/\s*\*\([^)]*\)\*\s*$/, '').trim())
const strip = (s: string | undefined) => s?.replace(/^`|`$/g, '')
const NAME = 'Ash'
const game: Record<string, string> = {
  hello: IDLE_LINES.hello(NAME), askHome: IDLE_LINES.askHome, confirm: IDLE_LINES.confirm, yes: IDLE_LINES.yes, no: IDLE_LINES.no,
  bye: IDLE_LINES.bye, gone: IDLE_LINES.gone(NAME), FOLK_NO_ROOM, FENNEL_THANKS, FENNEL_MORE,
}
for (const [k, g] of Object.entries(game)) {
  const c = strip(row.get(k))?.replace('${name}', NAME)
  ok(c !== undefined && g === c, `${k}: game "${g}" vs canon "${c}"`)
}
ok(row.size === 11, `11 batch rows parsed (got ${row.size})`)
ok(/SUPERSEDED/.test(batch) && DOOR_ASK.idris !== strip(row.get('DOOR_ASK.idris')), 'item 4 (superseded) does not ship')

console.log(`${n - fails}/${n} signed-line asserts${fails ? ` · ${fails} FAILED` : ' · word for word'}`)
process.exit(fails ? 1 : 0)
