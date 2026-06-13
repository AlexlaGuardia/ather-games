'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

const PLAYABLE_CHARACTERS = [
  { id: 'alkin', name: 'Alkin' },
  { id: 'kael', name: 'Kael' },
]

const USERNAME_RE = /^[a-zA-Z0-9_]{3,16}$/

interface UsernamePickerProps {
  onComplete: (username: string, characterId: string, userId?: string) => void
}

export default function UsernamePicker({ onComplete }: UsernamePickerProps) {
  const [username, setUsername] = useState('')
  const [characterId, setCharacterId] = useState('alkin')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced availability check
  const checkUsername = useCallback((name: string) => {
    if (checkTimer.current) clearTimeout(checkTimer.current)
    setAvailable(null)
    setError(null)

    if (!name || name.length < 3) {
      setChecking(false)
      return
    }

    if (!USERNAME_RE.test(name)) {
      setError('Letters, numbers, and underscores only')
      setChecking(false)
      return
    }

    setChecking(true)
    checkTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/shimmerfile/check?username=${encodeURIComponent(name)}`)
        const data = await res.json()
        setAvailable(data.available)
        if (!data.available) setError('Username taken')
      } catch {
        setError('Could not check availability')
      }
      setChecking(false)
    }, 400)
  }, [])

  useEffect(() => {
    checkUsername(username)
  }, [username, checkUsername])

  const handleSubmit = async () => {
    if (!USERNAME_RE.test(username) || !available || submitting) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/shimmerfile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, characterId }),
      })
      const data = await res.json()
      if (res.ok) {
        onComplete(data.shimmerfile.username, data.shimmerfile.character_id, data.shimmerfile.user_id)
      } else {
        setError(data.error || 'Failed to create profile')
      }
    } catch {
      setError('Network error')
    }
    setSubmitting(false)
  }

  const valid = USERNAME_RE.test(username) && available === true && !checking

  return (
    <div className="fixed inset-0 z-[60] bg-[#050508]/95 flex items-center justify-center px-6">
      <div className="text-center max-w-md w-full">
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#d4a843] tracking-wide mb-2">
          Your Shimmerfile
        </h2>
        <p className="text-text-dim text-base mb-8">
          Choose your name in the Ather.
        </p>

        {/* Username input */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16))}
              placeholder="Enter a username..."
              className="w-full px-4 py-3 bg-[#16142a] border border-[#d4a843]/25 rounded-lg text-text text-lg text-center font-display tracking-wide placeholder:text-text-faint/40 focus:outline-none focus:border-[#d4a843]/60 transition-colors"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && valid && handleSubmit()}
            />
            {/* Status indicator */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {checking && (
                <span className="text-text-faint text-sm">...</span>
              )}
              {!checking && available === true && username.length >= 3 && (
                <span className="text-green-400 text-sm">&#10003;</span>
              )}
              {!checking && available === false && (
                <span className="text-red-400 text-sm">&#10007;</span>
              )}
            </div>
          </div>
          {error && (
            <p className="text-red-400/80 text-sm mt-2">{error}</p>
          )}
          {username.length > 0 && username.length < 3 && (
            <p className="text-text-faint text-sm mt-2">3 characters minimum</p>
          )}
        </div>

        {/* Character picker */}
        <div className="mb-8">
          <p className="text-text-dim text-sm mb-3">Choose your character</p>
          <div className="flex justify-center gap-3">
            {PLAYABLE_CHARACTERS.map(char => (
              <button
                key={char.id}
                onClick={() => setCharacterId(char.id)}
                className={`px-4 py-2 rounded-lg border font-display text-sm transition-all ${
                  characterId === char.id
                    ? 'border-[#d4a843] bg-[#d4a843]/15 text-[#d4a843]'
                    : 'border-white/10 bg-[#16142a] text-text-dim hover:border-white/20'
                }`}
              >
                {char.name}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!valid || submitting}
          className="px-10 py-3 rounded-lg bg-[#d4a843] text-[#1a1a2e] font-display font-semibold text-lg hover:brightness-110 transition-all shadow-lg shadow-[#d4a843]/25 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {submitting ? 'Creating...' : 'Enter the Ather'}
        </button>

        <p className="text-text-faint/40 text-xs mt-6">
          This name is visible to other players.
        </p>
      </div>
    </div>
  )
}
