'use client'

// Dismissible overlay panel — the "hero + overlays" model. The hall's visual owns
// the screen; deep/secondary controls (roster, workshop, records, results) open as
// these panels on top and dismiss, so nothing has to stack into a page scroll.
//
// Scrim click + Esc close. The card itself scrolls internally when its content is
// tall, so a long list never grows the page. Accent tints the frame per hall.

import { useEffect } from 'react'

export default function Panel({
  title,
  accent = '#a78bfa',
  onClose,
  children,
  wide = false,
}: {
  title: string
  accent?: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div
        className={`relative w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[82vh] overflow-y-auto rounded-lg border bg-[#0b101c]/97 p-4 shadow-[0_0_50px_rgba(0,0,0,0.6)]`}
        style={{ borderColor: `${accent}55` }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xs tracking-[0.25em]" style={{ color: accent }}>{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="text-slate-500 hover:text-slate-200 text-base leading-none transition-colors"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
