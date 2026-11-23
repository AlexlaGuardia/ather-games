// SIGNED LINES, WORD FOR WORD (BETA M109): the party spirit's E talk (§1a generic five + §1b per-species pairs), the 4th-follow
// refusal (§2 Main) and the feed lines (§3a + §3b Main) from athernyx CANON/game/party-spirit-lines-script.md. Parses the canon
// file and diffs it against party-spirit-lines.ts; the alts (and the optional §2 species tints) must not ship.
// Needs /root/athernyx; elsewhere it says SKIP.   npx tsx src/app/shimmer/open/ather/party-spirit-lines.test.ts
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SPECIES_NAMES, type Species } from '../../spirits/spirit'
import { TALK_GENERIC, TALK_SPECIES, FOLLOW_REFUSE, FEED_NONE, FEED_DONE, talkLine, talkPool, fedLine, followRefuseLine } from './party-spirit-lines'

const SCRIPT = '/root/athernyx/CANON/game/party-spirit-lines-script.md'
if (!existsSync(SCRIPT)) { console.log('SKIP: athernyx canon not on this machine'); process.exit(0) }
let fails = 0, n = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log(`✗ ${m}`) } }
const doc = readFileSync(SCRIPT, 'utf8')
const sec = (from: string, to: string) => { const a = doc.indexOf(from), b = doc.indexOf(to, a + 1); return a < 0 ? '' : doc.slice(a, b < 0 ? undefined : b) }
const ticks = (s: string) => [...s.matchAll(/`([^`]+)`/g)].map(m => m[1])
/** the backticked line right after a "**Main...:**" / "**Alt X:**" label in a section */
const labelled = (s: string, label: RegExp) => { const m = s.match(new RegExp(`^\\*\\*${label.source}[^\\n]*\\*\\*\\s*\\n\`([^\`]+)\``, 'm')); return m?.[1] }

ok(/SIGNED 2026-11-23 by Alex[^\n]*MAIN ships everywhere, per-species E lines KEPT/.test(doc), 'talk + follow script is SIGNED (MAIN, per-species kept)')
ok(/## 3\. Feeding \(✅ SIGNED 2026-11-23, Main\)/.test(doc), 'feeding section is SIGNED (Main)')

// §1a: the numbered generic five
const g = [...sec('### 1a.', '### 1b.').matchAll(/^\d+\. `([^`]+)`$/gm)].map(m => m[1])
ok(g.length === 5 && g.length === TALK_GENERIC.length, `generic lines: canon ${g.length} vs game ${TALK_GENERIC.length}`)
g.forEach((l, k) => ok(TALK_GENERIC[k] === l, `generic ${k + 1}: game "${TALK_GENERIC[k]}" vs canon "${l}"`))

// §1b: "- **Species** (...): `a` · `b`"
const pairs = new Map<string, string[]>()
for (const m of sec('### 1b.', '## 2.').matchAll(/^- \*\*(\w+)\*\*[^:]*: (.+)$/gm)) pairs.set(m[1], ticks(m[2]))
ok(pairs.size === 10 && Object.keys(TALK_SPECIES).length === 10, `species pairs: canon ${pairs.size} vs game ${Object.keys(TALK_SPECIES).length}`)
for (const [sp, ls] of pairs) {
  ok(ls.length === 2, `${sp}: two canon lines (got ${ls.length})`)
  ok(JSON.stringify(TALK_SPECIES[sp]) === JSON.stringify(ls), `${sp}: game ${JSON.stringify(TALK_SPECIES[sp])} vs canon ${JSON.stringify(ls)}`)
}
// every species in the build draws from its own pair under its canon name
for (const sp of Object.keys(SPECIES_NAMES) as Species[]) {
  const nm = SPECIES_NAMES[sp], pool = talkPool(sp)
  ok(pairs.has(nm) && pool.length === 7 && pool.includes(pairs.get(nm)![0]) && pool.includes(pairs.get(nm)![1]), `${sp} (${nm}) draws generic 5 + its pair`)
  const seen = new Set<string>(); for (let i = 0; i < 7; i++) seen.add(talkLine(sp, (i + 0.5) / 7))
  ok(seen.size === 7 && [...seen].every(l => l.includes(nm) && !l.includes('{')), `${nm}: all 7 lines reachable, {name} filled`)
}

// §2: the Main refusal ships; Alt A / Alt B and the optional species tints do not
const s2 = sec('## 2.', '## Flags')
const main2 = labelled(s2, /Main \(generic\):/), alts2 = [labelled(s2, /Alt A:/), labelled(s2, /Alt B:/)], tints = ticks(s2.slice(s2.indexOf('Species tint')).split('\n')[0])
ok(!!main2 && FOLLOW_REFUSE === main2, `follow refusal: game "${FOLLOW_REFUSE}" vs canon "${main2}"`)
ok(alts2.every(Boolean) && tints.length === 2, `§2 alts + tints parsed (${alts2.filter(Boolean).length} + ${tints.length})`)
ok(followRefuseLine('fox') === main2!.replace('{name}', 'Vulnyx'), 'the refusal names her')

// §3a / §3b: Main ships, alts do not
const s3a = sec('### 3a.', '### 3b.'), s3b = sec('### 3b.', '### Flags (section 3)')
const none = labelled(s3a, /Main:/), done = labelled(s3b, /Main:/)
ok(!!none && FEED_NONE === none, `feed none: game "${FEED_NONE}" vs canon "${none}"`)
ok(!!done && FEED_DONE === done, `fed note: game "${FEED_DONE}" vs canon "${done}"`)
ok(fedLine('fox', 'Glowfin') === 'Vulnyx enjoys the Glowfin.', `fed note filled: "${fedLine('fox', 'Glowfin')}"`)
const alts3 = [s3a, s3b].flatMap(s => [labelled(s, /Alt A:/), labelled(s, /Alt B:/)])
ok(alts3.length === 4 && alts3.every(Boolean), `§3 alts parsed (${alts3.filter(Boolean).length})`)

// no alt ships anywhere in the data file, and the talk UI takes its words from it (no stray inline copies)
const data = readFileSync(join(__dirname, 'party-spirit-lines.ts'), 'utf8'), talk = readFileSync(join(__dirname, 'spirit-talk.tsx'), 'utf8')
for (const a of [...alts2, ...tints, ...alts3]) ok(!!a && !data.includes(a) && !talk.includes(a), `alt does not ship: "${a}"`)
ok(/from '\.\/party-spirit-lines'/.test(talk) && !/FOLLOW_FULL_LINE|FEED_NONE_LINE|TODO @lark/.test(talk), 'spirit-talk.tsx speaks the signed lines (no placeholders left)')

console.log(`${n - fails}/${n} signed-line asserts${fails ? ` · ${fails} FAILED` : ' · word for word'}`)
process.exit(fails ? 1 : 0)
