'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import EditorShell from '../templates/EditorShell'
import NPCBrowser from './NPCBrowser'
import NodeGraph from './NodeGraph'
import PropertiesPanel from './PropertiesPanel'
import type { DialogueGraph, DialogueNode, DialogueEdge, DialogueFrame, ChoiceNodeData, ActionNodeData, ConditionNodeData, TextNodeData } from './types'
import { createEmptyGraph, generateId } from './types'
import { validateGraph, type ValidationResult } from './validate'
import { DIALOGUE_EDITOR_SHORTCUTS } from '../templates/shortcut-data'

export default function DialogueEditorPage() {
  const [activeNpcId, setActiveNpcId] = useState<string | null>(null)
  const [activeGraphId, setActiveGraphId] = useState<string | null>(null)
  const [graph, setGraph] = useState<DialogueGraph | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadStatus, setLoadStatus] = useState<string>('loading...')

  // Validation
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [showValidation, setShowValidation] = useState(false)

  // Search
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMatchIndex, setSearchMatchIndex] = useState(0)

  // Undo/redo — ref-based to avoid stale closures
  const undoStackRef = useRef<DialogueGraph[]>([])
  const redoStackRef = useRef<DialogueGraph[]>([])
  const graphRef = useRef(graph)
  graphRef.current = graph
  const MAX_UNDO = 50

  const pushUndo = useCallback(() => {
    if (!graphRef.current) return
    undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), JSON.parse(JSON.stringify(graphRef.current))]
    redoStackRef.current = []
  }, [])

  const undoGraph = useCallback(() => {
    if (undoStackRef.current.length === 0 || !graphRef.current) return
    redoStackRef.current = [...redoStackRef.current, JSON.parse(JSON.stringify(graphRef.current))]
    const prev = undoStackRef.current.pop()!
    setGraph(prev)
    setDirty(true)
  }, [])

  const redoGraph = useCallback(() => {
    if (redoStackRef.current.length === 0 || !graphRef.current) return
    undoStackRef.current = [...undoStackRef.current, JSON.parse(JSON.stringify(graphRef.current))]
    const next = redoStackRef.current.pop()!
    setGraph(next)
    setDirty(true)
  }, [])

  // All saved graphs (NPC ID -> graphs)
  const [allGraphs, setAllGraphs] = useState<Record<string, DialogueGraph[]>>({})

  const selectedNode = graph?.nodes.find(n => n.id === selectedNodeId) ?? null
  const npcGraphs = activeNpcId ? (allGraphs[activeNpcId] ?? []) : []

  // ── Load all graphs on mount ──
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/shimmer/save-dialogue')
        const data = await res.json()
        if (data.dialogues && data.dialogues.length > 0) {
          const graphs: DialogueGraph[] = await Promise.all(
            data.dialogues.map(async (s: { id: string }) => {
              const r = await fetch(`/shimmer/save-dialogue?id=${s.id}`)
              return r.json()
            })
          )
          const grouped: Record<string, DialogueGraph[]> = {}
          for (const g of graphs) {
            ;(grouped[g.npcId] ??= []).push(g)
          }
          setAllGraphs(grouped)
          setLoadStatus(`${graphs.length} graphs`)
        } else {
          setLoadStatus('no graphs')
        }
      } catch {
        setLoadStatus('failed')
      }
    }
    load()
  }, [])

  // ── Debounced validation ──
  useEffect(() => {
    if (!graph) { setValidationResult(null); return }
    const timer = setTimeout(() => setValidationResult(validateGraph(graph)), 500)
    return () => clearTimeout(timer)
  }, [graph])

  const validationNodeIds = useMemo(() => {
    if (!validationResult) return undefined
    const set = new Set<string>()
    for (const issue of validationResult.issues) {
      if (issue.nodeId) set.add(issue.nodeId)
    }
    return set.size > 0 ? set : undefined
  }, [validationResult])

  // ── Search ──
  const searchMatches = useMemo(() => {
    if (!graph || !searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return graph.nodes.filter(node => {
      if (node.type === 'text') {
        const d = node.data as TextNodeData
        return d.speaker?.toLowerCase().includes(q) || d.text?.toLowerCase().includes(q)
      }
      if (node.type === 'choice') {
        const d = node.data as ChoiceNodeData
        return (d.prompt ?? '').toLowerCase().includes(q) ||
          d.options?.some(o => o.label.toLowerCase().includes(q))
      }
      if (node.type === 'condition') {
        const d = node.data as ConditionNodeData
        return d.conditions?.some(c =>
          c.check.type.toLowerCase().includes(q) ||
          ('flag' in c.check && (c.check as any).flag?.toLowerCase().includes(q)) ||
          ('itemId' in c.check && (c.check as any).itemId?.toLowerCase().includes(q)) ||
          ('skillId' in c.check && (c.check as any).skillId?.toLowerCase().includes(q))
        )
      }
      if (node.type === 'action') {
        const d = node.data as ActionNodeData
        return d.actions?.some(a =>
          a.type.toLowerCase().includes(q) ||
          ('flag' in a && (a as any).flag?.toLowerCase().includes(q)) ||
          ('itemId' in a && (a as any).itemId?.toLowerCase().includes(q)) ||
          ('shopId' in a && (a as any).shopId?.toLowerCase().includes(q))
        )
      }
      return false
    }).map(n => n.id)
  }, [graph, searchQuery])

  // Keyboard shortcuts: Ctrl+F (search), Ctrl+Z (undo), Ctrl+Shift+Z / Ctrl+Y (redo)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setSearchOpen(true)
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault()
        redoGraph()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        undoGraph()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        redoGraph()
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undoGraph, redoGraph])

  // ── Save current graph ──
  const handleSave = useCallback(async () => {
    if (!graph) return
    setSaving(true)
    try {
      const res = await fetch('/shimmer/save-dialogue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(graph),
      })
      const data = await res.json()
      if (data.success) {
        setDirty(false)
        setAllGraphs(prev => {
          const npcGraphs = prev[graph.npcId] ?? []
          const idx = npcGraphs.findIndex(g => g.id === graph.id)
          if (idx >= 0) {
            const updated = [...npcGraphs]
            updated[idx] = graph
            return { ...prev, [graph.npcId]: updated }
          }
          return { ...prev, [graph.npcId]: [...npcGraphs, graph] }
        })
      }
    } catch {}
    setSaving(false)
  }, [graph])

  // ── Select a specific graph ──
  const switchToGraph = useCallback((g: DialogueGraph) => {
    setGraph(g)
    setActiveGraphId(g.id)
    setSelectedNodeId(null)
    setDirty(false)
    undoStackRef.current = []
    redoStackRef.current = []
  }, [])

  // ── NPC selection ──
  const handleSelectNpc = useCallback((npcId: string) => {
    setActiveNpcId(npcId)
    const existing = allGraphs[npcId]
    if (existing?.length) {
      switchToGraph(existing[0])
    } else {
      const newGraph = createEmptyGraph(npcId)
      setGraph(newGraph)
      setActiveGraphId(newGraph.id)
      setAllGraphs(prev => ({ ...prev, [npcId]: [newGraph] }))
      setSelectedNodeId(null)
      setDirty(false)
    }
  }, [allGraphs, switchToGraph])

  // ── New graph for current NPC ──
  const handleNewGraph = useCallback(() => {
    if (!activeNpcId) return
    const newGraph = createEmptyGraph(activeNpcId)
    setAllGraphs(prev => ({
      ...prev,
      [activeNpcId]: [...(prev[activeNpcId] ?? []), newGraph],
    }))
    switchToGraph(newGraph)
    setDirty(true)
  }, [activeNpcId, switchToGraph])

  // ── Delete current graph ──
  const handleDeleteGraph = useCallback(async () => {
    if (!graph || !activeNpcId) return
    // Remove from API
    try {
      await fetch('/shimmer/save-dialogue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: graph.id }),
      })
    } catch {}
    // Remove from local state
    setAllGraphs(prev => {
      const updated = (prev[activeNpcId] ?? []).filter(g => g.id !== graph.id)
      return { ...prev, [activeNpcId]: updated }
    })
    // Switch to first remaining graph or clear
    const remaining = (allGraphs[activeNpcId] ?? []).filter(g => g.id !== graph.id)
    if (remaining.length > 0) {
      switchToGraph(remaining[0])
    } else {
      setGraph(null)
      setActiveGraphId(null)
    }
    setDirty(false)
  }, [graph, activeNpcId, allGraphs, switchToGraph])

  // ── Node operations ──
  const handleAddNode = useCallback((type: DialogueNode['type'], position: { x: number; y: number }) => {
    if (!graph) return
    pushUndo()
    const id = generateId(type)
    const defaultData =
      type === 'text'      ? { speaker: activeNpcId ?? '', text: '' }
      : type === 'choice'  ? { prompt: '', options: [{ label: 'Option 1', targetNodeId: '' }] }
      : type === 'condition' ? { conditions: [], fallbackNodeId: '' }
      : type === 'action'  ? { actions: [], nextNodeId: '' }
      : {} // reroute

    const node: DialogueNode = { id, type, position, data: defaultData }
    setGraph(prev => prev ? { ...prev, nodes: [...prev.nodes, node] } : prev)
    setSelectedNodeId(id)
    setDirty(true)
  }, [graph, activeNpcId])

  const handleCreateAndConnect = useCallback((type: DialogueNode['type'], position: { x: number; y: number }, fromId: string, fromPort?: string) => {
    if (!graph) return
    pushUndo()
    const id = generateId(type)
    const defaultData =
      type === 'text'      ? { speaker: activeNpcId ?? '', text: '' }
      : type === 'choice'  ? { prompt: '', options: [{ label: 'Option 1', targetNodeId: '' }] }
      : type === 'condition' ? { conditions: [], fallbackNodeId: '' }
      : type === 'action'  ? { actions: [], nextNodeId: '' }
      : {} // reroute

    const node: DialogueNode = { id, type, position, data: defaultData }

    setGraph(prev => {
      if (!prev) return prev
      let updated = { ...prev, nodes: [...prev.nodes, node] }

      const fromNode = prev.nodes.find(n => n.id === fromId)
      if (!fromNode) return updated

      // Wire the connection based on source node type
      if (fromNode.type === 'choice' && fromPort?.startsWith('option_')) {
        const optIdx = parseInt(fromPort.split('_')[1])
        const data = fromNode.data as ChoiceNodeData
        if (data.options[optIdx]) {
          const options = [...data.options]
          options[optIdx] = { ...options[optIdx], targetNodeId: id }
          updated = { ...updated, nodes: updated.nodes.map(n => n.id === fromId ? { ...n, data: { ...data, options } } : n) }
        }
      } else if (fromNode.type === 'action') {
        updated = { ...updated, nodes: updated.nodes.map(n => n.id === fromId ? { ...n, data: { ...(n.data as ActionNodeData), nextNodeId: id } } : n) }
      } else if (fromNode.type === 'condition' && fromPort) {
        const data = fromNode.data as ConditionNodeData
        if (fromPort === 'fallback') {
          updated = { ...updated, nodes: updated.nodes.map(n => n.id === fromId ? { ...n, data: { ...data, fallbackNodeId: id } } : n) }
        } else if (fromPort.startsWith('condition_')) {
          const condIdx = parseInt(fromPort.split('_')[1])
          if (data.conditions[condIdx]) {
            const conditions = [...data.conditions]
            conditions[condIdx] = { ...conditions[condIdx], targetNodeId: id }
            updated = { ...updated, nodes: updated.nodes.map(n => n.id === fromId ? { ...n, data: { ...data, conditions } } : n) }
          }
        }
      } else {
        // Text and reroute nodes use explicit edges
        const edge: DialogueEdge = { id: generateId('edge'), from: fromId, to: id, fromPort }
        updated = { ...updated, edges: [...updated.edges, edge] }
      }

      return updated
    })
    setSelectedNodeId(id)
    setDirty(true)
  }, [graph, activeNpcId, pushUndo])

  // ── Frame CRUD ──
  const handleAddFrame = useCallback((position: { x: number; y: number }) => {
    if (!graph) return
    pushUndo()
    const frame: DialogueFrame = {
      id: generateId('frame'),
      label: 'Group',
      color: '#6366f1',
      position,
      size: { w: 200, h: 150 },
    }
    setGraph(prev => prev ? { ...prev, frames: [...(prev.frames ?? []), frame] } : prev)
    setDirty(true)
  }, [graph, pushUndo])

  const handleMoveFrame = useCallback((frameId: string, position: { x: number; y: number }) => {
    setGraph(prev => {
      if (!prev) return prev
      return { ...prev, frames: (prev.frames ?? []).map(f => f.id === frameId ? { ...f, position } : f) }
    })
    setDirty(true)
  }, [])

  const handleResizeFrame = useCallback((frameId: string, size: { w: number; h: number }) => {
    setGraph(prev => {
      if (!prev) return prev
      return { ...prev, frames: (prev.frames ?? []).map(f => f.id === frameId ? { ...f, size } : f) }
    })
    setDirty(true)
  }, [])

  const handleDeleteFrame = useCallback((frameId: string) => {
    pushUndo()
    setGraph(prev => {
      if (!prev) return prev
      return { ...prev, frames: (prev.frames ?? []).filter(f => f.id !== frameId) }
    })
    setDirty(true)
  }, [pushUndo])

  const handleUpdateFrameLabel = useCallback((frameId: string, label: string) => {
    pushUndo()
    setGraph(prev => {
      if (!prev) return prev
      return { ...prev, frames: (prev.frames ?? []).map(f => f.id === frameId ? { ...f, label } : f) }
    })
    setDirty(true)
  }, [pushUndo])

  const handleMoveNode = useCallback((nodeId: string, position: { x: number; y: number }) => {
    setGraph(prev => {
      if (!prev) return prev
      return { ...prev, nodes: prev.nodes.map(n => n.id === nodeId ? { ...n, position } : n) }
    })
    setDirty(true)
  }, [])

  const handleDeleteNode = useCallback((nodeId: string) => {
    pushUndo()
    setGraph(prev => {
      if (!prev) return prev
      return {
        ...prev,
        nodes: prev.nodes.filter(n => n.id !== nodeId),
        edges: prev.edges.filter(e => e.from !== nodeId && e.to !== nodeId),
        entryNodeId: prev.entryNodeId === nodeId ? (prev.nodes[0]?.id ?? '') : prev.entryNodeId,
      }
    })
    if (selectedNodeId === nodeId) setSelectedNodeId(null)
    setDirty(true)
  }, [selectedNodeId])

  const handleUpdateNode = useCallback((nodeId: string, data: DialogueNode['data']) => {
    pushUndo()
    setGraph(prev => {
      if (!prev) return prev
      return { ...prev, nodes: prev.nodes.map(n => n.id === nodeId ? { ...n, data } : n) }
    })
    setDirty(true)
  }, [])

  // ── Edge operations ──
  // For choice/action/condition nodes, "connecting" means updating embedded data fields
  // (targetNodeId, nextNodeId, fallbackNodeId). Only text nodes use explicit edges.
  const handleAddEdge = useCallback((from: string, to: string, fromPort?: string) => {
    if (!graph) return
    pushUndo()
    const fromNode = graph.nodes.find(n => n.id === from)
    if (!fromNode) return

    // Choice nodes: set option targetNodeId
    if (fromNode.type === 'choice' && fromPort?.startsWith('option_')) {
      const optIndex = parseInt(fromPort.split('_')[1])
      const data = fromNode.data as ChoiceNodeData
      if (data.options[optIndex]) {
        const options = [...data.options]
        options[optIndex] = { ...options[optIndex], targetNodeId: to }
        handleUpdateNode(from, { ...data, options })
      }
      return
    }

    // Action nodes: set nextNodeId
    if (fromNode.type === 'action') {
      handleUpdateNode(from, { ...(fromNode.data as ActionNodeData), nextNodeId: to })
      return
    }

    // Condition nodes: set branch targetNodeId or fallbackNodeId
    if (fromNode.type === 'condition' && fromPort) {
      const data = fromNode.data as ConditionNodeData
      if (fromPort === 'fallback') {
        handleUpdateNode(from, { ...data, fallbackNodeId: to })
      } else if (fromPort.startsWith('condition_')) {
        const condIndex = parseInt(fromPort.split('_')[1])
        if (data.conditions[condIndex]) {
          const conditions = [...data.conditions]
          conditions[condIndex] = { ...conditions[condIndex], targetNodeId: to }
          handleUpdateNode(from, { ...data, conditions })
        }
      }
      return
    }

    // Text nodes: create explicit edge (standard graph behavior)
    if (graph.edges.some(e => e.from === from && e.to === to && e.fromPort === fromPort)) return
    const edge: DialogueEdge = { id: generateId('edge'), from, to, fromPort }
    setGraph(prev => prev ? { ...prev, edges: [...prev.edges, edge] } : prev)
    setDirty(true)
  }, [graph, handleUpdateNode])

  const handleDeleteEdge = useCallback((edgeId: string) => {
    pushUndo()
    setGraph(prev => {
      if (!prev) return prev
      return { ...prev, edges: prev.edges.filter(e => e.id !== edgeId) }
    })
    setDirty(true)
  }, [])

  // Clear a data-driven connection (choice targetNodeId, action nextNodeId, condition branch)
  const handleDisconnect = useCallback((nodeId: string, portName: string) => {
    pushUndo()
    setGraph(prev => {
      if (!prev) return prev
      return {
        ...prev,
        nodes: prev.nodes.map(n => {
          if (n.id !== nodeId) return n
          if (n.type === 'choice' && portName.startsWith('option_')) {
            const optIndex = parseInt(portName.split('_')[1])
            const data = n.data as ChoiceNodeData
            const options = [...data.options]
            if (options[optIndex]) {
              options[optIndex] = { ...options[optIndex], targetNodeId: '' }
            }
            return { ...n, data: { ...data, options } }
          }
          if (n.type === 'action') {
            return { ...n, data: { ...(n.data as ActionNodeData), nextNodeId: '' } }
          }
          if (n.type === 'condition') {
            const data = n.data as ConditionNodeData
            if (portName === 'fallback') {
              return { ...n, data: { ...data, fallbackNodeId: '' } }
            }
            if (portName.startsWith('condition_')) {
              const condIndex = parseInt(portName.split('_')[1])
              const conditions = [...data.conditions]
              if (conditions[condIndex]) {
                conditions[condIndex] = { ...conditions[condIndex], targetNodeId: '' }
              }
              return { ...n, data: { ...data, conditions } }
            }
          }
          return n
        }),
      }
    })
    setDirty(true)
  }, [])

  const handleSetEntry = useCallback((nodeId: string) => {
    pushUndo()
    setGraph(prev => prev ? { ...prev, entryNodeId: nodeId } : prev)
    setDirty(true)
  }, [pushUndo])

  // Derive a short label for each graph
  const graphLabel = useCallback((g: DialogueGraph) => {
    const tags = g.metadata?.tags?.join(', ')
    if (tags) return tags
    // Use graph ID but strip the NPC prefix for readability
    const short = g.id.replace(`${g.npcId}-`, '').replace(`${g.npcId}_`, '')
    return short || g.id
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white flex flex-col">
      <div className="p-4 pb-0">
        <EditorShell
          title="Dialogue Editor"
          subtitle="Visual conversation graphs for NPCs"
          loadStatus={loadStatus}
          shortcuts={DIALOGUE_EDITOR_SHORTCUTS}
          headerActions={
            <div className="flex items-center gap-3 ml-auto">
              {validationResult && (validationResult.errorCount > 0 || validationResult.warningCount > 0) && (
                <button
                  onClick={() => setShowValidation(v => !v)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] border transition-colors ${
                    showValidation
                      ? 'bg-white/10 border-white/20'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {validationResult.errorCount > 0 && (
                    <span className="text-red-400">{validationResult.errorCount} {validationResult.errorCount === 1 ? 'error' : 'errors'}</span>
                  )}
                  {validationResult.errorCount > 0 && validationResult.warningCount > 0 && (
                    <span className="text-white/20">/</span>
                  )}
                  {validationResult.warningCount > 0 && (
                    <span className="text-amber-400">{validationResult.warningCount} {validationResult.warningCount === 1 ? 'warning' : 'warnings'}</span>
                  )}
                </button>
              )}
              {validationResult?.valid && graph && graph.nodes.length > 0 && (
                <span className="text-[10px] text-green-400/60">valid</span>
              )}
              {dirty && <span className="text-[10px] text-amber-400">unsaved changes</span>}
              <button
                onClick={handleSave}
                disabled={!dirty || saving}
                className={`px-3 py-1 rounded text-[10px] border transition-colors ${
                  dirty && !saving
                    ? 'bg-violet-500/20 border-violet-500/40 text-violet-300 hover:bg-violet-500/30'
                    : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
                }`}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <a
                href="/shimmer/dev?mode=map"
                className="text-[10px] text-violet-400 hover:text-violet-300"
              >
                Back to Dev
              </a>
            </div>
          }
        >
          <div />
        </EditorShell>
      </div>

      {/* Three-panel layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left: NPC Browser */}
        <div className="w-56 border-r border-white/10 flex flex-col">
          <NPCBrowser
            activeNpcId={activeNpcId}
            onSelectNpc={handleSelectNpc}
            graphCounts={Object.fromEntries(
              Object.entries(allGraphs).map(([k, v]) => [k, v.length])
            )}
          />
        </div>

        {/* Center: Graph selector + Node Graph */}
        <div className="flex-1 flex flex-col relative">
          {/* Graph selector bar */}
          {activeNpcId && npcGraphs.length > 0 && (
            <div className="flex items-center gap-1 px-3 py-2 border-b border-white/10 bg-white/[0.02] overflow-x-auto shrink-0">
              {npcGraphs.map(g => (
                <button
                  key={g.id}
                  onClick={() => switchToGraph(g)}
                  className={`px-3 py-1 rounded text-[10px] border whitespace-nowrap transition-colors ${
                    activeGraphId === g.id
                      ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                      : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60 hover:bg-white/10'
                  }`}
                >
                  {graphLabel(g)}
                </button>
              ))}
              <button
                onClick={handleNewGraph}
                className="px-2 py-1 rounded text-[10px] text-violet-400 hover:text-violet-300 hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors"
              >
                + New
              </button>
              {graph && npcGraphs.length > 1 && (
                <button
                  onClick={handleDeleteGraph}
                  className="px-2 py-1 rounded text-[10px] text-red-400/50 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors ml-auto"
                >
                  Delete
                </button>
              )}
            </div>
          )}

          {/* Canvas */}
          {graph ? (
            <div className="flex-1 relative">
              <NodeGraph
                graph={graph}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                onAddNode={handleAddNode}
                onMoveNode={handleMoveNode}
                onDeleteNode={handleDeleteNode}
                onAddEdge={handleAddEdge}
                onDeleteEdge={handleDeleteEdge}
                onSetEntry={handleSetEntry}
                onDisconnect={handleDisconnect}
                highlightNodeIds={validationNodeIds}
                searchMatchIds={searchOpen && searchMatches.length > 0 ? new Set(searchMatches) : undefined}
                currentSearchMatchId={searchOpen && searchMatches.length > 0 ? searchMatches[searchMatchIndex] : undefined}
                onCreateAndConnect={handleCreateAndConnect}
                onAddFrame={handleAddFrame}
                onMoveFrame={handleMoveFrame}
                onResizeFrame={handleResizeFrame}
                onDeleteFrame={handleDeleteFrame}
                onUpdateFrameLabel={handleUpdateFrameLabel}
              />

              {/* Search bar */}
              {searchOpen && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-[#1a1a2e] border border-white/15 rounded-lg px-3 py-2 shadow-xl">
                  <input
                    autoFocus
                    className="bg-transparent border-none outline-none text-xs text-white w-48 placeholder-white/30"
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setSearchMatchIndex(0) }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (searchMatches.length > 0) setSearchMatchIndex(i => (i + 1) % searchMatches.length)
                      }
                      if (e.key === 'Escape') {
                        setSearchOpen(false)
                        setSearchQuery('')
                      }
                    }}
                    placeholder="Search nodes..."
                  />
                  {searchQuery && (
                    <span className="text-[9px] text-white/40 tabular-nums whitespace-nowrap">
                      {searchMatches.length > 0 ? `${searchMatchIndex + 1}/${searchMatches.length}` : 'no matches'}
                    </span>
                  )}
                  {searchMatches.length > 1 && (
                    <button
                      onClick={() => setSearchMatchIndex(i => (i + 1) % searchMatches.length)}
                      className="text-white/40 hover:text-white/70 text-[10px]"
                    >
                      next
                    </button>
                  )}
                  <button
                    onClick={() => { setSearchOpen(false); setSearchQuery('') }}
                    className="text-white/40 hover:text-white/70 text-xs leading-none"
                  >
                    x
                  </button>
                </div>
              )}

              {/* Validation panel */}
              {showValidation && validationResult && validationResult.issues.length > 0 && (
                <div className="absolute bottom-4 right-4 z-40 w-72 max-h-64 overflow-y-auto bg-[#1a1a2e] border border-white/15 rounded-lg shadow-xl">
                  <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
                    <span className="text-[10px] text-white/50 uppercase tracking-wider">Validation</span>
                    <button onClick={() => setShowValidation(false)} className="text-white/30 hover:text-white/60 text-xs">x</button>
                  </div>
                  <div className="p-2 space-y-1">
                    {validationResult.issues.map((issue, i) => (
                      <button
                        key={i}
                        onClick={() => { if (issue.nodeId) setSelectedNodeId(issue.nodeId) }}
                        className={`w-full text-left px-2 py-1.5 rounded text-[10px] hover:bg-white/5 transition-colors ${
                          issue.nodeId ? 'cursor-pointer' : 'cursor-default'
                        }`}
                      >
                        <span className={issue.severity === 'error' ? 'text-red-400' : 'text-amber-400'}>
                          {issue.severity === 'error' ? 'ERR' : 'WARN'}
                        </span>
                        <span className="text-white/50 ml-2">{issue.message}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center flex-1 text-text-faint text-sm">
              Select an NPC to start editing dialogue
            </div>
          )}
        </div>

        {/* Right: Properties Panel */}
        <div className="w-72 border-l border-white/10 flex flex-col">
          <PropertiesPanel
            node={selectedNode}
            graph={graph}
            onUpdateNode={handleUpdateNode}
            onSetEntry={handleSetEntry}
          />
        </div>
      </div>
    </div>
  )
}
