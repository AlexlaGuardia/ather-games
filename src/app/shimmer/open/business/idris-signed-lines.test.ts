// SIGNED LINES, WORD FOR WORD (Alex signed athernyx 7a25a8e: CANON/game/shimmer-lines-idris-and-goodbyes.md).
// Parses the canon file itself and diffs every Idris line, scene box, choice label and the five Glade goodbyes against
// the strings the game ships. Needs /root/athernyx (this box); elsewhere it says SKIP rather than passing silently.
//   npx tsx src/app/shimmer/open/business/idris-signed-lines.test.ts
import { existsSync, readFileSync } from 'node:fs'
import { IDRIS_LINES, IDRIS_SCENES, IDRIS_CHOICES, type IdrisLineId } from './idris-lines'
import { ANSWERS } from '../ather/greg-talk'
import { FRIEND_BYE } from '../ather/glade-friend-talk'
import { fennelBye } from '../ather/glade-fennel-talk'

const FILE = '/root/athernyx/CANON/game/shimmer-lines-idris-and-goodbyes.md'
if (!existsSync(FILE)) { console.log(`SKIP: ${FILE} not on this machine`); process.exit(0) }
const md = readFileSync(FILE, 'utf8')
let fails = 0, n = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log(`✗ ${m}`) } }

ok(/STATUS: SIGNED/.test(md), 'the canon file is SIGNED')
// "idris.greet.first.1  IDRIS: <line>"
const canonLine = new Map<string, string>()
for (const m of md.matchAll(/^(idris\.[a-z0-9.]+)\s+IDRIS: (.+)$/gm)) canonLine.set(m[1], m[2].trim())
ok(canonLine.size === 12, `12 Idris lines in canon (got ${canonLine.size})`)
for (const [id, text] of canonLine) ok(IDRIS_LINES[id as IdrisLineId] === text, `${id}: game "${IDRIS_LINES[id as IdrisLineId]}" vs canon "${text}"`)
for (const id of Object.keys(IDRIS_LINES)) ok(canonLine.has(id), `${id} ships but is not in the signed file`)

const scenes = [...md.matchAll(/^\[SCENE: (.+)\]$/gm)].map(m => m[1].trim())
ok(scenes.length === 2 && scenes[0] === IDRIS_SCENES.first && scenes[1] === IDRIS_SCENES.done, `scene boxes match (${scenes.join(' | ')})`)
const choices = [...md.matchAll(/^> (Pick runes|Not yet|Cut it|Wait)\s/gm)].map(m => m[1])
ok(JSON.stringify(choices) === JSON.stringify([IDRIS_CHOICES.pick, IDRIS_CHOICES.notYet, IDRIS_CHOICES.cut, IDRIS_CHOICES.wait]), `choice labels match (${choices.join(', ')})`)

const bye = new Map<string, string>()
for (const m of md.matchAll(/^bye\.([a-z]+)\s+> (.+)$/gm)) bye.set(m[1], m[2].trim())
ok(bye.size === 5, `5 goodbyes in canon (got ${bye.size})`)
ok(ANSWERS.bye === bye.get('greg'), `bye.greg: "${ANSWERS.bye}" vs "${bye.get('greg')}"`)
for (const f of ['otto', 'tess', 'bonn'] as const) ok(FRIEND_BYE[f] === bye.get(f), `bye.${f}: "${FRIEND_BYE[f]}" vs "${bye.get(f)}"`)
ok(fennelBye === bye.get('fennel'), `bye.fennel: "${fennelBye}" vs "${bye.get('fennel')}"`)

console.log(`${n - fails}/${n} signed-line asserts${fails ? ` · ${fails} FAILED` : ' · word for word'}`)
process.exit(fails ? 1 : 0)
