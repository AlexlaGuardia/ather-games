'use client'
// RuneBadge — the in-world mark of your birth. play3d is first-person, so your chosen rune
// vanishes the moment you spawn; this badge keeps it on the HUD, tinted to its canon color.
// Self-sources the rune from localStorage (ather:shimmer:birthRune) if no runeId is passed,
// so the mechanics HUD can mount it with zero wiring: <RuneBadge /> — or pass birthRuneRef
// .current for instant reactivity. Renders nothing until a rune is chosen.
import { useEffect, useState } from 'react'
import { RUNES } from './runes.data'
import { RuneMark } from './RuneMark'

const STORAGE_KEY = 'ather:shimmer:birthRune'

export default function RuneBadge({
  runeId,
  size = 34,
  showName = false,
  style,
}: {
  /** explicit rune id; omit to read from localStorage */
  runeId?: string | null
  size?: number
  showName?: boolean
  /** positioning override — the mount site decides where on the HUD it sits */
  style?: React.CSSProperties
}) {
  const [selfId, setSelfId] = useState<string | null>(null)
  useEffect(() => {
    if (runeId) return
    try { setSelfId(localStorage.getItem(STORAGE_KEY)) } catch {}
  }, [runeId])

  const id = runeId ?? selfId
  const rune = id ? RUNES.find((r) => r.id === id) : null
  if (!rune) return null

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, pointerEvents: 'none',
      ...style,
    }}>
      <div style={{
        width: size + 12, height: size + 12, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `radial-gradient(circle at 50% 42%, ${rune.glow}33 0%, transparent 70%)`,
        border: `1px solid ${rune.glow}66`,
        boxShadow: `0 0 12px -2px ${rune.glow}88`,
      }}>
        <RuneMark rune={rune} size={size} />
      </div>
      {showName && (
        <span style={{
          font: '700 11px ui-monospace, monospace', letterSpacing: '.08em',
          color: rune.glow, textShadow: `0 0 8px ${rune.glow}88`,
        }}>{rune.name}</span>
      )}
    </div>
  )
}
