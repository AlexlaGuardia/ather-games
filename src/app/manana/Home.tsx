'use client'

// MANA'NANA — home / front door. Three ways in (Story · Endless · Daily) + records.
// The arrival the game was missing; keeps gameplay one tap away, not in-your-face.

interface HomeProps {
  best: number
  dailyBest: number
  muted: boolean
  onStory: () => void
  onEndless: () => void
  onDaily: () => void
  onToggleMute: () => void
}

export default function Home({ best, dailyBest, muted, onStory, onEndless, onDaily, onToggleMute }: HomeProps) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center px-6"
      style={{ background: 'radial-gradient(130% 100% at 50% 15%,#33224a 0%,#1c1430 55%,#120c1c 100%)', color: '#f4ecdf' }}>
      <button onClick={onToggleMute} aria-label={muted ? 'Unmute' : 'Mute'}
        className="absolute right-4 top-4 rounded-lg border border-white/12 bg-white/5 px-3 py-1.5 text-sm active:scale-95">
        {muted ? '🔇' : '🔊'}
      </button>

      <div className="mb-1 text-4xl font-black tracking-wide" style={{ textShadow: '0 0 20px rgba(255,176,32,.4)' }}>Mana&apos;nana</div>
      <div className="mb-10 text-xs uppercase tracking-[0.3em] text-amber-200/50">match the ather</div>

      <div className="flex w-full max-w-[300px] flex-col gap-3">
        <button onClick={onStory}
          className="rounded-2xl px-5 py-4 text-left font-bold active:scale-[0.98] transition-transform"
          style={{ background: 'linear-gradient(135deg,#ffd884,#e0a94b)', color: '#4a3110', boxShadow: '0 4px 18px rgba(224,169,75,.35)' }}>
          <div className="text-lg">Story ›</div>
          <div className="text-[11px] font-medium opacity-70">walk the garden, pitstop by pitstop</div>
        </button>
        <button onClick={onEndless}
          className="rounded-2xl border border-white/12 bg-white/6 px-5 py-3.5 text-left font-bold active:scale-[0.98] transition-transform">
          <div className="flex items-center justify-between text-base">Endless <span className="text-xs font-medium text-amber-200/70">best {best.toLocaleString()}</span></div>
          <div className="text-[11px] font-medium text-slate-400">chase a high score, no limit</div>
        </button>
        <button onClick={onDaily}
          className="rounded-2xl border border-white/12 bg-white/6 px-5 py-3.5 text-left font-bold active:scale-[0.98] transition-transform">
          <div className="flex items-center justify-between text-base">Daily <span className="text-xs font-medium text-amber-200/70">{dailyBest ? `best ${dailyBest.toLocaleString()}` : 'new'}</span></div>
          <div className="text-[11px] font-medium text-slate-400">one board, everyone, today</div>
        </button>
      </div>
    </div>
  )
}
