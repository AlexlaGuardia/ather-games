'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import EditorShell from '../templates/EditorShell'
import { ZONES } from '../../world/zones'
import {
  DEFAULT_WEATHER_CONFIGS,
  WEATHER_TYPES,
  WEATHER_NAMES,
  getWeatherAmbient,
  type ZoneWeatherConfig,
  type WeatherType,
  type WeatherWeight,
} from '../../engine/weather'
import { useInspector } from '../templates/inspector-context'

const WEATHER_COLORS: Record<WeatherType, string> = {
  clear: '#f0e6c8',
  rain: '#4080c0',
  storm: '#6040a0',
  fog: '#808080',
  drought: '#c08030',
  mana_surge: '#9060d0',
}

interface Props {
  onDeploy?: () => void
  deployState?: 'idle' | 'building' | 'done' | 'error'
}

function deepCloneConfigs(): Record<string, ZoneWeatherConfig> {
  const clone: Record<string, ZoneWeatherConfig> = {}
  for (const [k, v] of Object.entries(DEFAULT_WEATHER_CONFIGS)) {
    clone[k] = {
      allowedWeathers: v.allowedWeathers.map(w => ({ ...w })),
      transitionTicks: v.transitionTicks,
      minDurationMs: v.minDurationMs,
      maxDurationMs: v.maxDurationMs,
    }
  }
  return clone
}

export default function WeatherEditor({ onDeploy, deployState }: Props) {
  const [configs, setConfigs] = useState<Record<string, ZoneWeatherConfig>>(deepCloneConfigs)
  const [selectedZone, setSelectedZone] = useState<string>(ZONES[0]?.id ?? 'garden')
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const zoneIds = useMemo(() => ZONES.map(z => z.id), [])
  const current = configs[selectedZone]
  const { setInspectorContent, setInspectorTitle } = useInspector()

  // Inspector: zone weather summary
  useEffect(() => {
    setInspectorTitle('Weather Summary')
    if (!current) {
      setInspectorContent(null)
      return
    }
    const totalWeight = current.allowedWeathers.reduce((s, w) => s + w.weight, 0)
    setInspectorContent(
      <div className="p-3 space-y-3">
        <div>
          <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Distribution</div>
          {current.allowedWeathers.map(w => {
            const pct = totalWeight > 0 ? Math.round(w.weight / totalWeight * 100) : 0
            return (
              <div key={w.type} className="flex items-center gap-2 text-xs mb-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: WEATHER_COLORS[w.type] }} />
                <span className="text-white/60 flex-1">{WEATHER_NAMES[w.type]}</span>
                <span className="text-white/40 font-mono">{pct}%</span>
              </div>
            )
          })}
        </div>
        <div>
          <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Timing</div>
          <div className="text-xs text-white/50">
            Transition: {(current.transitionTicks / 15).toFixed(1)}s
          </div>
          <div className="text-xs text-white/50">
            Duration: {Math.round(current.minDurationMs / 60000)}-{Math.round(current.maxDurationMs / 60000)} min
          </div>
        </div>
        <div>
          <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Ambient Preview</div>
          <div className="flex gap-1">
            {current.allowedWeathers.map(w => {
              const ambient = getWeatherAmbient(w.type, 1.0)
              return (
                <div
                  key={w.type}
                  className="w-8 h-8 rounded border border-white/10 relative overflow-hidden"
                  title={WEATHER_NAMES[w.type]}
                >
                  <div className="absolute inset-0 bg-[#1a2a1a]" />
                  <div
                    className="absolute inset-0"
                    style={{ backgroundColor: ambient.color, opacity: ambient.alpha * 5 }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }, [current, setInspectorContent, setInspectorTitle])

  // Ensure all zones have configs
  useEffect(() => {
    let changed = false
    const next = { ...configs }
    for (const zoneId of zoneIds) {
      if (!next[zoneId]) {
        next[zoneId] = {
          allowedWeathers: [{ type: 'clear', weight: 5 }],
          transitionTicks: 30,
          minDurationMs: 5 * 60 * 1000,
          maxDurationMs: 10 * 60 * 1000,
        }
        changed = true
      }
    }
    if (changed) setConfigs(next)
  }, [zoneIds]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateZone = useCallback((patch: Partial<ZoneWeatherConfig>) => {
    setConfigs(prev => ({
      ...prev,
      [selectedZone]: { ...prev[selectedZone], ...patch },
    }))
    setDirty(true)
  }, [selectedZone])

  const toggleWeather = useCallback((type: WeatherType, enabled: boolean) => {
    setConfigs(prev => {
      const zone = prev[selectedZone]
      let weathers = [...zone.allowedWeathers]
      if (enabled) {
        if (!weathers.find(w => w.type === type)) {
          weathers.push({ type, weight: 3 })
        }
      } else {
        weathers = weathers.filter(w => w.type !== type)
      }
      return { ...prev, [selectedZone]: { ...zone, allowedWeathers: weathers } }
    })
    setDirty(true)
  }, [selectedZone])

  const updateWeight = useCallback((type: WeatherType, weight: number) => {
    setConfigs(prev => {
      const zone = prev[selectedZone]
      const weathers = zone.allowedWeathers.map(w =>
        w.type === type ? { ...w, weight: Math.max(1, Math.min(10, weight)) } : w
      )
      return { ...prev, [selectedZone]: { ...zone, allowedWeathers: weathers } }
    })
    setDirty(true)
  }, [selectedZone])

  const save = useCallback(async () => {
    setSaveStatus('Saving...')
    try {
      const res = await fetch('/shimmer/save-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weather: configs }),
      })
      const data = await res.json()
      if (data.success) {
        setSaveStatus('Saved!')
        setDirty(false)
        onDeploy?.()
      } else {
        setSaveStatus(`Error: ${data.error}`)
      }
    } catch (e: any) {
      setSaveStatus(`Error: ${e.message}`)
    }
    setTimeout(() => setSaveStatus(null), 2000)
  }, [configs, onDeploy])

  return (
    <EditorShell
      title="Weather"
      subtitle="Zone-based weather patterns and effects"
      onDeploy={onDeploy}
      deployState={deployState}
    >
      {/* Save bar */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={save}
          disabled={!dirty}
          className={`px-4 py-1.5 rounded text-xs font-display transition-all ${
            dirty
              ? 'bg-gold/20 text-gold border border-gold/30 hover:bg-gold/30'
              : 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed'
          }`}
        >
          Save Weather
        </button>
        {saveStatus && <span className="text-xs text-white/40">{saveStatus}</span>}
        {dirty && !saveStatus && <span className="text-xs text-amber-400/60">Unsaved changes</span>}
      </div>

      <div className="flex gap-6">
        {/* Zone list */}
        <div className="w-48 shrink-0 space-y-1">
          <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Zones</div>
          {zoneIds.map(zoneId => {
            const cfg = configs[zoneId]
            const count = cfg?.allowedWeathers.length ?? 0
            return (
              <button
                key={zoneId}
                onClick={() => setSelectedZone(zoneId)}
                className={`w-full text-left px-3 py-2 rounded text-xs transition-all ${
                  selectedZone === zoneId
                    ? 'bg-white/10 text-gold'
                    : 'text-white/50 hover:text-white/70 hover:bg-white/5'
                }`}
              >
                <span className="block truncate">{zoneId}</span>
                <span className="text-[10px] text-white/30">{count} weather{count !== 1 ? 's' : ''}</span>
              </button>
            )
          })}
        </div>

        {/* Zone weather config */}
        <div className="flex-1 space-y-6">
          {!current ? (
            <p className="text-white/30 text-sm">Select a zone</p>
          ) : (
            <>
              <div className="text-sm text-gold font-display">{selectedZone}</div>

              {/* Weather type toggles + weights */}
              <div>
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Allowed Weather</div>
                <div className="grid grid-cols-3 gap-3">
                  {WEATHER_TYPES.map(type => {
                    const entry = current.allowedWeathers.find(w => w.type === type)
                    const enabled = !!entry
                    return (
                      <div
                        key={type}
                        className={`border rounded-lg p-3 transition-all ${
                          enabled ? 'border-white/20 bg-white/5' : 'border-white/5 bg-white/[0.02] opacity-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={e => toggleWeather(type, e.target.checked)}
                            className="accent-gold"
                          />
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: WEATHER_COLORS[type] }} />
                          <span className="text-xs text-white/70">{WEATHER_NAMES[type]}</span>
                        </div>
                        {enabled && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-white/30">Weight</span>
                            <input
                              type="range"
                              min={1}
                              max={10}
                              value={entry!.weight}
                              onChange={e => updateWeight(type, parseInt(e.target.value))}
                              className="flex-1 h-1 accent-gold"
                            />
                            <span className="text-[10px] text-white/50 font-mono w-4 text-right">{entry!.weight}</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Timing */}
              <div>
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Timing</div>
                <div className="grid grid-cols-3 gap-4">
                  <label className="space-y-1">
                    <span className="text-[10px] text-white/40 block">Transition (sec)</span>
                    <input
                      type="number"
                      min={0.5}
                      max={10}
                      step={0.5}
                      value={+(current.transitionTicks / 15).toFixed(1)}
                      onChange={e => updateZone({ transitionTicks: Math.round(parseFloat(e.target.value) * 15) })}
                      className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white/70 focus:border-gold/50 outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-white/40 block">Min Duration (min)</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      step={1}
                      value={Math.round(current.minDurationMs / 60000)}
                      onChange={e => updateZone({ minDurationMs: parseInt(e.target.value) * 60000 })}
                      className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white/70 focus:border-gold/50 outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-white/40 block">Max Duration (min)</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      step={1}
                      value={Math.round(current.maxDurationMs / 60000)}
                      onChange={e => updateZone({ maxDurationMs: parseInt(e.target.value) * 60000 })}
                      className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white/70 focus:border-gold/50 outline-none"
                    />
                  </label>
                </div>
              </div>

              {/* Effects reference */}
              <div>
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Effects Reference</div>
                <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="text-white/30">
                        <th className="text-left pb-1">Weather</th>
                        <th className="text-left pb-1">Encounters</th>
                        <th className="text-left pb-1">Farming</th>
                        <th className="text-left pb-1">Gathering</th>
                        <th className="text-left pb-1">Mana</th>
                        <th className="text-left pb-1">Battle</th>
                      </tr>
                    </thead>
                    <tbody className="text-white/40">
                      <tr><td className="py-0.5">Clear</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td></tr>
                      <tr><td className="py-0.5">Rain</td><td>Water +50%</td><td>+30%</td><td>-</td><td>-</td><td>Water +10%</td></tr>
                      <tr><td className="py-0.5">Storm</td><td>Storm +50%</td><td>-</td><td>-10%</td><td>-</td><td>Storm +10%</td></tr>
                      <tr><td className="py-0.5">Fog</td><td>-</td><td>-</td><td>-20%</td><td>-</td><td>-</td></tr>
                      <tr><td className="py-0.5">Drought</td><td>Earth +30%</td><td>-40%</td><td>-</td><td>-15%</td><td>Earth +10%</td></tr>
                      <tr><td className="py-0.5">Mana Surge</td><td>All +20%</td><td>-</td><td>-</td><td>+30%</td><td>Mana +10%</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </EditorShell>
  )
}
