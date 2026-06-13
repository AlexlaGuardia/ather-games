'use client'

import { useState, useCallback, useRef, useEffect, useMemo, type ReactNode, type ComponentType } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import CommandPalette from './templates/CommandPalette'
import InspectorSidebar from './templates/InspectorSidebar'
import { InspectorContext } from './templates/inspector-context'

const SpriteEditor = dynamic(() => import('./editors/SpriteEditor'))
const PlayerEditor = dynamic(() => import('./editors/PlayerEditor'))
const MapEditor = dynamic(() => import('./editors/MapEditor'))
const BattleTester = dynamic(() => import('./editors/BattleTester'))
const ItemEditor = dynamic(() => import('./editors/ItemEditor'))
const NodeEditor = dynamic(() => import('./editors/NodeEditor'))
const BeastEditor = dynamic(() => import('./editors/BeastEditor'))
const BannerEditor = dynamic(() => import('./editors/BannerEditor'))
const FurnitureEditor = dynamic(() => import('./editors/FurnitureEditor'))
const StructureBuilder = dynamic(() => import('./editors/StructureBuilder'))
const FarmingEditor = dynamic(() => import('./editors/FarmingEditor'))
const GEEditor = dynamic(() => import('./editors/GEEditor'))
const EncounterEditor = dynamic(() => import('./editors/EncounterEditor'))
const AlchemyEditor = dynamic(() => import('./editors/AlchemyEditor'))
const QuestEditor = dynamic(() => import('./editors/QuestEditor'))
const SpinnerEditor = dynamic(() => import('./editors/SpinnerEditor'))
const EvolutionEditor = dynamic(() => import('./editors/EvolutionEditor'))
const ResourcesEditor = dynamic(() => import('./editors/ResourcesEditor'))
const ToolsEditor = dynamic(() => import('./editors/ToolsEditor'))
const SkillsEditor = dynamic(() => import('./editors/SkillsEditor'))
const MovesEditor = dynamic(() => import('./editors/MovesEditor'))
const VoiceProfilesEditor = dynamic(() => import('./editors/VoiceProfilesEditor'))
const NPCEditor = dynamic(() => import('./editors/NPCEditor'))
const DayCycleEditor = dynamic(() => import('./editors/DayCycleEditor'))
const ManaEditor = dynamic(() => import('./editors/ManaEditor'))
const PuppetEditor = dynamic(() => import('./editors/PuppetEditor'))
const GrimoireEditor = dynamic(() => import('./editors/GrimoireEditor'))
const WeatherEditor = dynamic(() => import('./editors/WeatherEditor'))
const DoctorPanel = dynamic(() => import('./editors/DoctorPanel'))

type EditorMode = 'sprites' | 'player' | 'map' | 'battle' | 'items' | 'nodes' | 'beasts' | 'banner' | 'furniture' | 'structures' | 'farming' | 'exchange' | 'encounters' | 'alchemy' | 'quests' | 'spinner' | 'evolution' | 'resources' | 'tools' | 'skills' | 'moves' | 'voices' | 'npcs' | 'daycycle' | 'mana' | 'puppet' | 'grimoire' | 'weather' | 'doctor'

// Component map — replaces 25 conditional renders
const EDITOR_MAP: Record<EditorMode, { component: ComponentType<any>; deployable: boolean }> = {
  sprites:    { component: SpriteEditor,        deployable: true },
  player:     { component: PlayerEditor,        deployable: true },
  beasts:     { component: BeastEditor,         deployable: true },
  items:      { component: ItemEditor,          deployable: true },
  furniture:  { component: FurnitureEditor,     deployable: true },
  nodes:      { component: NodeEditor,          deployable: true },
  map:        { component: MapEditor,           deployable: false },
  structures: { component: StructureBuilder,    deployable: false },
  npcs:       { component: NPCEditor,          deployable: true },
  battle:     { component: BattleTester,        deployable: false },
  moves:      { component: MovesEditor,         deployable: true },
  farming:    { component: FarmingEditor,       deployable: true },
  exchange:   { component: GEEditor,            deployable: true },
  encounters: { component: EncounterEditor,     deployable: true },
  alchemy:    { component: AlchemyEditor,       deployable: true },
  quests:     { component: QuestEditor,         deployable: true },
  evolution:  { component: EvolutionEditor,     deployable: true },
  resources:  { component: ResourcesEditor,     deployable: true },
  tools:      { component: ToolsEditor,         deployable: true },
  skills:     { component: SkillsEditor,        deployable: true },
  mana:       { component: ManaEditor,          deployable: true },
  daycycle:   { component: DayCycleEditor,      deployable: true },
  banner:     { component: BannerEditor,        deployable: false },
  spinner:    { component: SpinnerEditor,       deployable: false },
  voices:     { component: VoiceProfilesEditor, deployable: true },
  puppet:     { component: PuppetEditor,         deployable: false },
  grimoire:   { component: GrimoireEditor,      deployable: false },
  weather:    { component: WeatherEditor,       deployable: true },
  doctor:     { component: DoctorPanel,         deployable: false },
}

const TAB_GROUPS: { label: string; tabs: { id: EditorMode; label: string }[]; links?: { href: string; label: string }[] }[] = [
  {
    label: 'Sprites',
    tabs: [
      { id: 'player', label: 'Player' },
      { id: 'beasts', label: "Mana'mals" },
      { id: 'items', label: 'Items' },
      { id: 'nodes', label: 'Nodes' },
    ],
  },
  {
    label: 'Spirits',
    tabs: [
      { id: 'grimoire', label: 'Grimoire' },
      { id: 'sprites', label: 'Art' },
      { id: 'puppet', label: 'Puppet' },
      { id: 'moves', label: 'Moves' },
      { id: 'evolution', label: 'Evolution' },
      { id: 'encounters', label: 'Encounters' },
      { id: 'battle', label: 'Battle' },
    ],
  },
  {
    label: 'World',
    tabs: [
      { id: 'map', label: 'Map' },
      { id: 'structures', label: 'Structures' },
      { id: 'furniture', label: 'Objects' },
      { id: 'npcs', label: 'NPCs' },
    ],
    links: [
      { href: '/shimmer/dev/dialogue', label: 'Dialogue' },
    ],
  },
  {
    label: 'Craft',
    tabs: [
      { id: 'farming', label: 'Farming' },
      { id: 'resources', label: 'Resources' },
      { id: 'tools', label: 'Tools' },
      { id: 'alchemy', label: 'Alchemy' },
      { id: 'exchange', label: 'Exchange' },
    ],
  },
  {
    label: 'Sim',
    tabs: [
      { id: 'skills', label: 'Skills' },
      { id: 'mana', label: 'Mana' },
      { id: 'quests', label: 'Quests' },
      { id: 'daycycle', label: 'Day/Night' },
      { id: 'weather', label: 'Weather' },
    ],
  },
  {
    label: 'Tools',
    tabs: [
      { id: 'banner', label: 'Banner' },
      { id: 'spinner', label: 'Spinner' },
      { id: 'voices', label: 'Voices' },
      { id: 'doctor', label: 'Doctor' },
    ],
  },
]

const ALL_TABS = TAB_GROUPS.flatMap(g => g.tabs)

function EditorHub() {
  const searchParams = useSearchParams()
  const initialMode = (searchParams.get('mode') as EditorMode) || 'sprites'
  const [mode, setMode] = useState<EditorMode>(
    ALL_TABS.some(t => t.id === initialMode) ? initialMode : 'sprites'
  )
  const [deployState, setDeployState] = useState<'idle' | 'building' | 'done' | 'error'>('idle')
  const deployPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [showPalette, setShowPalette] = useState(false)
  const [inspectorContent, setInspectorContent] = useState<ReactNode | null>(null)
  const [inspectorTitle, setInspectorTitle] = useState<string | null>(null)

  // Derive active group from current mode
  const activeGroupIndex = TAB_GROUPS.findIndex(g => g.tabs.some(t => t.id === mode))
  const activeGroup = TAB_GROUPS[activeGroupIndex >= 0 ? activeGroupIndex : 0]

  // Clear inspector when switching editors
  useEffect(() => {
    setInspectorContent(null)
    setInspectorTitle(null)
  }, [mode])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowPalette(v => !v)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const handlePaletteNavigate = useCallback((href: string) => {
    window.location.href = href
  }, [])

  const switchMode = useCallback((m: EditorMode) => {
    setMode(m)
    const url = new URL(window.location.href)
    if (m === 'sprites') {
      url.searchParams.delete('mode')
    } else {
      url.searchParams.set('mode', m)
    }
    window.history.replaceState({}, '', url.toString())
  }, [])

  const switchGroup = useCallback((groupIndex: number) => {
    const group = TAB_GROUPS[groupIndex]
    if (!group?.tabs[0]) return
    if (group.tabs.some(t => t.id === mode)) return
    switchMode(group.tabs[0].id)
  }, [switchMode, mode])

  const deployToGame = useCallback(async () => {
    setDeployState('building')
    if (deployPollRef.current) clearInterval(deployPollRef.current)
    try {
      const res = await fetch('/shimmer/deploy', { method: 'POST' })
      const data = await res.json()
      // Server may report 'restarting' or 'building' (or { joined: true } if a build
      // was already running). Anything that isn't an explicit error is fine — start polling.
      if (data.error && !data.state) { setDeployState('error'); return }
      // Cap polling at 4min — protects against a wedged status file.
      let polls = 0
      const MAX_POLLS = 120
      deployPollRef.current = setInterval(async () => {
        polls++
        if (polls > MAX_POLLS) {
          if (deployPollRef.current) clearInterval(deployPollRef.current)
          setDeployState('error')
          setTimeout(() => setDeployState('idle'), 5000)
          return
        }
        try {
          const s = await fetch('/shimmer/deploy').then(r => r.json())
          // Treat 'restarting' as still in-progress (not done yet)
          if (s.state === 'done' || s.state === 'error') {
            setDeployState(s.state)
            if (deployPollRef.current) clearInterval(deployPollRef.current)
            setTimeout(() => setDeployState('idle'), 5000)
          }
        } catch {} // pm2 restart briefly drops the endpoint — keep polling
      }, 2000)
    } catch { setDeployState('error') }
  }, [])

  // Fix: useMemo instead of useCallback invoked each render
  const inspectorContextValue = useMemo(() => ({
    setInspectorContent,
    setInspectorTitle,
  }), [])

  // Editors that keep state between tab switches (mounted once, hidden when inactive)
  const PERSISTENT_MODES: EditorMode[] = ['map']
  const [visitedPersistent, setVisitedPersistent] = useState<Set<EditorMode>>(new Set())
  useEffect(() => {
    if (PERSISTENT_MODES.includes(mode) && !visitedPersistent.has(mode)) {
      setVisitedPersistent(prev => new Set(prev).add(mode))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // Render active editor via component map
  const entry = EDITOR_MAP[mode]
  const ActiveEditor = entry.component
  const isPersistentActive = PERSISTENT_MODES.includes(mode)

  return (
    <InspectorContext.Provider value={inspectorContextValue}>
      <div className="min-h-screen bg-[#0a0a1a] text-white flex">
        <div className="flex-1 min-w-0 p-6">
          <div className={mode === 'map' || mode === 'structures' ? 'max-w-[1400px] mx-auto' : 'max-w-[1100px] mx-auto'}>

            {/* Header bar */}
            <div className="flex items-center gap-4 mb-5">
              <h1 className="font-display text-lg text-gold tracking-wide select-none">Shimmer Dev</h1>
              <span className="text-white/10 select-none">/</span>
              <a
                href="/shimmer"
                className="text-[11px] text-violet-400 hover:text-violet-300 transition-colors"
              >
                Play Game
              </a>
              <button
                onClick={() => setShowPalette(true)}
                className="ml-auto flex items-center gap-2 px-2.5 py-1 rounded-md border border-white/8 hover:border-white/15 hover:bg-white/5 transition-all group"
              >
                <span className="text-[11px] text-white/25 group-hover:text-white/40 transition-colors">Search editors</span>
                <kbd className="bg-white/8 border border-white/10 rounded px-1.5 py-0.5 font-mono text-[9px] text-white/30">
                  Ctrl K
                </kbd>
              </button>
            </div>

            {/* Two-level nav — group selectors */}
            <div className="flex items-center gap-1 mb-2">
              {TAB_GROUPS.map((group, gi) => (
                <button
                  key={group.label}
                  onClick={() => switchGroup(gi)}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-display tracking-wide transition-all ${
                    gi === activeGroupIndex
                      ? 'bg-white/10 text-gold'
                      : 'text-text-faint hover:text-text-dim hover:bg-white/5'
                  }`}
                >
                  {group.label}
                  <span className="ml-1.5 text-[9px] opacity-40">{group.tabs.length}</span>
                </button>
              ))}
            </div>

            {/* Two-level nav — sub-tabs for active group */}
            <div className="flex items-center gap-1 mb-6 border-b border-white/10 pb-3">
              {activeGroup.tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => switchMode(tab.id)}
                  className={`px-4 py-2 rounded-t text-sm font-display transition-all ${
                    mode === tab.id
                      ? 'bg-white/10 text-gold border-b-2 border-gold'
                      : 'text-text-faint hover:text-text-dim hover:bg-white/5'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              {activeGroup.links?.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2 rounded-t text-sm font-display text-text-faint hover:text-text-dim hover:bg-white/5 transition-all"
                >
                  {link.label}
                </a>
              ))}
            </div>

            {/* Persistent editors — stay mounted once visited, hidden when inactive */}
            {PERSISTENT_MODES.map(m => {
              if (!visitedPersistent.has(m)) return null
              const E = EDITOR_MAP[m].component
              return (
                <div key={m} style={mode !== m ? { display: 'none' } : undefined}>
                  <Suspense fallback={<div className="flex items-center justify-center py-20"><p className="text-text-faint text-sm animate-pulse">Loading editor...</p></div>}>
                    {EDITOR_MAP[m].deployable
                      ? <E onDeploy={deployToGame} deployState={deployState} />
                      : <E />
                    }
                  </Suspense>
                </div>
              )
            })}

            {/* Non-persistent active editor */}
            {!isPersistentActive && (
              <Suspense fallback={<div className="flex items-center justify-center py-20"><p className="text-text-faint text-sm animate-pulse">Loading editor...</p></div>}>
                {entry.deployable
                  ? <ActiveEditor onDeploy={deployToGame} deployState={deployState} />
                  : <ActiveEditor />
                }
              </Suspense>
            )}
          </div>
        </div>

        <InspectorSidebar title={inspectorTitle}>
          {inspectorContent}
        </InspectorSidebar>

        {showPalette && (
          <CommandPalette
            onClose={() => setShowPalette(false)}
            onSwitchMode={(m) => { switchMode(m as EditorMode); setShowPalette(false) }}
            onNavigate={handlePaletteNavigate}
            onDeploy={() => { deployToGame(); setShowPalette(false) }}
          />
        )}
      </div>
    </InspectorContext.Provider>
  )
}

export default function DevPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a1a] text-white p-6"><p className="text-text-faint">Loading editor...</p></div>}>
      <EditorHub />
    </Suspense>
  )
}
