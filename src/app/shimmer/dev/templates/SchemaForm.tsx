'use client'

import { useCallback } from 'react'
import type { FieldDef } from './field-types'

interface SchemaFormProps {
  fields: FieldDef[]
  data: Record<string, any>
  onChange: (patch: Record<string, any>) => void
  className?: string
}

const INPUT_CLS = 'w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-violet-500/50'
const SELECT_CLS = 'w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-violet-500/50 appearance-none'

// Get nested value via dot path (e.g., "levelRange.0")
function getNestedValue(data: Record<string, any>, key: string): any {
  const parts = key.split('.')
  let val: any = data
  for (const p of parts) {
    if (val == null) return undefined
    val = Array.isArray(val) ? val[parseInt(p)] : val[p]
  }
  return val
}

// Set nested value via dot path, returning a patch for the root key
function buildNestedPatch(data: Record<string, any>, key: string, value: any): Record<string, any> {
  const parts = key.split('.')
  if (parts.length === 1) return { [key]: value }

  // Deep clone the root field and set the nested value
  const rootKey = parts[0]
  const root = JSON.parse(JSON.stringify(data[rootKey] ?? {}))
  let target: any = root
  for (let i = 1; i < parts.length - 1; i++) {
    const p = parts[i]
    if (target[p] == null) target[p] = {}
    target = target[p]
  }
  const lastKey = parts[parts.length - 1]
  if (Array.isArray(target)) {
    target[parseInt(lastKey)] = value
  } else {
    target[lastKey] = value
  }
  return { [rootKey]: root }
}

function FieldRenderer({ field, data, onChange }: { field: FieldDef; data: Record<string, any>; onChange: (patch: Record<string, any>) => void }) {
  const value = getNestedValue(data, field.key)

  const handleChange = useCallback((newValue: any) => {
    onChange(buildNestedPatch(data, field.key, newValue))
  }, [data, field.key, onChange])

  switch (field.type) {
    case 'text':
      return (
        <input
          className={INPUT_CLS}
          value={value ?? ''}
          onChange={e => handleChange(e.target.value)}
          placeholder={field.placeholder}
        />
      )

    case 'textarea':
      return (
        <textarea
          className={INPUT_CLS + ' min-h-[80px] resize-y'}
          value={value ?? ''}
          onChange={e => handleChange(e.target.value)}
          placeholder={field.placeholder}
        />
      )

    case 'number':
      return (
        <input
          type="number"
          className={INPUT_CLS}
          value={value ?? 0}
          onChange={e => handleChange(parseFloat(e.target.value) || 0)}
          min={field.min}
          max={field.max}
          step={field.step}
        />
      )

    case 'range':
      return (
        <div className="flex items-center gap-2">
          <input
            type="range"
            className="flex-1 accent-violet-500"
            value={value ?? field.min ?? 0}
            onChange={e => handleChange(parseFloat(e.target.value))}
            min={field.min}
            max={field.max}
            step={field.step}
          />
          <span className="text-[10px] text-white/50 tabular-nums w-8 text-right">
            {(value ?? field.min ?? 0).toFixed(field.step && field.step < 1 ? 2 : 0)}
          </span>
        </div>
      )

    case 'select':
      return (
        <select
          className={SELECT_CLS}
          value={value ?? ''}
          onChange={e => handleChange(e.target.value || undefined)}
        >
          {(field.options ?? []).map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )

    case 'checkbox':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={e => handleChange(e.target.checked)}
            className="accent-violet-500"
          />
          <span className="text-xs text-white/60">{field.label}</span>
        </label>
      )

    case 'color':
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value ?? '#ffffff'}
            onChange={e => handleChange(e.target.value)}
            className="w-8 h-6 rounded border border-white/10 bg-transparent cursor-pointer"
          />
          <span className="text-[10px] text-white/40 font-mono">{value ?? '#ffffff'}</span>
        </div>
      )

    default:
      return null
  }
}

export default function SchemaForm({ fields, data, onChange, className }: SchemaFormProps) {
  // Group fields
  const groups = new Map<string, FieldDef[]>()
  const ungrouped: FieldDef[] = []

  for (const field of fields) {
    // Skip fields with unmet conditions
    if (field.condition && !field.condition(data)) continue

    if (field.group) {
      const list = groups.get(field.group) ?? []
      list.push(field)
      groups.set(field.group, list)
    } else {
      ungrouped.push(field)
    }
  }

  return (
    <div className={`space-y-3 ${className ?? ''}`}>
      {/* Ungrouped fields */}
      {ungrouped.map(field => (
        <div key={field.key} className="space-y-1">
          {field.type !== 'checkbox' && (
            <label className="text-[9px] text-white/40 uppercase tracking-wider flex items-center gap-1">
              {field.label}
              {field.required && <span className="text-red-400">*</span>}
            </label>
          )}
          <FieldRenderer field={field} data={data} onChange={onChange} />
        </div>
      ))}

      {/* Grouped fields */}
      {Array.from(groups.entries()).map(([groupName, groupFields]) => (
        <div key={groupName} className="space-y-2">
          <div className="text-[9px] text-white/30 uppercase tracking-wider pt-2 border-t border-white/5">
            {groupName}
          </div>
          {groupFields.map(field => (
            <div key={field.key} className="space-y-1">
              {field.type !== 'checkbox' && (
                <label className="text-[9px] text-white/40 uppercase tracking-wider flex items-center gap-1">
                  {field.label}
                  {field.required && <span className="text-red-400">*</span>}
                </label>
              )}
              <FieldRenderer field={field} data={data} onChange={onChange} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
