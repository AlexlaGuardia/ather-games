'use client'

import { useCallback, useEffect, useState } from 'react'
import EditorShell from '../templates/EditorShell'

interface Finding {
  severity: 'error' | 'warn' | 'info'
  domain: string
  check: string
  message: string
  file?: string
}

interface DoctorReport {
  generatedAt: string
  counts: { error: number; warn: number; info: number }
  findings: Finding[]
}

const SEVERITY_STYLE: Record<Finding['severity'], { dot: string; text: string; label: string }> = {
  error: { dot: 'bg-red-500', text: 'text-red-300', label: 'ERROR' },
  warn: { dot: 'bg-amber-400', text: 'text-amber-200', label: 'WARN' },
  info: { dot: 'bg-sky-400', text: 'text-sky-200', label: 'INFO' },
}

const DOMAIN_LABELS: Record<string, string> = {
  framemaps: 'Frame Maps (editor ↔ save route)',
  registries: 'Character / Species Registries',
  sprites: 'Sprite Wiring',
  palettes: 'Palettes',
  items: 'Item Maps',
  sidecars: 'Sidecar JSON',
  world: 'World Data',
  deploy: 'Deploy Staleness',
  doctor: 'Doctor Internals',
}

export default function DoctorPanel() {
  const [report, setReport] = useState<DoctorReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/shimmer/doctor')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setReport(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { run() }, [run])

  const domains = report
    ? [...new Set(report.findings.map(f => f.domain))]
    : []

  return (
    <EditorShell
      title="Doctor"
      subtitle="Consistency checks across editors, save routes, sprite files, sidecars, and world data"
      loadStatus={loading ? 'Scanning…' : report ? `Scanned ${new Date(report.generatedAt).toLocaleTimeString()}` : undefined}
      headerActions={
        <button
          onClick={run}
          disabled={loading}
          className="text-[10px] px-3 py-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white/80 uppercase tracking-wider"
        >
          {loading ? 'Scanning…' : 'Re-scan'}
        </button>
      }
    >
      <div className="space-y-6 max-w-4xl">
        {error && (
          <div className="text-red-300 text-xs border border-red-500/30 bg-red-500/10 rounded p-3">
            Doctor failed: {error}
          </div>
        )}

        {report && (
          <div className="flex gap-4 items-center">
            {(['error', 'warn', 'info'] as const).map(sev => (
              <div key={sev} className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${SEVERITY_STYLE[sev].dot}`} />
                <span className={`text-xs ${SEVERITY_STYLE[sev].text}`}>
                  {report.counts[sev]} {SEVERITY_STYLE[sev].label.toLowerCase()}
                </span>
              </div>
            ))}
            {report.findings.length === 0 && (
              <span className="text-emerald-300 text-xs">All clear — no desyncs found. 🌿</span>
            )}
          </div>
        )}

        {domains.map(domain => {
          const items = report!.findings.filter(f => f.domain === domain)
          return (
            <div key={domain}>
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
                {DOMAIN_LABELS[domain] ?? domain} ({items.length})
              </div>
              <div className="space-y-1">
                {items.map((f, i) => (
                  <div key={i} className="flex gap-2 items-start text-xs bg-white/[0.03] border border-white/5 rounded px-3 py-2">
                    <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${SEVERITY_STYLE[f.severity].dot}`} />
                    <div className="min-w-0">
                      <span className={SEVERITY_STYLE[f.severity].text}>{f.message}</span>
                      <div className="text-white/30 text-[10px] mt-0.5">
                        {f.check}{f.file ? ` · ${f.file}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </EditorShell>
  )
}
