'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface EditableCellProps {
  value: string | number
  type: 'text' | 'number' | 'select'
  options?: { value: string; label: string }[]
  onChange: (value: string | number) => void
  min?: number
  max?: number
  step?: number
  className?: string
  inputClassName?: string
}

export default function EditableCell({
  value,
  type,
  options,
  onChange,
  min,
  max,
  step,
  className = '',
  inputClassName = '',
}: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string>(String(value))
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null)

  // Sync draft when value changes externally
  useEffect(() => {
    if (!editing) {
      setDraft(String(value))
    }
  }, [value, editing])

  const startEditing = useCallback(() => {
    setDraft(String(value))
    setEditing(true)
  }, [value])

  const commit = useCallback(() => {
    setEditing(false)
    if (type === 'number') {
      const parsed = step && step < 1 ? parseFloat(draft) : parseInt(draft, 10)
      onChange(isNaN(parsed) ? (value as number) : parsed)
    } else {
      onChange(draft)
    }
  }, [draft, type, step, onChange, value])

  const revert = useCallback(() => {
    setDraft(String(value))
    setEditing(false)
  }, [value])

  // Auto-focus and select text when entering edit mode
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      if (type !== 'select' && inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select()
      }
    }
  }, [editing, type])

  const baseInputClass =
    'bg-transparent border border-violet-500/50 rounded px-2 py-1 text-xs outline-none tabular-nums'

  if (editing) {
    if (type === 'select') {
      return (
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') revert()
          }}
          className={`${baseInputClass} ${inputClassName}`}
          style={{ background: '#1a1a2e' }}
        >
          {options?.map(opt => (
            <option key={opt.value} value={opt.value} style={{ background: '#1a1a2e' }}>
              {opt.label}
            </option>
          ))}
        </select>
      )
    }

    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={type}
        value={draft}
        min={min}
        max={max}
        step={step}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') revert()
        }}
        className={`${baseInputClass} ${inputClassName}`}
      />
    )
  }

  return (
    <span
      onClick={startEditing}
      className={`text-xs tabular-nums px-2 py-1 rounded cursor-pointer hover:bg-white/5 transition-colors min-w-[40px] inline-block ${className}`}
    >
      {String(value)}
    </span>
  )
}
