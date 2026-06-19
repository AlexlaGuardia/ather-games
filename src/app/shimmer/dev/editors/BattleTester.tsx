'use client'

import { useState, useCallback, useRef } from 'react'
import EditorShell from '../templates/EditorShell'
import type { Species, Element, Temperament } from '../../spirits/spirit'
import { createSpirit, ELEMENTS, speciesDisplayName } from '../../spirits/spirit'
import type { AITier } from '../../engine/battle-ai'
import { getMovesForSpirit, toBattleElement, SPECIES_SIGNATURES } from '../../engine/moves'
import { derivePartyStats } from '../../engine/party-stats'
import type { SpriteAnim } from '../../sprites/sprite-data'
import { PALETTES, getEvolvedPalette } from '../../sprites/palette'
import { drawSprite } from '../../components/SpriteRenderers'
import BattleScene from '../../components/BattleScene'
import BattleSceneV2 from '../../components/BattleSceneV2'
import PartyBattleScene from '../../components/PartyBattleScene'
import { DEFAULT_LAYOUT } from '../../components/BattleScene'
import type { BattleLayout } from '../../components/BattleScene'
import BattleBgEditor from '../../components/BattleBgEditor'
import type { BattleRewards } from '../../engine/battle'

// Sprite imports (same as page.tsx)
import { FOX_SPRITES } from '../../sprites/fox'
import { AXOLOTL_SPRITES } from '../../sprites/axolotl'
import { WATER_BEAR_SPRITES } from '../../sprites/water-bear'
import { TURTLE_SPRITES } from '../../sprites/turtle'
import { OWL_SPRITES } from '../../sprites/owl'
import { FROG_SPRITES } from '../../sprites/frog'
import { FIREFLY_SPRITES } from '../../sprites/firefly'
import { RABBIT_SPRITES } from '../../sprites/rabbit'
import { HUMMINGBIRD_SPRITES } from '../../sprites/hummingbird'
import { BAT_SPRITES } from '../../sprites/bat'

const SPRITE_MAP: Record<string, Record<string, SpriteAnim>> = {
  fox: FOX_SPRITES, axolotl: AXOLOTL_SPRITES, 'water-bear': WATER_BEAR_SPRITES,
  turtle: TURTLE_SPRITES, owl: OWL_SPRITES, frog: FROG_SPRITES,
  firefly: FIREFLY_SPRITES, rabbit: RABBIT_SPRITES, hummingbird: HUMMINGBIRD_SPRITES,
  bat: BAT_SPRITES,
}

const ALL_SPECIES: Species[] = ['fox', 'axolotl', 'owl', 'frog', 'firefly', 'rabbit', 'water-bear', 'hummingbird', 'turtle', 'bat']
const ALL_ELEMENTS: Element[] = ['base', 'mana', 'storm', 'earth', 'water']
const ALL_TIERS: AITier[] = ['wild', 'trained', 'champion']
const TEMPERAMENTS: Temperament[] = ['bold', 'calm', 'swift', 'sturdy', 'bright', 'neutral']

const ELEMENT_COLORS: Record<string, string> = {
  base: '#d4a843', mana: '#9a6aaa', storm: '#4a6aaa', earth: '#8a6a3a', water: '#3a7a7a',
}

// ──────────────────────────────────────────
// Sprite Preview
// ──────────────────────────────────────────

function SpritePreview({ species }: { species: Species }) {
  return (
    <canvas
      ref={el => {
        if (!el) return
        const a = SPRITE_MAP[species]?.battle_front ?? SPRITE_MAP[species]?.down_idle ?? SPRITE_MAP[species]?.idle
        const ss = a ? Math.round(Math.sqrt(a.frames[0].length)) || 32 : 32
        el.width = ss; el.height = ss
        const ctx = el.getContext('2d')!
        ctx.imageSmoothingEnabled = false
        ctx.clearRect(0, 0, ss, ss)
        if (a) {
          const p = PALETTES[species]?.base ?? ['#888', '#aaa', '#ccc']
          drawSprite(ctx, a.frames[0], p, 0, 0, 'normal', false)
        }
      }}
      style={{ imageRendering: 'pixelated', width: 48, height: 48 }}
    />
  )
}

// ──────────────────────────────────────────
// Battle Sprite Preview (for bg editor overlay)
// ──────────────────────────────────────────

function BattleSpritePreview({ species, element = 'base', facing = 'down', size = 96, flip = false }: {
  species: Species
  element?: string
  facing?: 'up' | 'down'
  size?: number
  flip?: boolean
}) {
  return (
    <canvas
      ref={el => {
        if (!el) return
        const spriteData = SPRITE_MAP[species]
        const battleKey = facing === 'up' ? 'battle_back' : 'battle_front'
        const legacyKey = facing === 'up' ? 'up_idle' : 'down_idle'
        const anim = spriteData?.[battleKey] ?? spriteData?.[legacyKey] ?? spriteData?.idle
        const ss = anim ? Math.round(Math.sqrt(anim.frames[0].length)) || 32 : 32
        el.width = ss; el.height = ss
        const ctx = el.getContext('2d')!
        ctx.imageSmoothingEnabled = false
        ctx.clearRect(0, 0, ss, ss)
        if (anim) {
          const palette = element !== 'base'
            ? getEvolvedPalette(species, element)
            : (PALETTES[species]?.base ?? ['#888', '#aaa', '#ccc'])
          drawSprite(ctx, anim.frames[0], palette, 0, 0, 'normal', flip)
        }
      }}
      style={{ imageRendering: 'pixelated', width: size, height: size, display: 'block' }}
    />
  )
}

// ──────────────────────────────────────────
// Spirit Config Panel
// ──────────────────────────────────────────

interface SpiritConfig {
  species: Species
  element: Element
  level: number
  bond: number
  temperament: Temperament
}

function SpiritPanel({ label, config, onChange }: {
  label: string
  config: SpiritConfig
  onChange: (c: SpiritConfig) => void
}) {
  const spirit = createSpirit(config.species, config.species, 0, 0)
  spirit.level = config.level
  spirit.element = config.element
  spirit.bond = config.bond
  spirit.temperament = config.temperament
  const stats = derivePartyStats(spirit) // party model (6-stat phys/spirit split) — what Party fights use
  const hp = stats.maxHp
  const bElement = toBattleElement(config.element)
  const moves = getMovesForSpirit(config.species, config.element, config.level, config.bond)
  const hasSig = SPECIES_SIGNATURES[config.species]?.[bElement as Exclude<typeof bElement, 'neutral'>]

  return (
    <div className="bg-[#0d0d1a] border border-white/10 rounded-lg p-4 flex-1 min-w-[280px]">
      <h3 className="font-display text-[13px] text-[#d4a843] mb-3">{label}</h3>

      {/* Species grid */}
      <div className="grid grid-cols-5 gap-1 mb-3">
        {ALL_SPECIES.map(s => (
          <button
            key={s}
            onClick={() => onChange({ ...config, species: s })}
            className={`flex flex-col items-center gap-0.5 p-1.5 rounded transition-all ${
              config.species === s
                ? 'bg-[#d4a843]/15 border border-[#d4a843]/40'
                : 'hover:bg-white/5 border border-transparent'
            }`}
          >
            <SpritePreview species={s} />
            <span className="text-[8px] text-white/50 capitalize">{s.replace('-', ' ')}</span>
          </button>
        ))}
      </div>

      {/* Element */}
      <div className="flex gap-1 mb-3">
        {ALL_ELEMENTS.map(e => (
          <button
            key={e}
            onClick={() => onChange({ ...config, element: e })}
            className={`px-2.5 py-1 rounded text-[10px] font-display uppercase tracking-wider transition-all ${
              config.element === e
                ? 'border border-current'
                : 'opacity-40 hover:opacity-70 border border-transparent'
            }`}
            style={{ color: ELEMENT_COLORS[e] }}
          >
            {e}
          </button>
        ))}
      </div>

      {/* Level + Bond sliders */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-[9px] text-white/30 block mb-1">Level: {config.level}</label>
          <input type="range" min={1} max={100} value={config.level}
            onChange={e => onChange({ ...config, level: +e.target.value })}
            className="w-full accent-[#d4a843] h-1"
          />
        </div>
        <div>
          <label className="text-[9px] text-white/30 block mb-1">Bond: {config.bond}</label>
          <input type="range" min={0} max={255} value={config.bond}
            onChange={e => onChange({ ...config, bond: +e.target.value })}
            className="w-full accent-[#d4a843] h-1"
          />
        </div>
      </div>

      {/* Temperament */}
      <div className="flex gap-1 mb-3">
        {TEMPERAMENTS.map(t => (
          <button
            key={t}
            onClick={() => onChange({ ...config, temperament: t })}
            className={`px-2 py-0.5 rounded text-[9px] transition-all ${
              config.temperament === t
                ? 'bg-white/10 text-white/80'
                : 'text-white/25 hover:text-white/50'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Stats preview — 6-stat party model (phys/spirit split) */}
      <div className="bg-black/30 rounded p-2 mb-2">
        <div className="grid grid-cols-7 gap-1 text-center">
          <div><span className="text-[8px] text-white/25 block">HP</span><span className="text-[11px] text-white/70 font-mono">{hp}</span></div>
          <div><span className="text-[8px] text-[#d08858] block" title="Physical Attack">PWR</span><span className="text-[11px] text-white/70 font-mono">{stats.pwr}</span></div>
          <div><span className="text-[8px] text-[#d08858] block" title="Physical Defense">GRD</span><span className="text-[11px] text-white/70 font-mono">{stats.grd}</span></div>
          <div><span className="text-[8px] text-[#9a7ad0] block" title="Spirit Attack">FOC</span><span className="text-[11px] text-white/70 font-mono">{stats.foc}</span></div>
          <div><span className="text-[8px] text-[#9a7ad0] block" title="Spirit Defense">RES</span><span className="text-[11px] text-white/70 font-mono">{stats.res}</span></div>
          <div><span className="text-[8px] text-white/25 block" title="Speed + Evasion">AGI</span><span className="text-[11px] text-white/70 font-mono">{stats.agi}</span></div>
          <div><span className="text-[8px] text-white/25 block" title="Vigor (HP)">VIG</span><span className="text-[11px] text-white/70 font-mono">{stats.vig}</span></div>
        </div>
      </div>

      {/* Moves preview */}
      <div className="space-y-1">
        {moves.map(mv => (
          <div key={mv.id} className="flex items-center justify-between text-[10px] px-1.5 py-0.5 rounded bg-black/20">
            <div className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ backgroundColor: ELEMENT_COLORS[mv.element] ?? '#666' }}
              />
              <span className="text-white/70">{mv.name}</span>
              {hasSig && mv.id === hasSig.id && (
                <span className="text-[7px] text-[#d4a843]/50 uppercase">sig</span>
              )}
            </div>
            <span className="text-white/25 font-mono">
              {mv.power > 0 ? mv.power : 'sts'} · {mv.pp}pp
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────
// Battle Tester (main export)
// ──────────────────────────────────────────

export default function BattleTester() {
  const [player, setPlayer] = useState<SpiritConfig>({
    species: 'fox', element: 'mana', level: 25, bond: 60, temperament: 'bold',
  })
  const [enemy, setEnemy] = useState<SpiritConfig>({
    species: 'owl', element: 'storm', level: 25, bond: 30, temperament: 'neutral',
  })
  const [aiTier, setAITier] = useState<AITier>('trained')
  const [sceneZone, setSceneZone] = useState('garden')
  const [layout, setLayout] = useState<BattleLayout>({ ...DEFAULT_LAYOUT })
  const [showPreview, setShowPreview] = useState(false)
  const [battleActive, setBattleActive] = useState(false)
  const [partyActive, setPartyActive] = useState(false)
  const [partySize, setPartySize] = useState(3)
  const [useV2, setUseV2] = useState(true)
  const [reachMode, setReachMode] = useState(false)
  const [lastResult, setLastResult] = useState<{ outcome: string; rewards?: BattleRewards } | null>(null)

  const buildSpirit = useCallback((cfg: SpiritConfig, name: string) => {
    const s = createSpirit(cfg.species, name, 0, 0)
    s.level = cfg.level
    s.element = cfg.element
    s.bond = cfg.bond
    s.temperament = cfg.temperament
    // Randomize seeds for variety
    s.seeds = Array.from({ length: 6 }, () => Math.floor(Math.random() * 32))
    return s
  }, [])

  const startFight = useCallback(() => {
    setLastResult(null)
    setBattleActive(true)
  }, [])

  // Build a party from the lead config + N-1 random members (varied species/element).
  const buildParty = useCallback((lead: SpiritConfig, side: 'ally' | 'enemy', n: number) => {
    const out = [buildSpirit(lead, `${side === 'ally' ? 'My' : 'Wild'} ${speciesDisplayName(lead.species)}`)]
    for (let i = 1; i < n; i++) {
      const species = ALL_SPECIES[Math.floor(Math.random() * ALL_SPECIES.length)]
      const element = ALL_ELEMENTS[1 + Math.floor(Math.random() * 4)]
      const cfg: SpiritConfig = {
        species, element,
        level: Math.max(5, lead.level + Math.floor(Math.random() * 11) - 5),
        bond: Math.floor(Math.random() * 100),
        temperament: TEMPERAMENTS[Math.floor(Math.random() * TEMPERAMENTS.length)],
      }
      out.push(buildSpirit(cfg, `${side === 'ally' ? 'My' : 'Wild'} ${speciesDisplayName(species)}`))
    }
    return out
  }, [buildSpirit])

  const partyRef = useRef<{ allies: ReturnType<typeof buildSpirit>[]; enemies: ReturnType<typeof buildSpirit>[] } | null>(null)
  const startParty = useCallback(() => {
    setLastResult(null)
    partyRef.current = {
      allies: buildParty(player, 'ally', partySize),
      enemies: buildParty(enemy, 'enemy', partySize),
    }
    setPartyActive(true)
  }, [player, enemy, partySize, buildParty])

  const handlePartyEnd = useCallback((outcome: 'win' | 'lose') => {
    setPartyActive(false)
    setLastResult({ outcome })
  }, [])

  const handleEnd = useCallback((outcome: 'win' | 'lose' | 'flee', rewards?: BattleRewards) => {
    setBattleActive(false)
    setLastResult({ outcome, rewards })
  }, [])

  const randomize = useCallback((side: 'player' | 'enemy') => {
    const species = ALL_SPECIES[Math.floor(Math.random() * ALL_SPECIES.length)]
    const element = ALL_ELEMENTS[1 + Math.floor(Math.random() * 4)] // skip 'base'
    const level = 5 + Math.floor(Math.random() * 60)
    const bond = Math.floor(Math.random() * 100)
    const temperament = TEMPERAMENTS[Math.floor(Math.random() * TEMPERAMENTS.length)]
    const cfg: SpiritConfig = { species, element, level, bond, temperament }
    if (side === 'player') setPlayer(cfg)
    else setEnemy(cfg)
  }, [])

  const battleHeaderActions = (
    <div className="flex gap-2 items-center">
      {/* Scene selector */}
      <span className="text-[9px] text-white/30">Scene:</span>
      <select
        value={sceneZone}
        onChange={e => setSceneZone(e.target.value)}
        className="bg-[#0d0d1a] border border-white/10 rounded px-2 py-1 text-[10px] text-white/70 font-display appearance-none cursor-pointer hover:border-[#d4a843]/30 transition-all"
      >
        <option value="garden">Shimmer Garden</option>
        <option value="mycelial-path">Mycelial Foothold</option>
        <option value="moonwell-glade">Moonwell Castle</option>
        <option value="spore-hollow">Spore Hollow</option>
        <option value="twilight-thicket">Twilight Thicket</option>
        <option value="the-threshold">The Threshold</option>
        <option value="mana-springs">Mana Springs</option>
        <option value="spirit-meadow">Spirit Meadow</option>
      </select>

      <span className="text-white/10 mx-1">|</span>

      {/* Renderer toggle */}
      <button
        onClick={() => setUseV2(v => !v)}
        className={`px-3 py-1 rounded text-[10px] font-display transition-all ${
          useV2
            ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
            : 'text-white/30 hover:text-white/50 border border-white/10'
        }`}
      >
        {useV2 ? 'V2 (PixiJS)' : 'V1 (Legacy)'}
      </button>

      {/* Reach-encounter toggle — free a collared spirit by reaching, not KO'ing */}
      <button
        onClick={() => setReachMode(v => !v)}
        title="Reach encounter: the foe is a collared spirit. Fill its REACH bar with Still-Breath / Spirit Ward to free it. KO'ing it (or losing your nerve) fails."
        className={`px-3 py-1 rounded text-[10px] font-display transition-all ${
          reachMode
            ? 'bg-[#37e6ff]/15 text-[#37e6ff] border border-[#37e6ff]/50'
            : 'text-white/30 hover:text-white/50 border border-white/10'
        }`}
      >
        {reachMode ? '◇ Reach: ON' : '◇ Reach'}
      </button>

      <span className="text-white/10 mx-1">|</span>

      {/* AI Tier selector */}
      <span className="text-[9px] text-white/30">AI:</span>
      {ALL_TIERS.map(t => (
        <button
          key={t}
          onClick={() => setAITier(t)}
          className={`px-3 py-1 rounded text-[10px] font-display capitalize transition-all ${
            aiTier === t
              ? 'bg-[#d4a843]/15 text-[#d4a843] border border-[#d4a843]/40'
              : 'text-white/30 hover:text-white/50 border border-transparent'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  )

  return (
    <EditorShell
      title="Battle Tester"
      subtitle="Spirit combat simulation"
      headerActions={battleHeaderActions}
    >
      {/* Battle overlay */}
      {battleActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="relative" style={{ width: 480, height: 384 }}>
            {useV2 ? (
              <BattleSceneV2
                playerSpirit={buildSpirit(player, `My ${speciesDisplayName(player.species)}`)}
                enemySpirit={buildSpirit(enemy, reachMode ? `Collared ${speciesDisplayName(enemy.species)}` : `Wild ${speciesDisplayName(enemy.species)}`)}
                aiTier={aiTier}
                zoneId={sceneZone}
                sprites={SPRITE_MAP}
                mode={reachMode ? 'reach' : 'standard'}
                onEnd={handleEnd}
              />
            ) : (
              <BattleScene
                playerSpirit={buildSpirit(player, `My ${speciesDisplayName(player.species)}`)}
                enemySpirit={buildSpirit(enemy, `Wild ${speciesDisplayName(enemy.species)}`)}
                aiTier={aiTier}
                zoneId={sceneZone}
                layout={layout}
                sprites={SPRITE_MAP}
                onEnd={handleEnd}
              />
            )}
          </div>
        </div>
      )}

      {/* Party battle overlay (N-per-side) */}
      {partyActive && partyRef.current && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="relative" style={{ width: 480, height: 398 }}>
            <PartyBattleScene
              allySpirits={partyRef.current.allies}
              enemySpirits={partyRef.current.enemies}
              zoneId={sceneZone}
              reach={reachMode}
              ai={{
                focusFire: aiTier !== 'wild',
                spendMana: aiTier !== 'wild',
              }}
              onEnd={handlePartyEnd}
            />
          </div>
        </div>
      )}

      {/* Two panels side by side */}
      <div className="flex gap-4 mb-4">
        <SpiritPanel label="Your Spirit" config={player} onChange={setPlayer} />
        <div className="flex flex-col items-center justify-center gap-2">
          <span className="text-[20px] text-white/20 font-display">VS</span>
        </div>
        <SpiritPanel label="Enemy Spirit" config={enemy} onChange={setEnemy} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={startFight}
          className="px-6 py-2.5 bg-[#d4a843]/20 hover:bg-[#d4a843]/30 border border-[#d4a843]/40 rounded-lg text-[#d4a843] font-display text-[13px] transition-all"
        >
          Start Battle
        </button>

        {/* Party (N-per-side) launch — the new FF-style team combat */}
        <button
          onClick={startParty}
          className="px-5 py-2.5 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/40 rounded-lg text-violet-300 font-display text-[13px] transition-all"
          title="FF-style party turn-based battle. Lead = your configured spirit; the rest are random members."
        >
          Party {partySize}v{partySize}
        </button>
        <div className="flex gap-0.5">
          {[2, 3, 4].map(n => (
            <button key={n} onClick={() => setPartySize(n)}
              className={`px-2 py-1 rounded text-[10px] font-mono transition-all ${
                partySize === n ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40' : 'text-white/30 hover:text-white/50 border border-white/10'
              }`}
            >{n}</button>
          ))}
        </div>
        <button
          onClick={() => randomize('player')}
          className="px-3 py-2 text-[10px] text-white/30 hover:text-white/50 border border-white/10 rounded transition-all"
        >
          Randomize Yours
        </button>
        <button
          onClick={() => randomize('enemy')}
          className="px-3 py-2 text-[10px] text-white/30 hover:text-white/50 border border-white/10 rounded transition-all"
        >
          Randomize Enemy
        </button>
        <button
          onClick={() => { randomize('player'); randomize('enemy') }}
          className="px-3 py-2 text-[10px] text-white/30 hover:text-white/50 border border-white/10 rounded transition-all"
        >
          Randomize Both
        </button>

        {/* Last result */}
        {lastResult && (
          <div className="ml-auto text-[11px] flex items-center gap-2">
            <span className={`font-display ${
              lastResult.outcome === 'win' ? 'text-green-400' :
              lastResult.outcome === 'lose' ? 'text-red-400' : 'text-white/40'
            }`}>
              {lastResult.outcome.toUpperCase()}
            </span>
            {lastResult.rewards && (
              <span className="text-white/25">
                +{lastResult.rewards.xp}xp · +{lastResult.rewards.gold}g · +{lastResult.rewards.bondChange}bond
              </span>
            )}
          </div>
        )}
      </div>

      {/* Layout Editor + Live Preview */}
      <div className="mt-4 bg-[#0d0d1a] border border-white/10 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-[13px] text-[#d4a843]">Layout Editor</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPreview(p => !p)}
              className={`px-3 py-1 rounded text-[10px] font-display transition-all ${
                showPreview
                  ? 'bg-[#d4a843]/15 text-[#d4a843] border border-[#d4a843]/40'
                  : 'text-white/30 hover:text-white/50 border border-white/10'
              }`}
            >
              {showPreview ? 'Hide Preview' : 'Live Preview'}
            </button>
            <button
              onClick={() => setLayout({ ...DEFAULT_LAYOUT })}
              className="px-3 py-1 rounded text-[10px] text-white/25 hover:text-white/50 border border-white/10 transition-all"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Sprite Positioning */}
        <p className="text-[9px] text-white/20 uppercase tracking-wider mb-2">Sprite Positions</p>
        <div className="grid grid-cols-5 gap-4 mb-4">
          {([
            ['enemyTop', 'Enemy Y (%)', 0, 60, '%'],
            ['enemyRight', 'Enemy X (px)', 0, 200, 'px'],
            ['playerBottom', 'Player Y (px)', 0, 80, 'px'],
            ['playerLeft', 'Player X (px)', 0, 200, 'px'],
          ] as const).map(([key, label, min, max, unit]) => (
            <div key={key}>
              <label className="text-[9px] text-white/30 block mb-1">
                {label}: {layout[key]}{unit}
              </label>
              <input
                type="range"
                min={min}
                max={max}
                value={layout[key]}
                onChange={e => setLayout(prev => ({ ...prev, [key]: +e.target.value }))}
                className="w-full accent-[#d4a843] h-1"
              />
            </div>
          ))}
        </div>

        {/* Sprite Sizes */}
        <p className="text-[9px] text-white/20 uppercase tracking-wider mb-2">Sprite Sizes</p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {([
            ['enemySpriteSize', 'Enemy Size', 48, 160, 'px'],
            ['playerSpriteSize', 'Player Size', 48, 160, 'px'],
          ] as const).map(([key, label, min, max, unit]) => (
            <div key={key}>
              <label className="text-[9px] text-white/30 block mb-1">
                {label}: {layout[key]}{unit}
              </label>
              <input
                type="range"
                min={min}
                max={max}
                value={layout[key]}
                onChange={e => setLayout(prev => ({ ...prev, [key]: +e.target.value }))}
                className="w-full accent-[#d4a843] h-1"
              />
            </div>
          ))}
        </div>

        {/* Info Plate Positions */}
        <p className="text-[9px] text-white/20 uppercase tracking-wider mb-2">Info Plates</p>
        <div className="grid grid-cols-4 gap-4">
          {([
            ['enemyPlateTop', 'Enemy Plate Y (px)', 0, 120, 'px'],
            ['enemyPlateLeft', 'Enemy Plate X (px)', 0, 200, 'px'],
            ['playerPlateBottom', 'Player Plate Y (px)', 0, 120, 'px'],
            ['playerPlateRight', 'Player Plate X (px)', 0, 200, 'px'],
          ] as const).map(([key, label, min, max, unit]) => (
            <div key={key}>
              <label className="text-[9px] text-white/30 block mb-1">
                {label}: {layout[key]}{unit}
              </label>
              <input
                type="range"
                min={min}
                max={max}
                value={layout[key]}
                onChange={e => setLayout(prev => ({ ...prev, [key]: +e.target.value }))}
                className="w-full accent-[#d4a843] h-1"
              />
            </div>
          ))}
        </div>

        {/* Background Editor + Sprite Overlay */}
        {showPreview && (
          <div className="mt-4 relative">
            <BattleBgEditor zoneId={sceneZone} />
            {/* Sprite position overlay — shows where spirits sit on the background */}
            <div className="absolute top-0 left-0 pointer-events-none" style={{ width: 480, height: 288 }}>
              {/* Enemy info plate ghost */}
              <div className="absolute opacity-50 bg-[#0d0d1a]/60 border border-white/10 rounded-lg px-2 py-1" style={{
                top: layout.enemyPlateTop,
                left: layout.enemyPlateLeft,
              }}>
                <span className="text-[8px] text-white/40 font-display">Enemy Plate</span>
              </div>
              {/* Enemy sprite (top-right area) */}
              <div className="absolute leading-none" style={{
                top: `${layout.enemyTop}%`,
                right: layout.enemyRight,
                opacity: 0.7,
              }}>
                <BattleSpritePreview
                  species={enemy.species}
                  element={enemy.element}
                  facing="down"
                  size={layout.enemySpriteSize}
                />
                <div className="w-10 h-1 mx-auto rounded-full bg-black/30" />
              </div>
              {/* Player info plate ghost */}
              <div className="absolute opacity-50 bg-[#0d0d1a]/60 border border-white/10 rounded-lg px-2 py-1" style={{
                bottom: layout.playerPlateBottom,
                right: layout.playerPlateRight,
              }}>
                <span className="text-[8px] text-white/40 font-display">Player Plate</span>
              </div>
              {/* Player sprite (bottom-left area, facing up) */}
              <div className="absolute leading-none" style={{
                bottom: layout.playerBottom,
                left: layout.playerLeft,
                opacity: 0.7,
              }}>
                <BattleSpritePreview
                  species={player.species}
                  element={player.element}
                  facing="up"
                  size={layout.playerSpriteSize}
                  flip
                />
                <div className="w-10 h-1 mx-auto rounded-full bg-black/30" />
              </div>
            </div>
          </div>
        )}
      </div>
    </EditorShell>
  )
}
