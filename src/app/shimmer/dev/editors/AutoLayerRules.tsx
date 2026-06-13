'use client'

import { useState, useCallback } from 'react'
import type { AutoLayerRule } from './autolayer-engine'
import { createEmptyRule, BUILTIN_RULE_TEMPLATES } from './autolayer-engine'

interface AutoLayerRulesProps {
  rules: AutoLayerRule[]
  intValues: { value: number; label: string; color: string }[]
  onUpdateRules: (rules: AutoLayerRule[]) => void
}

const PATTERN_LABELS = ['TL', 'T', 'TR', 'L', 'C', 'R', 'BL', 'B', 'BR']

function PatternGrid({ pattern, onChange, intValue }: {
  pattern: (number | -1)[]
  onChange: (i: number, value: number | -1) => void
  intValue: number
}) {
  return (
    <div className="grid grid-cols-3 gap-0.5 w-[72px]">
      {pattern.map((val, i) => (
        <button
          key={i}
          onClick={() => {
            // Cycle: -1 (any) → intValue (match) → 0 (empty) → -1
            const next = val === -1 ? intValue : val === intValue ? 0 : -1
            onChange(i, next)
          }}
          className={`w-6 h-6 rounded text-[8px] font-mono flex items-center justify-center border transition-colors ${
            i === 4
              ? 'border-gold/40 bg-gold/20 text-gold'
              : val === -1
              ? 'border-white/10 bg-white/[0.02] text-white/20'
              : val === 0
              ? 'border-red-500/30 bg-red-500/10 text-red-400'
              : 'border-green-500/30 bg-green-500/10 text-green-400'
          }`}
          title={`${PATTERN_LABELS[i]}: ${val === -1 ? 'any' : val === 0 ? 'empty' : `value ${val}`}`}
        >
          {val === -1 ? '*' : val}
        </button>
      ))}
    </div>
  )
}

export default function AutoLayerRules({ rules, intValues, onUpdateRules }: AutoLayerRulesProps) {
  const [collapsed, setCollapsed] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)

  const updateRule = useCallback((id: string, patch: Partial<AutoLayerRule>) => {
    onUpdateRules(rules.map(r => r.id === id ? { ...r, ...patch } : r))
  }, [rules, onUpdateRules])

  const deleteRule = useCallback((id: string) => {
    onUpdateRules(rules.filter(r => r.id !== id))
  }, [rules, onUpdateRules])

  const addRule = useCallback((intValue: number) => {
    onUpdateRules([...rules, createEmptyRule(intValue)])
  }, [rules, onUpdateRules])

  const loadBuiltins = useCallback(() => {
    const existing = new Set(rules.map(r => r.name))
    const newRules = BUILTIN_RULE_TEMPLATES.filter(t => !existing.has(t.name))
    if (newRules.length > 0) {
      onUpdateRules([...rules, ...newRules.map(r => ({ ...r, id: `rule_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}` }))])
    }
  }, [rules, onUpdateRules])

  const enabledCount = rules.filter(r => r.enabled).length

  return (
    <div className="border border-white/10 rounded-lg bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-[10px] text-white/50 uppercase tracking-wider hover:bg-white/5 transition-colors"
      >
        <span className={`transition-transform ${collapsed ? '-rotate-90' : ''}`}>&#9662;</span>
        Auto-layer Rules ({enabledCount}/{rules.length})
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 space-y-3">
          {/* Controls */}
          <div className="flex items-center gap-2">
            {intValues.map(iv => (
              <button
                key={iv.value}
                onClick={() => addRule(iv.value)}
                className="px-2 py-0.5 rounded text-[10px] border border-dashed transition-colors hover:bg-white/5"
                style={{ color: iv.color, borderColor: iv.color + '40' }}
              >
                + {iv.label} rule
              </button>
            ))}
            <button
              onClick={loadBuiltins}
              className="px-2 py-0.5 rounded text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 ml-auto"
            >
              Load Templates
            </button>
          </div>

          {/* Rule list */}
          <div className="space-y-2">
            {rules.length === 0 && (
              <p className="text-[10px] text-white/20 py-2">No rules. Click &ldquo;Load Templates&rdquo; for water/path defaults.</p>
            )}
            {rules.map(rule => {
              const iv = intValues.find(v => v.value === rule.intValue)
              const isEditing = editingId === rule.id
              return (
                <div
                  key={rule.id}
                  className={`rounded border transition-colors ${
                    rule.enabled ? 'border-white/10 bg-white/[0.02]' : 'border-white/5 bg-white/[0.01] opacity-50'
                  }`}
                >
                  {/* Rule header */}
                  <div className="flex items-center gap-2 px-2.5 py-1.5">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={e => updateRule(rule.id, { enabled: e.target.checked })}
                      className="accent-green-400"
                    />
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: iv?.color ?? '#666' }}
                    />
                    <button
                      onClick={() => setEditingId(isEditing ? null : rule.id)}
                      className="text-[11px] text-white/70 hover:text-white/90 flex-1 text-left"
                    >
                      {rule.name}
                    </button>
                    <span className="text-[9px] text-white/25">P{rule.priority}</span>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="text-red-400/40 hover:text-red-400 text-[10px] transition-colors"
                    >x</button>
                  </div>

                  {/* Expanded editor */}
                  {isEditing && (
                    <div className="px-2.5 pb-2.5 pt-1 border-t border-white/5 space-y-2">
                      <div className="flex items-start gap-4">
                        {/* Pattern grid */}
                        <div>
                          <span className="text-[9px] text-white/30 uppercase">Pattern</span>
                          <PatternGrid
                            pattern={rule.pattern}
                            intValue={rule.intValue}
                            onChange={(i, val) => {
                              const next = [...rule.pattern]
                              next[i] = val
                              updateRule(rule.id, { pattern: next })
                            }}
                          />
                          <span className="text-[8px] text-white/15 mt-1 block">click to cycle: any → match → empty</span>
                        </div>

                        {/* Settings */}
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-white/30 w-12">Name</span>
                            <input
                              type="text"
                              value={rule.name}
                              onChange={e => updateRule(rule.id, { name: e.target.value })}
                              className="bg-transparent border border-white/10 rounded px-2 py-0.5 text-[10px] text-white/70 outline-none focus:border-violet-500/40 flex-1"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-white/30 w-12">Tile</span>
                            <input
                              type="number"
                              min={0}
                              value={rule.outputTileIdx}
                              onChange={e => updateRule(rule.id, { outputTileIdx: parseInt(e.target.value) || 0 })}
                              className="bg-transparent border border-white/10 rounded px-2 py-0.5 text-[10px] text-white/70 outline-none focus:border-violet-500/40 w-16"
                            />
                            <span className="text-[9px] text-white/30 w-8">Rot</span>
                            <select
                              value={rule.outputRotation}
                              onChange={e => updateRule(rule.id, { outputRotation: parseInt(e.target.value) })}
                              className="bg-[#1a1a2e] border border-white/10 rounded px-1 py-0.5 text-[10px] text-white/70 outline-none"
                            >
                              <option value={0}>0°</option>
                              <option value={1}>90°</option>
                              <option value={2}>180°</option>
                              <option value={3}>270°</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-white/30 w-12">Priority</span>
                            <input
                              type="number"
                              min={1}
                              max={99}
                              value={rule.priority}
                              onChange={e => updateRule(rule.id, { priority: parseInt(e.target.value) || 1 })}
                              className="bg-transparent border border-white/10 rounded px-2 py-0.5 text-[10px] text-white/70 outline-none focus:border-violet-500/40 w-16"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
