// Dialogue state machine
// Manages typewriter reveal, line advancement, and voice-ready hooks
// Voice integration: when audioUrl exists for a line, play alongside text

import { DIALOGUES, DialogueLine } from '../world/dialogue-data'

export interface DialogueState {
  active: boolean
  dialogueId: string
  lineIndex: number
  charProgress: number   // float — fractional char position for smooth typewriter
  lineComplete: boolean
}

const CHARS_PER_FRAME = 0.6  // ~36 chars/sec at 60fps — brisk but readable

export function createDialogueState(): DialogueState {
  return { active: false, dialogueId: '', lineIndex: 0, charProgress: 0, lineComplete: false }
}

export function startDialogue(state: DialogueState, dialogueId: string): boolean {
  const d = DIALOGUES[dialogueId]
  if (!d || d.lines.length === 0) return false
  state.active = true
  state.dialogueId = dialogueId
  state.lineIndex = 0
  state.charProgress = 0
  state.lineComplete = false
  return true
}

export function getCurrentLine(state: DialogueState): DialogueLine | null {
  if (!state.active) return null
  return DIALOGUES[state.dialogueId]?.lines[state.lineIndex] ?? null
}

export function getVisibleText(state: DialogueState): string {
  const line = getCurrentLine(state)
  if (!line) return ''
  return line.text.substring(0, Math.floor(state.charProgress))
}

/** Call every render frame to advance typewriter */
export function tickDialogue(state: DialogueState): boolean {
  if (!state.active || state.lineComplete) return false
  const line = getCurrentLine(state)
  if (!line) return false

  state.charProgress += CHARS_PER_FRAME
  if (state.charProgress >= line.text.length) {
    state.charProgress = line.text.length
    state.lineComplete = true
  }
  return true // text changed
}

/** Handle space/click — skip typewriter or advance line. Returns true if dialogue still active. */
export function advanceDialogue(state: DialogueState): boolean {
  if (!state.active) return false
  const line = getCurrentLine(state)
  if (!line) { state.active = false; return false }

  if (!state.lineComplete) {
    // Skip typewriter — reveal full line
    state.charProgress = line.text.length
    state.lineComplete = true
    return true
  }

  // Advance to next line
  const d = DIALOGUES[state.dialogueId]
  if (!d) { state.active = false; return false }

  state.lineIndex++
  if (state.lineIndex >= d.lines.length) {
    state.active = false
    return false
  }

  state.charProgress = 0
  state.lineComplete = false
  return true
}

// --- Flag triggers ---

/** Get the flag to set when a dialogue just completed. Call after advanceDialogue returns false. */
export function getCompletedFlag(state: DialogueState): string | null {
  if (state.active) return null  // still going
  const d = DIALOGUES[state.dialogueId]
  return d?.onComplete ?? null
}

// --- Voice hooks (for future Chatterbox integration) ---

/** Get audio URL for current line, if voice exists */
export function getVoiceUrl(state: DialogueState): string | null {
  const line = getCurrentLine(state)
  if (!line?.voiceRef) return null
  return `/audio/dialogue/${line.voiceRef}.wav`
}
