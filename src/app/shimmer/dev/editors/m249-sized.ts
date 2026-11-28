// BETA M249 s2 (sprites, 2026-11-28): WHICH SIZES ALEX SET BY EYE. His gallery pass (docs/looks/m249-sizes-2026-11-28/alex-gallery-sizes.json,
// 100 slots: base:<species> / form:<name> / awakened:<name>) overrides the size ORDER the older tests asserted (an awakened form grown
// past her second form, a Champion the biggest of four, a firefly hovering at ~1.35 m). Those asserts take `alexSized(...) ||` for the
// forms he sized; gallery-size-m249.test.ts pins each of his numbers exactly instead. A slot he never touched keeps the old assert.
// ★ It EXPIRES with the file: delete the json (or a slot) and every exempted assert is live again. TEST-ONLY (reads the repo with fs).
import { readFileSync } from 'fs'
import { join } from 'path'

export const ALEX_SIZED: ReadonlySet<string> = new Set(Object.keys(
  JSON.parse(readFileSync(join(process.cwd(), 'docs/looks/m249-sizes-2026-11-28/alex-gallery-sizes.json'), 'utf8')) as Record<string, number>))
export const alexSized = (...slots: string[]): boolean => slots.some(s => ALEX_SIZED.has(s))
