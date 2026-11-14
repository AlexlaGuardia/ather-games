'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// The open world is keyboard + mouse for now (pointer lock). Play on the landing page is the front door, so a phone
// that taps it lands in a game it cannot drive. Until the touch pass lands, say so plainly and offer the way back.
// Shown only to devices with NO fine pointer at all (a tablet with a trackpad or a touch laptop still plays).
// Dismissable: "Look around anyway" lets a curious phone see the place.

export function DesktopNotice() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const touchOnly = window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches
    setShow(touchOnly)
  }, [])
  if (!show) return null
  const gold = '#d4a843'
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(5,6,14,0.82)', backdropFilter: 'blur(6px)' }}>
      <div style={{ maxWidth: 340, width: '100%', padding: '22px 20px', borderRadius: 12, border: `1px solid ${gold}55`, background: '#0b0d18', color: '#e8e4d8', textAlign: 'center', font: '15px/1.5 system-ui' }}>
        <div style={{ color: gold, font: '600 11px system-ui', letterSpacing: '0.28em', textTransform: 'uppercase' }}>Best on a computer</div>
        <p style={{ margin: '12px 0 0' }}>Ather plays with a keyboard and mouse for now. Phone controls are on the way.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
          <Link href="/" style={{ padding: '12px 16px', borderRadius: 8, background: gold, color: '#05060e', font: '700 13px system-ui', letterSpacing: '0.16em', textTransform: 'uppercase', textDecoration: 'none' }}>Back to ather.games</Link>
          <button onClick={() => setShow(false)} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#a9a5b8', font: '13px system-ui' }}>Look around anyway</button>
        </div>
      </div>
    </div>
  )
}
