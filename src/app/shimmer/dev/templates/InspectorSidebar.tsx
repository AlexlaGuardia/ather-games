'use client'

import { useState, useCallback, useEffect, type ReactNode } from 'react'

interface InspectorSidebarProps {
  title: string | null
  children: ReactNode | null
}

export default function InspectorSidebar({ title, children }: InspectorSidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('shimmer-inspector-collapsed') === 'true'
  })

  useEffect(() => {
    localStorage.setItem('shimmer-inspector-collapsed', String(collapsed))
  }, [collapsed])

  const toggle = useCallback(() => setCollapsed(v => !v), [])

  if (collapsed) {
    return (
      <div className="w-8 shrink-0 border-l border-white/10 bg-white/[0.02] flex flex-col items-center pt-3">
        <button
          onClick={toggle}
          className="text-white/30 hover:text-white/60 text-[10px] transition-colors"
          title="Show Inspector"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          Inspector
        </button>
      </div>
    )
  }

  return (
    <div className="w-72 shrink-0 border-l border-white/10 bg-white/[0.02] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-[10px] text-white/50 uppercase tracking-wider">
          {title ?? 'Inspector'}
        </span>
        <button
          onClick={toggle}
          className="text-white/30 hover:text-white/60 text-[10px] transition-colors"
          title="Collapse Inspector"
        >
          &raquo;
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {children ?? (
          <div className="flex items-center justify-center h-32 text-white/15 text-[10px]">
            No details available
          </div>
        )}
      </div>
    </div>
  )
}
