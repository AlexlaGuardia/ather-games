// Run: npx tsx src/app/shimmer/open/ather/tools-permanent.test.ts
// BETA M133 (Alex 11-24): station tools are permanent. 500 uses leave every tier whole, a part-used one in an old save loads
// whole, and nothing in the open world counts a use, says 'wore out' or prints uses left. The gather + catch are run as the page
// wires them (the page itself is read as source: it is a React file).
import { readFileSync, readdirSync } from 'node:fs'
const mem = new Map<string, string>()
;(globalThis as unknown as { localStorage: unknown }).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) }
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
import { loadTools, saveTools, RINSTICKS, easeOf, xpOf } from './rinsticks'
import { FOCUSES, rungOf, bonusXp } from './focuses'
import { TOOL_DEFS } from '../../engine/tools'
import type { EquippedTools as T } from '../../engine/tools'

const all = [...Object.values(FOCUSES).flat(), ...RINSTICKS]
ok(all.length === 9, 'nine station tools')
for (const id of all) {
  const d = TOOL_DEFS[id], sk = d.skillId as keyof T
  // an old save: this tool, one use left (and one at none left, one with no count at all)
  for (const usesRemaining of [1, 0, undefined, Math.floor(d.durability / 2)]) {
    mem.clear(); mem.set('open.tools.v1', JSON.stringify({ [sk]: { toolId: id, usesRemaining, speedBonus: d.speedBonus, xpBonus: d.xpBonus } }))
    const t = loadTools()[sk]
    ok(t?.toolId === id && t.usesRemaining === d.durability && t.xpBonus === d.xpBonus, `${id}: an old save at ${usesRemaining} uses is not whole`)
  }
  // 500 uses: each is the work's own reads (rung / ease / xp) then a save + reload
  mem.clear(); mem.set('open.tools.v1', JSON.stringify({ [sk]: { toolId: id, usesRemaining: 1, speedBonus: d.speedBonus, xpBonus: d.xpBonus } }))
  let t: T = loadTools(); const r0 = rungOf(t[sk]), e0 = easeOf(t[sk]), x0 = xpOf(t[sk], 100), b0 = bonusXp(t[sk], 100)
  for (let n = 0; n < 500; n++) { rungOf(t[sk]); bonusXp(t[sk], 10); xpOf(t[sk], 10); saveTools(t); t = loadTools() }
  ok(t[sk]?.toolId === id && rungOf(t[sk]) === r0 && easeOf(t[sk]) === e0 && xpOf(t[sk], 100) === x0 && bonusXp(t[sk], 100) === b0, `${id}: changed over 500 uses`)
}
// a bad record is still not a tool
mem.clear(); mem.set('open.tools.v1', JSON.stringify({ forestry: { toolId: 'mana_spike', usesRemaining: 3 }, prospecting: { toolId: 'nope', usesRemaining: 3 } }))
ok(loadTools().forestry?.toolId !== 'mana_spike' && (loadTools().prospecting?.toolId as string) !== 'nope', 'a tool in the wrong slot, or an unknown one, was kept')

// the source: nothing in the open world counts, breaks or prints a use
const walk = (d: URL): URL[] => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(new URL(`${e.name}/`, d)) : /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [new URL(e.name, d)] : [])
const files = walk(new URL('../', import.meta.url))
ok(files.length > 100, 'the sweep reads the open world')
for (const f of files) {
  const code = readFileSync(f, 'utf8').split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n').replace(/\/\/ [^\n]*|\/\*.*?\*\//g, ''), at = f.pathname.split('/open/')[1]
  for (const bad of [/\bwearFocus\b/, /\bwearRinstick\b/, /\buseTool\(/, /usesRemaining\s*(-|--)/, /--\s*\w+\.usesRemaining/, /wore out/, /(uses|catches) left/, /Use it up first/, /durability\} (uses|catches)/, /never wears out/, /worn one is back/])
    ok(!bad.test(code), `${at} still has ${bad}`)
}
if (fails.length) { console.error(`tools-permanent: ${pass} pass, ${fails.length} FAIL\n  ` + fails.slice(0, 20).join('\n  ')); process.exit(1) }
console.log(`tools-permanent: ${pass} pass, 0 fail`)
