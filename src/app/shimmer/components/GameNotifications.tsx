'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type NotificationKind = 'item' | 'xp' | 'level_up' | 'milestone' | 'warning' | 'generic'

export interface GameNotification {
  id: number
  kind: NotificationKind
  message: string
  color?: string
  duration: number
}

export interface XpFloater {
  id: number
  worldX: number
  worldY: number
  amount: number
  color: string
}

const MAX_NOTIFICATIONS = 4
const XP_FLOATER_MS = 1200

function defaultDuration(kind: NotificationKind): number {
  switch (kind) {
    case 'item': return 2000
    case 'xp': return 1400
    case 'level_up': return 3500
    case 'milestone': return 5000
    case 'warning': return 2200
    default: return 2500
  }
}

export interface GameFeed {
  notifications: GameNotification[]
  floaters: XpFloater[]
  notify: (kind: NotificationKind, message: string, opts?: { color?: string; duration?: number }) => void
  floatXp: (worldX: number, worldY: number, amount: number, color: string) => void
}

export function useGameFeed(): GameFeed {
  const [notifications, setNotifications] = useState<GameNotification[]>([])
  const [floaters, setFloaters] = useState<XpFloater[]>([])
  const idRef = useRef(0)

  const notify = useCallback<GameFeed['notify']>((kind, message, opts = {}) => {
    const duration = opts.duration ?? defaultDuration(kind)
    const n: GameNotification = {
      id: ++idRef.current,
      kind,
      message,
      color: opts.color,
      duration,
    }
    setNotifications(prev => {
      const next = [...prev, n]
      return next.length > MAX_NOTIFICATIONS ? next.slice(next.length - MAX_NOTIFICATIONS) : next
    })
    setTimeout(() => {
      setNotifications(prev => prev.filter(x => x.id !== n.id))
    }, duration)
  }, [])

  const floatXp = useCallback<GameFeed['floatXp']>((worldX, worldY, amount, color) => {
    const f: XpFloater = {
      id: ++idRef.current,
      worldX,
      worldY,
      amount,
      color,
    }
    setFloaters(prev => [...prev, f])
    setTimeout(() => {
      setFloaters(prev => prev.filter(x => x.id !== f.id))
    }, XP_FLOATER_MS)
  }, [])

  return { notifications, floaters, notify, floatXp }
}

function toastStyle(n: GameNotification): { className: string; style: React.CSSProperties } {
  if (n.kind === 'milestone') {
    const c = n.color ?? '#d4a843'
    return {
      className: 'shimmer-toast shimmer-toast-milestone px-3.5 py-1.5 rounded-lg font-display tracking-wider',
      style: {
        color: c,
        backgroundColor: 'rgba(0,0,0,0.78)',
        border: `1.5px solid ${c}`,
        boxShadow: `0 0 18px ${c}66, inset 0 0 8px ${c}22`,
        fontSize: 14,
      },
    }
  }
  if (n.kind === 'level_up') {
    const c = n.color ?? '#d4a843'
    return {
      className: 'shimmer-toast shimmer-toast-levelup px-2.5 py-1 rounded-md font-display tracking-wide',
      style: {
        color: c,
        backgroundColor: 'rgba(0,0,0,0.72)',
        border: `1px solid ${c}`,
        boxShadow: `0 0 10px ${c}44`,
        fontSize: 13,
      },
    }
  }
  if (n.kind === 'warning') {
    return {
      className: 'shimmer-toast px-2 py-0.5 rounded font-display',
      style: {
        color: '#ffd4d4',
        backgroundColor: 'rgba(140, 40, 40, 0.78)',
        fontSize: 12,
      },
    }
  }
  return {
    className: 'shimmer-toast px-2 py-0.5 rounded font-display',
    style: {
      color: n.color ?? '#d4a843',
      backgroundColor: 'rgba(0,0,0,0.6)',
      fontSize: 12,
    },
  }
}

export function NotificationStack({ notifications }: { notifications: GameNotification[] }) {
  return (
    <div className="absolute top-12 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 pointer-events-none">
      {notifications.map(n => {
        const s = toastStyle(n)
        return (
          <div key={n.id} className={s.className} style={s.style}>
            {n.message}
          </div>
        )
      })}
    </div>
  )
}

export function XpFloaterLayer({
  floaters,
  cameraRef,
  worldWidth,
  worldHeight,
}: {
  floaters: XpFloater[]
  cameraRef: React.RefObject<{ camX: number; camY: number } | null>
  worldWidth: number
  worldHeight: number
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const floatersRef = useRef(floaters)
  floatersRef.current = floaters

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const cam = cameraRef.current
      const container = containerRef.current
      if (cam && container) {
        const children = container.children
        const list = floatersRef.current
        for (let i = 0; i < children.length && i < list.length; i++) {
          const f = list[i]
          const el = children[i] as HTMLElement
          const left = ((f.worldX - cam.camX) / worldWidth) * 100
          const top = ((f.worldY - cam.camY) / worldHeight) * 100
          el.style.left = `${left}%`
          el.style.top = `${top}%`
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [cameraRef, worldWidth, worldHeight])

  return (
    <div ref={containerRef} className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
      {floaters.map(f => (
        <div
          key={f.id}
          className="shimmer-xp-floater absolute"
          style={{
            color: f.color,
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'var(--font-display, inherit)',
            textShadow: '0 0 3px rgba(0,0,0,0.95), 0 1px 2px rgba(0,0,0,0.9)',
            whiteSpace: 'nowrap',
          }}
        >
          +{f.amount} XP
        </div>
      ))}
    </div>
  )
}
