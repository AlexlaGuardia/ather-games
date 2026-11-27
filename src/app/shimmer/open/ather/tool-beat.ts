// ── THE TOOL-PANEL BEAT (BETA M194, Alex 11-26: 'lets be sure the tutorial points it out') ───────────────────────────────
// A Glade-tutorial beat: the first time a NEWBORN holds a tool, its dial glows and the HUD prompt slot (M218) says to click /
// tap it. Opening the tool panel clears it for good (Tut.dial = 'done', saved with the tutorial: open.tutorial.v1).
// Never for a veteran: a legacy keeper (live false) or one whose First Steps are done never sees it.
// ★ PURE. game-hud.tsx reads the save, asks toolBeatFamily, draws the glow + the line, and calls clearToolBeat on open.
import type { EquippedTools } from '../../engine/tools'
import type { ToolFamily } from '../../ui/hearth-hud-layer'
import type { Tut } from './glade-tutorial'

/** The beat is still owed: a tutorial keeper (live, First Steps not done) who has not opened a tool panel yet. */
export const toolBeatOwed = (t: Tut | null): boolean => !!t && t.live && t.fs !== 'done' && t.dial !== 'done'

/** The dial to point at right now, or null: the first family (in dial order) with a tool in its socket, while owed. */
export function toolBeatFamily(t: Tut | null, tools: EquippedTools | null | undefined, families: readonly ToolFamily[]): ToolFamily | null {
  if (!toolBeatOwed(t) || !tools) return null
  return families.find(f => !!tools[f as keyof EquippedTools]) ?? null
}

/** A tool panel opened: the beat is done (same object when nothing changes, so callers can skip the save). */
export const clearToolBeat = (t: Tut): Tut => (t.dial === 'done' ? t : { ...t, dial: 'done' })

export type BeatInput = 'mouse' | 'touch' | 'pad'
/** @lark's draft (2026-11-27), NOT YET SIGNED: Alex signs it in BETA's queue (M194), then it moves to canon + the generated
 *  lines file. PAD: lark wrote 'Press {button} to see what your tool is for.', but no pad button opens the tool panel yet
 *  (pad-bridge has none), so until one is bound a pad keeper reads the mouse line. */
export const TOOL_BEAT_LINES: Readonly<Record<'mouse' | 'touch', string>> = {
  mouse: 'Click the glowing dial to see what your tool is for.',
  touch: 'Tap the glowing dial to see what your tool is for.',
}
export const toolBeatLine = (input: BeatInput): string => TOOL_BEAT_LINES[input === 'touch' ? 'touch' : 'mouse']
