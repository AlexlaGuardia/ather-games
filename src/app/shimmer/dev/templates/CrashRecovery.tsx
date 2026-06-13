'use client'

interface CrashRecoveryProps {
  timestamp: number
  onRestore: () => void
  onDiscard: () => void
}

export default function CrashRecovery({ timestamp, onRestore, onDiscard }: CrashRecoveryProps) {
  const timeStr = new Date(timestamp).toLocaleTimeString()

  return (
    <div className="flex items-center gap-3 px-4 py-2 mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10">
      <span className="text-amber-400 text-xs">Unsaved changes found from {timeStr}</span>
      <button
        onClick={onRestore}
        className="px-3 py-1 text-[10px] font-display bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded hover:bg-amber-500/30 transition-colors"
      >
        Restore
      </button>
      <button
        onClick={onDiscard}
        className="px-3 py-1 text-[10px] font-display text-white/40 hover:text-white/60 transition-colors"
      >
        Discard
      </button>
    </div>
  )
}
