'use client'

// Mobile-first battle playtest — a clean, thumb-friendly way to FEEL the party combat
// without the thick desktop dev tester. Owner-gated (under /shimmer). URL: /shimmer/play
import { useState, useCallback, useRef } from 'react'
import { createSpirit, speciesDisplayName, ELEMENTS, type Species, type Element } from '../spirits/spirit'
import PartyBattleScene from '../components/PartyBattleScene'
import type { KeeperArchetype } from '../engine/party-battle'

const SPECIES: Species[] = ['fox', 'axolotl', 'owl', 'frog', 'firefly', 'rabbit', 'water-bear', 'hummingbird', 'turtle', 'bat']
const KEEPERS: (KeeperArchetype | null)[] = [null, 'warden', 'mender', 'breaker', 'channeler']

function rng<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)] }

function mkSpirit(lead = false): import('../spirits/spirit').Spirit {
  const sp = rng(SPECIES)
  const s = createSpirit(sp, `${lead ? 'My' : 'Wild'} ${speciesDisplayName(sp)}`, 0, 0)
  s.level = 20 + Math.floor(Math.random() * 9)
  s.element = rng(ELEMENTS) as Element
  s.bond = 40 + Math.floor(Math.random() * 60)
  s.temperament = rng(['bold', 'calm', 'swift', 'sturdy', 'bright', 'neutral']) as never
  s.seeds = Array.from({ length: 6 }, () => Math.floor(Math.random() * 32))
  return s
}

export default function BattlePlaytest() {
  const [size, setSize] = useState(3)
  const [keeper, setKeeper] = useState<KeeperArchetype | null>(null)
  const [reach, setReach] = useState(false)
  const [active, setActive] = useState(false)
  const [last, setLast] = useState<'win' | 'lose' | null>(null)
  const partyRef = useRef<{ allies: ReturnType<typeof mkSpirit>[]; enemies: ReturnType<typeof mkSpirit>[] } | null>(null)

  const fight = useCallback(() => {
    setLast(null)
    partyRef.current = {
      allies: Array.from({ length: size }, () => mkSpirit(true)),
      enemies: Array.from({ length: reach ? size : Math.min(size, 2) }, () => mkSpirit(false)),
    }
    setActive(true)
  }, [size, reach])

  const onEnd = useCallback((outcome: 'win' | 'lose') => { setActive(false); setLast(outcome) }, [])

  if (active && partyRef.current) {
    return (
      <div className="fixed inset-0 bg-black">
        <PartyBattleScene
          allySpirits={partyRef.current.allies}
          enemySpirits={partyRef.current.enemies}
          zoneId="garden"
          reach={reach}
          keeper={keeper ?? undefined}
          ai={{ focusFire: true, spendMana: true }}
          onEnd={onEnd}
        />
      </div>
    )
  }

  const Chip = ({ on, onClick, children, accent = '#d4a843' }: { on: boolean; onClick: () => void; children: React.ReactNode; accent?: string }) => (
    <button onClick={onClick}
      className="flex-1 min-h-[52px] rounded-xl font-display text-[15px] tracking-wide transition-all active:scale-95 border"
      style={{
        background: on ? `${accent}22` : 'rgba(255,255,255,0.03)',
        borderColor: on ? `${accent}66` : 'rgba(255,255,255,0.08)',
        color: on ? accent : 'rgba(255,255,255,0.45)',
      }}
    >{children}</button>
  )

  return (
    <div className="fixed inset-0 bg-[#080810] text-white flex flex-col overflow-y-auto" style={{ WebkitTapHighlightColor: 'transparent' }}>
      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full px-5 py-8 gap-6">
        <div className="text-center">
          <h1 className="font-display text-[26px] text-[#d4a843] tracking-wide">Battle Playtest</h1>
          <p className="text-[12px] text-white/40 mt-1">Pick a setup, then feel the combat.</p>
          {last && (
            <p className={`mt-3 font-display text-[15px] ${last === 'win' ? 'text-green-400' : 'text-red-400'}`}>
              {last === 'win' ? '✦ Victory' : '✕ Defeated'} — tap Fight to go again
            </p>
          )}
        </div>

        <div>
          <p className="text-[11px] text-white/30 uppercase tracking-wider mb-2">Party size</p>
          <div className="flex gap-2">
            {[2, 3, 4].map(n => <Chip key={n} on={size === n} onClick={() => setSize(n)} accent="#c77ce0">{n}v{reach ? n : Math.min(n, 2)}</Chip>)}
          </div>
        </div>

        <div>
          <p className="text-[11px] text-white/30 uppercase tracking-wider mb-2">Keeper (support companion)</p>
          <div className="grid grid-cols-3 gap-2">
            {KEEPERS.map(k => <Chip key={k ?? 'none'} on={keeper === k} onClick={() => setKeeper(k)} accent="#d4a843">
              <span className="capitalize">{k ?? 'none'}</span>
            </Chip>)}
          </div>
        </div>

        <div>
          <p className="text-[11px] text-white/30 uppercase tracking-wider mb-2">Reach encounter (free a collared captive)</p>
          <div className="flex gap-2">
            <Chip on={!reach} onClick={() => setReach(false)} accent="#6aa0c0">Off</Chip>
            <Chip on={reach} onClick={() => setReach(true)} accent="#37e6ff">On</Chip>
          </div>
        </div>

        <button onClick={fight}
          className="min-h-[60px] rounded-2xl font-display text-[20px] tracking-wide bg-[#d4a843]/20 border border-[#d4a843]/50 text-[#d4a843] active:scale-95 transition-all mt-2">
          ⚔ Fight
        </button>
        <p className="text-[10px] text-white/20 text-center">Each round: tap one directive — your spirits follow your lead.</p>
      </div>
    </div>
  )
}
