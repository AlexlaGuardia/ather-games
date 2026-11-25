// BETA M155 s2: Morel's node hints + the caption. npx tsx src/app/shimmer/open/shared/morel-nodes.test.ts
import { readFileSync } from 'node:fs'
import { COOL, MAX_HINTS } from './morel'
import { MOREL_INTRO, MOREL_NODE_HINT } from './morel-lines'
import { newNodeHintWatch, nodeHint, nodeHintDue, regrowWords, type NodeTry } from './morel-nodes'
const mem = new Map<string, string>()
;(globalThis as Record<string, unknown>).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v) }, removeItem: (k: string) => { mem.delete(k) } }
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.error('✗ ' + m) } }
async function main() {
// the signed Mains, off the canon file
const src = readFileSync('/root/athernyx/CANON/game/shimmer-lines-batch-2026-11-25a.md', 'utf8').split('\n')
const main = (id: string) => /^\*\*(.+)\*\*$/.exec(src.find(l => l.startsWith(`| \`${id}\``))?.split('|').map(x => x.trim())[3] ?? '')?.[1]
for (const [k, v] of Object.entries(MOREL_NODE_HINT)) ok(main(`MOREL_HINT.${k}`) === v, `MOREL_HINT.${k} is the signed Main (${main(`MOREL_HINT.${k}`)})`)
ok(Object.keys(MOREL_NODE_HINT).length === 3 && main('MOREL_INTRO.caption') === MOREL_INTRO.caption, 'the caption is the signed line')
// which
const T: NodeTry = { firstSteps: true, tutorial: true, tool: true, regrowMs: 0, need: 1, rung: 1 }
ok(nodeHint(T) === null, 'a node you can work: nothing'); ok(nodeHint({ ...T, tool: false }) === 'tool_missing', 'no tool'); ok(nodeHint({ ...T, regrowMs: 5 }) === 'regrowing', 'not grown back')
ok(nodeHint({ ...T, need: 2 }) === 'too_tough' && nodeHint({ ...T, need: 2, rung: 2 }) === null && nodeHint({ ...T, rung: 3 }) === null, 'too tough = past the tool in hand')
ok(nodeHint({ ...T, tool: false, need: 3, regrowMs: 9 }) === 'tool_missing' && nodeHint({ ...T, need: 3, regrowMs: 9 }) === 'regrowing', 'one at a time, the first true thing')
ok(nodeHint({ ...T, tutorial: false, tool: false }) === null && nodeHint({ ...T, tutorial: false, regrowMs: 9 }) === null && nodeHint({ ...T, tutorial: false, need: 2 }) === 'too_tough', 'the Wilds\' nodes: only the warning')
for (const o of [{ tool: false }, { regrowMs: 9 }, { need: 3 }]) ok(nodeHint({ ...T, ...o, firstSteps: false }) === null, 'past First Steps: never')
// when
const w = newNodeHintWatch()
ok(nodeHintDue(w, 'too_tough', 0, false) && !nodeHintDue(w, 'too_tough', 5, false), 'said, then quiet'); ok(!nodeHintDue(w, 'regrowing', 6, true) && nodeHintDue(w, 'regrowing', 7, false), 'never over another line; a different one may follow')
ok(!nodeHintDue(w, 'too_tough', COOL - 1, false) && nodeHintDue(w, 'too_tough', COOL, false), 'again after the errand hints\' own cooldown'); ok(MAX_HINTS === 2 && !nodeHintDue(w, 'too_tough', COOL * 9, false), 'twice at most')
ok(nodeHintDue(w, 'tool_missing', 0, false, 20) && nodeHintDue(w, 'tool_missing', COOL / 20, false, 20), 'the checks\' fast clock')
// {REGROW}
const H = 3_600_000
ok(regrowWords(24 * H) === 'a day' && regrowWords(23.5 * H) === 'a day' && regrowWords(5 * H) === 'a few hours' && regrowWords(H) === 'an hour' && regrowWords(48 * H) === 'a couple of days' && regrowWords(1) === 'a moment', 'plain words')
let last = -1; const seen: string[] = []
for (let m = 0; m < 200 * 60; m++) { const s = regrowWords(m * 60_000); if (/\d/.test(s)) fail++; if (s !== seen[last]) { ok(!seen.includes(s), `${s}: one stretch`); seen.push(s); last++ } }
ok(seen.length === 9, `nine stretches (${seen.length})`)
// the caption, through the real message line
const say = await import('./hud-say'), tut = await import('../ather/glade-tutorial'); const { morelIntro } = await import('./morel-intro')
const up = () => say.linesAt().map(l => `${l.kind}:${l.text}`), save = (t: unknown) => { tut.saveTut(t as never) }
say._resetSay(); say.hudSay('x', 'morel'); ok(up().join() === 'morel:x', 'no save yet: none')
save(tut.legacyTut()); say.hudSay('a', 'morel'); save({ ...tut.freshTut(), fs: 'done' }); say.hudSay('b', 'morel'); save({ ...tut.freshTut(), folded: true }); say.hudSay('c', 'morel')
ok(!up().some(l => l.startsWith('caption')), 'an old save, a finished keeper, a keeper with a garden: none')
save(tut.freshTut()); say._resetSay(); say.hudSay('hm', 'info'); ok(up().length === 1, 'only a Morel line brings it')
say.hudSay('first', 'morel'); ok(up().join('|') === `info:hm|caption:${MOREL_INTRO.caption}|morel:first`, `before the first (${up().join('|')})`)
ok(say.linesAt().find(l => l.kind === 'morel')!.ttl === say.TTL.caption, 'the line stays while it is read')
say._resetSay(); say.hudSay('second', 'morel'); ok(up().join() === 'morel:second' && say.linesAt()[0].ttl === say.TTL.morel, 'once')
ok([...mem].some(([k, v]) => k.endsWith('open.morelintro.v1') && v === '1') && !morelIntro(true), 'kept over a reload')
console.log(`morel-nodes: ${pass} pass, ${fail} fail`); if (fail) process.exit(1)
}
void main()
