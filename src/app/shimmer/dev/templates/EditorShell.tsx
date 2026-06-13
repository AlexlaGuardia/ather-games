'use client'

import { Component, ReactNode, useState, useEffect } from 'react'
import ShortcutsOverlay from './ShortcutsOverlay'
import type { ShortcutDef } from './shortcut-data'

// Error boundary — catches crashes in any editor, shows recovery UI
class EditorErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) return (
      <div className="p-12 text-center space-y-3">
        <p className="text-red-400 text-sm font-display">Editor crashed</p>
        <p className="text-text-faint text-xs max-w-md mx-auto">{this.state.error.message}</p>
        <button
          onClick={() => this.setState({ error: null })}
          className="px-4 py-2 bg-violet-500/20 text-violet-300 border border-violet-500/30 rounded text-xs font-display hover:bg-violet-500/30"
        >Try Again</button>
      </div>
    )
    return this.props.children
  }
}

interface EditorShellProps {
  title: string
  subtitle: string
  loadStatus?: string
  onDeploy?: () => void
  deployState?: 'idle' | 'building' | 'done' | 'error'
  headerActions?: ReactNode
  shortcuts?: ShortcutDef[]
  recoveryBanner?: ReactNode
  children: ReactNode
}

export default function EditorShell({
  title,
  subtitle,
  loadStatus,
  onDeploy,
  deployState = 'idle',
  headerActions,
  shortcuts,
  recoveryBanner,
  children,
}: EditorShellProps) {
  const [showShortcuts, setShowShortcuts] = useState(false)

  useEffect(() => {
    if (!shortcuts?.length) return
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === '?') {
        e.preventDefault()
        setShowShortcuts(prev => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcuts])

  return (
    <>
      <div className="flex items-baseline gap-4 mb-6">
        <h1 className="font-display text-2xl text-gold">{title}</h1>
        <p className="text-text-faint text-xs">{subtitle}</p>
        {loadStatus && (
          <span className={`text-[10px] ${
            loadStatus === 'live'   ? 'text-green-400' :
            loadStatus === 'failed' ? 'text-red-400'   : 'text-text-faint'
          }`}>
            {loadStatus === 'live' ? '● live from source' : loadStatus}
          </span>
        )}
        {shortcuts && shortcuts.length > 0 && (
          <button
            onClick={() => setShowShortcuts(v => !v)}
            className="w-6 h-6 rounded border border-white/10 text-white/30 hover:text-white/60 hover:bg-white/5 text-xs flex items-center justify-center transition-colors"
            title="Keyboard shortcuts (?)"
          >
            ?
          </button>
        )}
        {headerActions}
        {onDeploy && (
          <button
            onClick={onDeploy}
            disabled={deployState === 'building'}
            className={`ml-auto px-4 py-1.5 rounded text-xs font-display border transition-all ${
              deployState === 'building'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse'
                : deployState === 'done'
                ? 'bg-green-500/20 text-green-300 border-green-500/30'
                : deployState === 'error'
                ? 'bg-red-500/20 text-red-300 border-red-500/30'
                : 'bg-violet-500/20 text-violet-300 border-violet-500/30 hover:bg-violet-500/30'
            }`}
          >
            {deployState === 'building' ? 'Building...'  :
             deployState === 'done'     ? 'Deployed!'    :
             deployState === 'error'    ? 'Build failed' : 'Deploy to Game'}
          </button>
        )}
      </div>
      {recoveryBanner}
      <EditorErrorBoundary>
        {children}
      </EditorErrorBoundary>
      {showShortcuts && shortcuts && (
        <ShortcutsOverlay shortcuts={shortcuts} onClose={() => setShowShortcuts(false)} />
      )}
    </>
  )
}
