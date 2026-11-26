// M184 s1: the tool dial's stage + ring. Run: npx tsx src/app/shimmer/ui/tool-stage.test.ts
import { readFileSync } from 'fs'
import { toolDial, OPEN_TOOL_FAMILIES, STAGE_RING } from './tool-stage'
import { TOOL_DEFS } from '../engine/tools'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const eq = (tid: string, uses?: number) => ({ toolId: tid, usesRemaining: uses ?? TOOL_DEFS[tid].durability })

// three dials, the open world's three tools (no farming spade in the open world)
ok(OPEN_TOOL_FAMILIES.length === 3 && OPEN_TOOL_FAMILIES.join() === 'forestry,prospecting,rinning', `three families (${OPEN_TOOL_FAMILIES})`)
// a newborn: nothing handed = every dial empty
for (const f of OPEN_TOOL_FAMILIES) { const d = toolDial({}, f); ok(!d.held && d.stage === -1 && d.ringPct === null && d.name === null, `newborn ${f} empty`) }
// the worn tool: held, stage 0, no ring, the canon name from TOOL_DEFS
for (const [f, id] of [['forestry', 'worn_blade'], ['prospecting', 'worn_spike'], ['rinning', 'worn_rinstick']] as const) {
  const d = toolDial({ [f]: eq(id) }, f)
  ok(d.held && d.stage === 0 && d.ringPct === null && d.ringColor === null && d.name === TOOL_DEFS[id].name, `${f} worn: stage 0, no ring (${JSON.stringify(d)})`)
}
// each crafted tier: its own stage, its own ring colour, full ring
const LADDERS = { forestry: ['goldwood_blade', 'shimmeroak_blade', 'starwillow_blade'], prospecting: ['mana_spike', 'crystal_spike', 'pure_spike'], rinning: ['basic_rinstick', 'glowfin_rinstick', 'moonkoi_rinstick'] }
for (const [f, ids] of Object.entries(LADDERS)) ids.forEach((id, i) => {
  const d = toolDial({ [f]: eq(id) }, f)
  ok(d.held && d.stage === i + 1 && d.ringPct === 1 && d.ringColor === STAGE_RING[i + 1] && d.name === TOOL_DEFS[id].name, `${f} ${id}: stage ${i + 1}, full ring (${JSON.stringify(d)})`)
})
ok(new Set(STAGE_RING.slice(1)).size === 3, 'a colour per upgrade')
// the ring drains with use: half the uses = half the ring, none = empty ring, never past 0..1
ok(toolDial({ forestry: eq('shimmeroak_blade', 50) }, 'forestry').ringPct === 0.5, 'half the uses = half the ring')
ok(toolDial({ forestry: eq('shimmeroak_blade', 0) }, 'forestry').ringPct === 0, 'no uses = empty ring')
ok(toolDial({ forestry: eq('shimmeroak_blade', 9999) }, 'forestry').ringPct === 1, 'clamped at full')
// a tool filed under the wrong family is not this dial's
ok(!toolDial({ forestry: eq('mana_spike') }, 'prospecting').held, 'other family = empty')
ok(!toolDial({ forestry: { toolId: 'gone_tool', usesRemaining: 1 } }, 'forestry').held, 'an unknown tool id (old save) = empty, never a crash')

// the HUD wiring (source): GameHud draws the open world's three, the server's first render empty, the socket honours `held`
const hud = readFileSync(new URL('../open/shared/game-hud.tsx', import.meta.url), 'utf8')
ok(/OPEN_TOOL_FAMILIES\.map\(/.test(hud) && /families=\{OPEN_TOOL_FAMILIES\}/.test(hud), 'GameHud: desktop + phone draw the three families')
ok(!/ensureBasicTools/.test(hud), 'GameHud: no worn kit handed out by the HUD (empty until the friend gives it)')
const layer = readFileSync(new URL('./hearth-hud-layer.tsx', import.meta.url), 'utf8')
ok(/if \(!d\.held\) return/.test(layer) && /data-held="0"/.test(layer), 'Socket: an empty dial draws empty')
ok(/readouts\.length === 3 \? \[180, 115, 50\]/.test(layer), 'Corner: three dials spread over the arc')

console.log(`${pass} ok`)
if (fails.length) { console.log(fails.map(f => 'FAIL ' + f).join('\n')); process.exit(1) }
