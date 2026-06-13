// Zone music system — ambient background tracks with crossfade
// Handles browser autoplay policy, zone transitions, and silence gaps
// Tracks play once then wait SILENCE_MS before replaying (not constant loop)

const FADE_MS = 1500
const DEFAULT_VOLUME = 0.08  // very low — subliminal ambient
const SILENCE_MS = 5 * 60 * 1000  // 5 minutes between plays

const ZONE_TRACKS: Record<string, string> = {
  'garden':           '/audio/music/garden.mp3',
  'mycelial-path':    '/audio/music/mycelial-path.mp3',
  'moonwell-glade':   '/audio/music/moonwell-glade.mp3',
  'spore-hollow':     '/audio/music/spore-hollow.mp3',
  'twilight-thicket': '/audio/music/twilight-thicket.mp3',
  'the-threshold':    '/audio/music/the-threshold.mp3',
  'mana-springs':     '/audio/music/mana-springs.mp3',
  'spirit-meadow':    '/audio/music/spirit-meadow.mp3',
}

interface MusicState {
  current: HTMLAudioElement | null
  currentZone: string
  volume: number
  muted: boolean
  unlocked: boolean  // browser autoplay unlocked
  replayTimer: ReturnType<typeof setTimeout> | null  // silence gap timer
}

let state: MusicState = {
  current: null,
  currentZone: '',
  volume: DEFAULT_VOLUME,
  muted: false,
  unlocked: false,
  replayTimer: null,
}

// Preloaded audio elements (lazy — created on first zone visit)
const cache: Record<string, HTMLAudioElement> = {}

// Battle / event music
const BATTLE_TRACK = '/audio/music/battle.mp3'
let battleAudio: HTMLAudioElement | null = null
let inBattle = false

function getAudio(zoneId: string): HTMLAudioElement | null {
  const src = ZONE_TRACKS[zoneId]
  if (!src) return null
  if (!cache[zoneId]) {
    const audio = new Audio(src)
    audio.loop = false  // we handle replay manually with silence gap
    audio.volume = 0
    audio.preload = 'auto'
    cache[zoneId] = audio
  }
  return cache[zoneId]
}

function clearReplayTimer() {
  if (state.replayTimer !== null) {
    clearTimeout(state.replayTimer)
    state.replayTimer = null
  }
}

/** Schedule replay of current zone's track after silence gap */
function scheduleReplay(audio: HTMLAudioElement) {
  clearReplayTimer()
  state.replayTimer = setTimeout(() => {
    state.replayTimer = null
    // Only replay if still the active track and not muted
    if (state.current === audio && !state.muted && state.unlocked) {
      audio.currentTime = 0
      fadeIn(audio, state.volume)
    }
  }, SILENCE_MS)
}

/** Attach ended listener to schedule replay after silence */
function attachEndedHandler(audio: HTMLAudioElement) {
  // Remove any existing handler to avoid stacking
  audio.onended = () => {
    scheduleReplay(audio)
  }
}

function fadeOut(audio: HTMLAudioElement, onDone?: () => void) {
  const startVol = audio.volume
  if (startVol <= 0) { onDone?.(); return }
  const steps = 30
  const decrement = startVol / steps
  const interval = FADE_MS / steps
  let step = 0
  const id = window.setInterval(() => {
    step++
    audio.volume = Math.max(0, startVol - decrement * step)
    if (step >= steps) {
      window.clearInterval(id)
      audio.pause()
      audio.volume = 0
      onDone?.()
    }
  }, interval)
}

function fadeIn(audio: HTMLAudioElement, targetVol: number) {
  audio.volume = 0
  audio.play().catch(() => {})  // browser may block — that's fine
  attachEndedHandler(audio)
  const steps = 30
  const increment = targetVol / steps
  const interval = FADE_MS / steps
  let step = 0
  const id = window.setInterval(() => {
    step++
    audio.volume = Math.min(targetVol, increment * step)
    if (step >= steps) {
      window.clearInterval(id)
      audio.volume = targetVol
    }
  }, interval)
}

/** Call on first user interaction to unlock audio context */
export function unlockAudio() {
  if (state.unlocked) return
  state.unlocked = true
  // If we have a pending zone, start playing
  if (state.currentZone && !state.muted) {
    const audio = getAudio(state.currentZone)
    if (audio) fadeIn(audio, state.volume)
    state.current = audio
  }
}

/** Switch to zone's track with crossfade */
export function setZoneMusic(zoneId: string) {
  if (zoneId === state.currentZone) return
  state.currentZone = zoneId
  clearReplayTimer()  // cancel any pending replay from previous zone

  if (!state.unlocked || state.muted) return

  const next = getAudio(zoneId)
  const prev = state.current

  if (prev) {
    prev.onended = null  // detach old handler
    const targetZone = zoneId
    fadeOut(prev, () => {
      if (next && state.currentZone === targetZone) {
        next.currentTime = 0
        fadeIn(next, state.volume)
      }
    })
  } else if (next) {
    next.currentTime = 0
    fadeIn(next, state.volume)
  }

  state.current = next
}

/** Set master volume (0-1, clamped for sanity) */
export function setMusicVolume(vol: number) {
  state.volume = Math.max(0, Math.min(0.3, vol))
  if (state.current && !state.muted) {
    state.current.volume = state.volume
  }
  if (battleAudio && inBattle && !state.muted) {
    battleAudio.volume = state.volume
  }
}

/** Toggle mute */
export function toggleMusicMute(): boolean {
  state.muted = !state.muted
  if (state.muted) {
    clearReplayTimer()
    if (state.current) {
      state.current.pause()
      state.current.volume = 0
    }
    if (battleAudio && inBattle) {
      battleAudio.pause()
      battleAudio.volume = 0
    }
  } else if (state.unlocked) {
    if (inBattle && battleAudio) {
      fadeIn(battleAudio, state.volume)
    } else if (state.currentZone) {
      const audio = getAudio(state.currentZone)
      if (audio) {
        audio.currentTime = 0
        fadeIn(audio, state.volume)
      }
      state.current = audio
    }
  }
  return state.muted
}

export function isMusicMuted(): boolean {
  return state.muted
}

export function getMusicVolume(): number {
  return state.volume
}

/** Stop all music and clean up */
export function stopMusic() {
  clearReplayTimer()
  if (state.current) {
    state.current.onended = null
    state.current.pause()
    state.current.volume = 0
    state.current = null
  }
  if (battleAudio) {
    battleAudio.pause()
    battleAudio.volume = 0
  }
  inBattle = false
  state.currentZone = ''
}

// ============================================
// Battle / Event Music
// ============================================

/** Start battle music — pauses zone track, fades in battle loop */
export function startBattleMusic() {
  if (!state.unlocked) return
  inBattle = true

  // Fade out zone music (keep reference for resume)
  clearReplayTimer()
  if (state.current) {
    fadeOut(state.current)
  }

  // Create or reuse battle audio
  if (!battleAudio) {
    battleAudio = new Audio(BATTLE_TRACK)
    battleAudio.loop = true
    battleAudio.preload = 'auto'
  }
  battleAudio.volume = 0
  battleAudio.currentTime = 0

  if (!state.muted) {
    fadeIn(battleAudio, state.volume)
  }
}

/** Stop battle music — fades out, resumes zone track */
export function stopBattleMusic() {
  if (!battleAudio || !inBattle) return
  inBattle = false

  fadeOut(battleAudio, () => {
    // Resume zone music
    if (state.currentZone && !state.muted && state.unlocked) {
      const audio = getAudio(state.currentZone)
      if (audio) {
        audio.currentTime = 0
        fadeIn(audio, state.volume)
      }
      state.current = audio
    }
  })
}
