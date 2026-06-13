// Weather system — zone-based weather that affects encounters, farming, gathering, battles, and visuals
// Integrates with day-cycle for ambient overlay composition.
// Editor: WeatherEditor.tsx in dev page (Systems tab)

import type { BattleElement } from './moves'

// ============================================
// Types
// ============================================

export type WeatherType = 'clear' | 'rain' | 'storm' | 'fog' | 'drought' | 'mana_surge'

export const WEATHER_TYPES: WeatherType[] = ['clear', 'rain', 'storm', 'fog', 'drought', 'mana_surge']

export const WEATHER_NAMES: Record<WeatherType, string> = {
  clear: 'Clear',
  rain: 'Rain',
  storm: 'Storm',
  fog: 'Fog',
  drought: 'Drought',
  mana_surge: 'Mana Surge',
}

export interface WeatherWeight {
  type: WeatherType
  weight: number
}

export interface ZoneWeatherConfig {
  allowedWeathers: WeatherWeight[]
  transitionTicks: number  // ticks to transition between weather (15 = 1s)
  minDurationMs: number    // minimum before next roll
  maxDurationMs: number    // maximum before next roll
}

export interface WeatherState {
  current: WeatherType
  previous: WeatherType
  transitionProgress: number  // 0-1, 1 = fully transitioned
  transitionTicks: number     // total ticks for transition
  nextRollAt: number          // Date.now() timestamp for next weather roll
}

// ============================================
// Default Configs (editable via WeatherEditor → save-map)
// ============================================

export const DEFAULT_WEATHER_CONFIGS: Record<string, ZoneWeatherConfig> = {
  'garden': {
    allowedWeathers: [
      { type: 'clear', weight: 6 },
      { type: 'rain', weight: 2 },
      { type: 'mana_surge', weight: 1 },
    ],
    transitionTicks: 30,
    minDurationMs: 5 * 60 * 1000,
    maxDurationMs: 10 * 60 * 1000,
  },
  'mycelial-path': {
    allowedWeathers: [
      { type: 'clear', weight: 4 },
      { type: 'rain', weight: 3 },
      { type: 'fog', weight: 2 },
    ],
    transitionTicks: 45,
    minDurationMs: 4 * 60 * 1000,
    maxDurationMs: 8 * 60 * 1000,
  },
  'moonwell-glade': {
    allowedWeathers: [
      { type: 'clear', weight: 4 },
      { type: 'rain', weight: 2 },
      { type: 'mana_surge', weight: 2 },
      { type: 'fog', weight: 1 },
    ],
    transitionTicks: 30,
    minDurationMs: 4 * 60 * 1000,
    maxDurationMs: 8 * 60 * 1000,
  },
  'spore-hollow': {
    allowedWeathers: [
      { type: 'clear', weight: 3 },
      { type: 'fog', weight: 3 },
      { type: 'rain', weight: 2 },
      { type: 'storm', weight: 1 },
    ],
    transitionTicks: 45,
    minDurationMs: 3 * 60 * 1000,
    maxDurationMs: 7 * 60 * 1000,
  },
  'twilight-thicket': {
    allowedWeathers: [
      { type: 'clear', weight: 3 },
      { type: 'fog', weight: 3 },
      { type: 'storm', weight: 2 },
    ],
    transitionTicks: 60,
    minDurationMs: 3 * 60 * 1000,
    maxDurationMs: 6 * 60 * 1000,
  },
  'the-threshold': {
    allowedWeathers: [
      { type: 'clear', weight: 2 },
      { type: 'storm', weight: 3 },
      { type: 'drought', weight: 2 },
      { type: 'mana_surge', weight: 1 },
    ],
    transitionTicks: 45,
    minDurationMs: 3 * 60 * 1000,
    maxDurationMs: 6 * 60 * 1000,
  },
  'mana-springs': {
    allowedWeathers: [
      { type: 'clear', weight: 3 },
      { type: 'rain', weight: 3 },
      { type: 'mana_surge', weight: 3 },
    ],
    transitionTicks: 30,
    minDurationMs: 3 * 60 * 1000,
    maxDurationMs: 7 * 60 * 1000,
  },
  'spirit-meadow': {
    allowedWeathers: [
      { type: 'clear', weight: 5 },
      { type: 'rain', weight: 2 },
      { type: 'drought', weight: 1 },
    ],
    transitionTicks: 30,
    minDurationMs: 5 * 60 * 1000,
    maxDurationMs: 10 * 60 * 1000,
  },
}

// ============================================
// State Management
// ============================================

/** Create initial weather state for a zone */
export function createWeatherState(config: ZoneWeatherConfig): WeatherState {
  const initial = rollWeather(config)
  return {
    current: initial,
    previous: 'clear',
    transitionProgress: 1.0,
    transitionTicks: config.transitionTicks,
    nextRollAt: Date.now() + randomDuration(config),
  }
}

/** Roll a random duration between min and max */
function randomDuration(config: ZoneWeatherConfig): number {
  return config.minDurationMs + Math.random() * (config.maxDurationMs - config.minDurationMs)
}

/** Roll next weather from weighted pool */
export function rollWeather(config: ZoneWeatherConfig): WeatherType {
  const allowed = config.allowedWeathers
  if (allowed.length === 0) return 'clear'
  const totalWeight = allowed.reduce((s, w) => s + w.weight, 0)
  let roll = Math.random() * totalWeight
  for (const w of allowed) {
    roll -= w.weight
    if (roll <= 0) return w.type
  }
  return allowed[0].type
}

/**
 * Tick weather for a zone. Call every game tick (15 TPS).
 * Returns true if weather changed (for UI notification).
 */
export function tickWeather(state: WeatherState, config: ZoneWeatherConfig): boolean {
  let changed = false

  // Advance transition
  if (state.transitionProgress < 1.0) {
    state.transitionProgress = Math.min(1.0, state.transitionProgress + 1 / state.transitionTicks)
  }

  // Check if it's time to roll new weather
  if (Date.now() >= state.nextRollAt) {
    const newWeather = rollWeather(config)
    if (newWeather !== state.current) {
      state.previous = state.current
      state.current = newWeather
      state.transitionProgress = 0
      state.transitionTicks = config.transitionTicks
      changed = true
    }
    state.nextRollAt = Date.now() + randomDuration(config)
  }

  return changed
}

// ============================================
// Gameplay Modifiers
// ============================================

/** Weather ambient overlay (composites with day-cycle) */
export function getWeatherAmbient(weather: WeatherType, progress: number): { color: string; alpha: number } {
  const fade = progress // fade in as transition progresses
  switch (weather) {
    case 'clear':      return { color: '#000000', alpha: 0 }
    case 'rain':       return { color: '#304060', alpha: 0.08 * fade }
    case 'storm':      return { color: '#202040', alpha: 0.15 * fade }
    case 'fog':        return { color: '#808080', alpha: 0.12 * fade }
    case 'drought':    return { color: '#c08030', alpha: 0.06 * fade }
    case 'mana_surge': return { color: '#6040b0', alpha: 0.08 * fade }
  }
}

/** Encounter weight multiplier per element. Weather boosts matching encounters. */
export function getWeatherEncounterMod(weather: WeatherType): Partial<Record<BattleElement, number>> {
  switch (weather) {
    case 'rain':       return { water: 1.5 }
    case 'storm':      return { storm: 1.5 }
    case 'drought':    return { earth: 1.3 }
    case 'mana_surge': return { mana: 1.2, storm: 1.2, earth: 1.2, water: 1.2 }
    default:           return {}
  }
}

/** Farming growth speed multiplier */
export function getWeatherGrowthMod(weather: WeatherType): number {
  switch (weather) {
    case 'rain':    return 1.3   // rain helps crops
    case 'drought': return 0.6   // drought hurts crops
    default:        return 1.0
  }
}

/** Gathering channel speed multiplier (applied to duration — lower = faster) */
export function getWeatherGatherMod(weather: WeatherType): number {
  switch (weather) {
    case 'fog':   return 1.2   // fog slows gathering (20% slower)
    case 'storm': return 1.1   // storm slightly slows (10% slower)
    default:      return 1.0
  }
}

/** Mana regen multiplier */
export function getWeatherManaMod(weather: WeatherType): number {
  switch (weather) {
    case 'mana_surge': return 1.3   // +30% mana regen
    case 'drought':    return 0.85  // -15% mana regen
    default:           return 1.0
  }
}

/** Battle element damage bonus. Returns multiplier per element. */
export function getWeatherBattleMod(weather: WeatherType): Partial<Record<BattleElement, number>> {
  switch (weather) {
    case 'rain':       return { water: 1.1 }
    case 'storm':      return { storm: 1.1 }
    case 'drought':    return { earth: 1.1 }
    case 'mana_surge': return { mana: 1.1 }
    default:           return {}
  }
}

// ============================================
// Save / Load
// ============================================

export interface WeatherSave {
  current: WeatherType
  nextRollAt: number
}

export function weatherToSave(states: Record<string, WeatherState>): Record<string, WeatherSave> {
  const result: Record<string, WeatherSave> = {}
  for (const [zoneId, state] of Object.entries(states)) {
    result[zoneId] = { current: state.current, nextRollAt: state.nextRollAt }
  }
  return result
}

export function weatherFromSave(
  saved: Record<string, WeatherSave> | undefined,
  configs: Record<string, ZoneWeatherConfig>,
): Record<string, WeatherState> {
  const states: Record<string, WeatherState> = {}
  for (const [zoneId, config] of Object.entries(configs)) {
    const s = saved?.[zoneId]
    if (s) {
      states[zoneId] = {
        current: s.current,
        previous: 'clear',
        transitionProgress: 1.0,
        transitionTicks: config.transitionTicks,
        nextRollAt: s.nextRollAt,
      }
    } else {
      states[zoneId] = createWeatherState(config)
    }
  }
  return states
}
