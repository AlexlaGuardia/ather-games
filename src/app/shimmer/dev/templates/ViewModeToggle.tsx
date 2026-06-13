'use client'

import { ViewMode } from '../../components/PixelUtils'

interface ViewModeToggleProps {
  mode: ViewMode
  onChange: (m: ViewMode) => void
}

export default function ViewModeToggle({ mode, onChange }: ViewModeToggleProps) {
  return (
    <div className="flex gap-1">
      {(['normal', 'silhouette', 'grayscale'] as ViewMode[]).map(m => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`px-2.5 py-1 rounded text-[11px] ${
            mode === m
              ? m === 'silhouette' ? 'bg-red-500/20 text-red-300'
                : m === 'grayscale' ? 'bg-blue-500/20 text-blue-300'
                : 'bg-white/15 text-white'
              : 'bg-white/5 text-text-faint hover:text-text-dim'
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  )
}
