'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { DialogueGraph, DialogueNode, DialogueNodeType, DialogueFrame, ChoiceNodeData, ActionNodeData, ConditionNodeData } from './types'
import { NODE_COLORS } from './types'

interface NodeGraphProps {
  graph: DialogueGraph
  selectedNodeId: string | null
  onSelectNode: (id: string | null) => void
  onAddNode: (type: DialogueNode['type'], position: { x: number; y: number }) => void
  onMoveNode: (nodeId: string, position: { x: number; y: number }) => void
  onDeleteNode: (nodeId: string) => void
  onAddEdge: (from: string, to: string, fromPort?: string) => void
  onDeleteEdge: (edgeId: string) => void
  onSetEntry: (nodeId: string) => void
  onDisconnect?: (nodeId: string, portName: string) => void
  highlightNodeIds?: Set<string>
  searchMatchIds?: Set<string>
  currentSearchMatchId?: string
  onCreateAndConnect?: (type: DialogueNode['type'], position: { x: number; y: number }, fromId: string, fromPort?: string) => void
  onAddFrame?: (position: { x: number; y: number }) => void
  onMoveFrame?: (frameId: string, position: { x: number; y: number }) => void
  onResizeFrame?: (frameId: string, size: { w: number; h: number }) => void
  onDeleteFrame?: (frameId: string) => void
  onUpdateFrameLabel?: (frameId: string, label: string) => void
}

const NODE_W = 180
const NODE_H = 64
const REROUTE_R = 6

// Dynamic height based on node content (choices/conditions need more room)
function getNodeHeight(node: DialogueNode): number {
  if (node.type === 'reroute') return REROUTE_R * 2
  if (node.type === 'choice') {
    const opts = (node.data as ChoiceNodeData).options?.length ?? 1
    return Math.max(NODE_H, 36 + opts * 22)
  }
  if (node.type === 'condition') {
    const conds = (node.data as ConditionNodeData).conditions?.length ?? 0
    return Math.max(NODE_H, 36 + (conds + 1) * 22) // +1 for fallback
  }
  return NODE_H
}

// Port positions relative to node origin
function getInputPort(node: DialogueNode) {
  if (node.type === 'reroute') return { x: node.position.x, y: node.position.y }
  return { x: node.position.x, y: node.position.y + getNodeHeight(node) / 2 }
}

function getOutputPort(node: DialogueNode, portIndex = 0) {
  if (node.type === 'reroute') return { x: node.position.x, y: node.position.y }
  const h = getNodeHeight(node)
  if (node.type === 'choice') {
    const opts = (node.data as ChoiceNodeData).options?.length ?? 1
    const spacing = h / (opts + 1)
    return { x: node.position.x + NODE_W, y: node.position.y + spacing * (portIndex + 1) }
  }
  if (node.type === 'condition') {
    const conds = (node.data as ConditionNodeData).conditions?.length ?? 0
    const total = conds + 1 // +1 for fallback
    const spacing = h / (total + 1)
    return { x: node.position.x + NODE_W, y: node.position.y + spacing * (portIndex + 1) }
  }
  return { x: node.position.x + NODE_W, y: node.position.y + h / 2 }
}

function getNodeLabel(node: DialogueNode): string {
  switch (node.type) {
    case 'text': {
      const d = node.data as any
      const text = d.text || 'Empty text'
      return text.length > 32 ? text.slice(0, 32) + '...' : text
    }
    case 'choice': return `${(node.data as any).options?.length ?? 0} options`
    case 'condition': return `${(node.data as any).conditions?.length ?? 0} checks`
    case 'action': return `${(node.data as any).actions?.length ?? 0} actions`
    case 'reroute': return ''
  }
}

// Resolve the fromPort name based on node type and port index
function resolveFromPort(node: DialogueNode, portIndex?: number): string | undefined {
  if (portIndex === undefined) return undefined
  if (node.type === 'choice') return `option_${portIndex}`
  if (node.type === 'condition') {
    const conds = (node.data as ConditionNodeData).conditions?.length ?? 0
    return portIndex >= conds ? 'fallback' : `condition_${portIndex}`
  }
  return undefined
}

const TYPE_ICONS: Record<DialogueNodeType, string> = {
  text: 'T',
  choice: '?',
  condition: 'C',
  action: '!',
  reroute: '',
}

export default function NodeGraph({
  graph,
  selectedNodeId,
  onSelectNode,
  onAddNode,
  onMoveNode,
  onDeleteNode,
  onAddEdge,
  onDeleteEdge,
  onSetEntry,
  onDisconnect,
  highlightNodeIds,
  searchMatchIds,
  currentSearchMatchId,
  onCreateAndConnect,
  onAddFrame,
  onMoveFrame,
  onResizeFrame,
  onDeleteFrame,
  onUpdateFrameLabel,
}: NodeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [dragging, setDragging] = useState<{ nodeId: string; startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null)
  const [panning, setPanning] = useState<{ startX: number; startY: number; origPanX: number; origPanY: number } | null>(null)
  const [dragConnection, setDragConnection] = useState<{ fromId: string; fromPort?: string; mouseX: number; mouseY: number } | null>(null)
  const [wireDropMenu, setWireDropMenu] = useState<{ x: number; y: number; screenX: number; screenY: number; fromId: string; fromPort?: string } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; screenX: number; screenY: number } | null>(null)
  const [frameDrag, setFrameDrag] = useState<{ frameId: string; startX: number; startY: number; origX: number; origY: number; nodeOffsets: { nodeId: string; dx: number; dy: number }[] } | null>(null)
  const [frameResize, setFrameResize] = useState<{ frameId: string; startX: number; startY: number; origW: number; origH: number } | null>(null)
  const [editingFrameLabel, setEditingFrameLabel] = useState<string | null>(null)
  const [editingFrameLabelValue, setEditingFrameLabelValue] = useState('')

  // Refs mirror state so global listeners always have latest values without re-registering
  const draggingRef = useRef(dragging)
  const panningRef = useRef(panning)
  const zoomRef = useRef(zoom)
  const panRef = useRef(pan)
  const onMoveNodeRef = useRef(onMoveNode)
  const onAddEdgeRef = useRef(onAddEdge)
  const graphRef = useRef(graph)
  const dragConnectionRef = useRef(dragConnection)
  const frameDragRef = useRef(frameDrag)
  const frameResizeRef = useRef(frameResize)
  const onMoveFrameRef = useRef(onMoveFrame)
  const onResizeFrameRef = useRef(onResizeFrame)

  draggingRef.current = dragging
  panningRef.current = panning
  zoomRef.current = zoom
  panRef.current = pan
  onMoveNodeRef.current = onMoveNode
  onAddEdgeRef.current = onAddEdge
  graphRef.current = graph
  dragConnectionRef.current = dragConnection
  frameDragRef.current = frameDrag
  frameResizeRef.current = frameResize
  onMoveFrameRef.current = onMoveFrame
  onResizeFrameRef.current = onResizeFrame

  // Global mouseup/mousemove — registered ONCE, uses refs (no re-registration race conditions)
  useEffect(() => {
    const onGlobalMouseUp = (e: MouseEvent) => {
      setDragging(null)
      setPanning(null)
      setFrameDrag(null)
      setFrameResize(null)

      // Handle wire-drag drop
      const dc = dragConnectionRef.current
      if (dc) {
        const rect = containerRef.current?.getBoundingClientRect()
        if (rect) {
          const z = zoomRef.current
          const panVal = panRef.current
          const graphX = (e.clientX - rect.left - panVal.x) / z
          const graphY = (e.clientY - rect.top - panVal.y) / z

          // Check if mouse is over an input port (within 20px in screen space)
          let hitNode = false
          for (const node of graphRef.current?.nodes ?? []) {
            if (node.id === dc.fromId) continue
            const ip = getInputPort(node)
            const screenIPx = ip.x * z + panVal.x + rect.left
            const screenIPy = ip.y * z + panVal.y + rect.top
            if (Math.abs(e.clientX - screenIPx) < 20 && Math.abs(e.clientY - screenIPy) < 20) {
              onAddEdgeRef.current(dc.fromId, node.id, dc.fromPort)
              hitNode = true
              break
            }
          }

          if (!hitNode) {
            // Show wire-drop create menu
            setWireDropMenu({
              x: graphX,
              y: graphY,
              screenX: e.clientX,
              screenY: e.clientY,
              fromId: dc.fromId,
              fromPort: dc.fromPort,
            })
          }
        }
        setDragConnection(null)
      }
    }

    const onGlobalMouseMove = (e: MouseEvent) => {
      const panState = panningRef.current
      if (panState) {
        setPan({
          x: panState.origPanX + (e.clientX - panState.startX),
          y: panState.origPanY + (e.clientY - panState.startY),
        })
      }

      const drag = draggingRef.current
      if (drag) {
        const dx = Math.abs(e.clientX - drag.startX)
        const dy = Math.abs(e.clientY - drag.startY)
        if (!drag.moved && dx < 4 && dy < 4) return
        if (!drag.moved) setDragging(prev => prev ? { ...prev, moved: true } : null)
        const z = zoomRef.current
        const mx = (e.clientX - drag.startX) / z
        const my = (e.clientY - drag.startY) / z
        onMoveNodeRef.current(drag.nodeId, {
          x: Math.round(drag.origX + mx),
          y: Math.round(drag.origY + my),
        })
      }

      // Track drag connection mouse position
      const dc = dragConnectionRef.current
      if (dc) {
        setDragConnection(prev => prev ? { ...prev, mouseX: e.clientX, mouseY: e.clientY } : null)
      }

      // Frame drag — moves frame + contained nodes
      const fd = frameDragRef.current
      if (fd) {
        const z = zoomRef.current
        const mx = (e.clientX - fd.startX) / z
        const my = (e.clientY - fd.startY) / z
        const newX = Math.round(fd.origX + mx)
        const newY = Math.round(fd.origY + my)
        onMoveFrameRef.current?.(fd.frameId, { x: newX, y: newY })
        for (const no of fd.nodeOffsets) {
          onMoveNodeRef.current(no.nodeId, { x: newX + no.dx, y: newY + no.dy })
        }
      }

      // Frame resize
      const fr = frameResizeRef.current
      if (fr) {
        const z = zoomRef.current
        const mx = (e.clientX - fr.startX) / z
        const my = (e.clientY - fr.startY) / z
        const newW = Math.max(100, Math.round(fr.origW + mx))
        const newH = Math.max(60, Math.round(fr.origH + my))
        onResizeFrameRef.current?.(fr.frameId, { w: newW, h: newH })
      }
    }

    window.addEventListener('mouseup', onGlobalMouseUp)
    window.addEventListener('mousemove', onGlobalMouseMove)
    return () => {
      window.removeEventListener('mouseup', onGlobalMouseUp)
      window.removeEventListener('mousemove', onGlobalMouseMove)
    }
  }, [])

  // Compute derived edges from node data (choice targetNodeIds, action nextNodeIds, condition branches)
  const derivedEdges = useMemo(() => {
    const result: { id: string; from: string; to: string; fromPort: string; nodeType: DialogueNodeType }[] = []
    for (const node of graph.nodes) {
      if (node.type === 'choice') {
        const data = node.data as ChoiceNodeData
        ;(data.options ?? []).forEach((opt, i) => {
          if (opt.targetNodeId && graph.nodes.some(n => n.id === opt.targetNodeId)) {
            result.push({ id: `d_${node.id}_opt${i}`, from: node.id, to: opt.targetNodeId, fromPort: `option_${i}`, nodeType: 'choice' })
          }
        })
      } else if (node.type === 'action') {
        const data = node.data as ActionNodeData
        if (data.nextNodeId && graph.nodes.some(n => n.id === data.nextNodeId)) {
          result.push({ id: `d_${node.id}_next`, from: node.id, to: data.nextNodeId, fromPort: 'next', nodeType: 'action' })
        }
      } else if (node.type === 'condition') {
        const data = node.data as ConditionNodeData
        ;(data.conditions ?? []).forEach((cond, i) => {
          if (cond.targetNodeId && graph.nodes.some(n => n.id === cond.targetNodeId)) {
            result.push({ id: `d_${node.id}_cond${i}`, from: node.id, to: cond.targetNodeId, fromPort: `condition_${i}`, nodeType: 'condition' })
          }
        })
        if (data.fallbackNodeId && graph.nodes.some(n => n.id === data.fallbackNodeId)) {
          result.push({ id: `d_${node.id}_fb`, from: node.id, to: data.fallbackNodeId, fromPort: 'fallback', nodeType: 'condition' })
        }
      }
    }
    return result
  }, [graph.nodes])

  // Convert screen coords to graph coords
  const screenToGraph = useCallback((screenX: number, screenY: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: screenX, y: screenY }
    return {
      x: (screenX - rect.left - pan.x) / zoom,
      y: (screenY - rect.top - pan.y) / zoom,
    }
  }, [pan, zoom])

  // Zoom with optional focal point
  const applyZoom = useCallback((newZoom: number, focalX?: number, focalY?: number) => {
    const clamped = Math.min(Math.max(newZoom, 0.25), 3)
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      const fx = focalX ?? rect.width / 2
      const fy = focalY ?? rect.height / 2
      const scale = clamped / zoom
      setPan(prev => ({
        x: fx - scale * (fx - prev.x),
        y: fy - scale * (fy - prev.y),
      }))
    }
    setZoom(clamped)
  }, [zoom])

  // Ctrl+scroll wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      const rect = containerRef.current?.getBoundingClientRect()
      const fx = rect ? e.clientX - rect.left : undefined
      const fy = rect ? e.clientY - rect.top : undefined
      applyZoom(zoom + delta, fx, fy)
    }
  }, [zoom, applyZoom])

  // Pan with middle mouse or background drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) {
      e.preventDefault()
      const pos = screenToGraph(e.clientX, e.clientY)
      setContextMenu({ x: pos.x, y: pos.y, screenX: e.clientX, screenY: e.clientY })
      return
    }
    if (e.button === 1 || (e.button === 0 && e.target === containerRef.current?.querySelector('.graph-bg'))) {
      e.preventDefault()
      setPanning({ startX: e.clientX, startY: e.clientY, origPanX: pan.x, origPanY: pan.y })
      onSelectNode(null)
      setDragConnection(null)
      setWireDropMenu(null)
      setContextMenu(null)
    }
  }, [pan, screenToGraph, onSelectNode])

  // Node drag start
  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const node = graph.nodes.find(n => n.id === nodeId)
    if (!node) return
    setDragging({ nodeId, startX: e.clientX, startY: e.clientY, origX: node.position.x, origY: node.position.y, moved: false })
    onSelectNode(nodeId)
    setDragConnection(null)
    setWireDropMenu(null)
    setContextMenu(null)
  }, [graph.nodes, onSelectNode])

  // Output port mousedown — start wire drag
  const handleOutputPortMouseDown = useCallback((e: React.MouseEvent, nodeId: string, portIndex?: number) => {
    e.stopPropagation()
    e.preventDefault()
    const node = graph.nodes.find(n => n.id === nodeId)
    if (!node) return
    const fromPort = resolveFromPort(node, portIndex)
    setDragConnection({ fromId: nodeId, fromPort, mouseX: e.clientX, mouseY: e.clientY })
    setWireDropMenu(null)
    setContextMenu(null)
  }, [graph.nodes])

  // Input port click — kept for backward compat; primary flow is mouseup proximity detection in global handler
  const handleInputPortClick = useCallback((e: React.MouseEvent, _nodeId: string) => {
    e.stopPropagation()
    // dragConnection is cleared by global mouseup before this fires,
    // but we handle it here as a fallback for the click flow
  }, [])

  // Keyboard handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId && document.activeElement === document.body) {
          onDeleteNode(selectedNodeId)
        }
      }
      if (e.key === 'Escape') {
        setDragConnection(null)
        setWireDropMenu(null)
        setContextMenu(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedNodeId, onDeleteNode])

  // Auto-pan to center the current search match
  useEffect(() => {
    if (!currentSearchMatchId) return
    const node = graph.nodes.find(n => n.id === currentSearchMatchId)
    if (!node) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const nodeH = getNodeHeight(node)
    setPan({
      x: rect.width / 2 - node.position.x * zoom - (NODE_W / 2) * zoom,
      y: rect.height / 2 - node.position.y * zoom - (nodeH / 2) * zoom,
    })
  }, [currentSearchMatchId, graph.nodes, zoom])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const pos = screenToGraph(e.clientX, e.clientY)
    setContextMenu({ x: pos.x, y: pos.y, screenX: e.clientX, screenY: e.clientY })
  }, [screenToGraph])

  const handleContextAdd = useCallback((type: DialogueNodeType) => {
    if (!contextMenu) return
    onAddNode(type, { x: contextMenu.x, y: contextMenu.y })
    setContextMenu(null)
  }, [contextMenu, onAddNode])

  // Bezier edge path
  const edgePath = useCallback((fromX: number, fromY: number, toX: number, toY: number) => {
    const dx = Math.abs(toX - fromX) * 0.5
    return `M ${fromX} ${fromY} C ${fromX + dx} ${fromY}, ${toX - dx} ${toY}, ${toX} ${toY}`
  }, [])

  // Frame interaction handlers
  const handleFrameMouseDown = useCallback((e: React.MouseEvent, frameId: string) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const frame = graph.frames?.find(f => f.id === frameId)
    if (!frame) return
    // Find nodes inside this frame
    const nodeOffsets = graph.nodes
      .filter(n => {
        const nx = n.position.x + (n.type === 'reroute' ? 0 : NODE_W / 2)
        const ny = n.position.y + getNodeHeight(n) / 2
        return nx >= frame.position.x && nx <= frame.position.x + frame.size.w &&
               ny >= frame.position.y && ny <= frame.position.y + frame.size.h
      })
      .map(n => ({ nodeId: n.id, dx: n.position.x - frame.position.x, dy: n.position.y - frame.position.y }))
    setFrameDrag({ frameId, startX: e.clientX, startY: e.clientY, origX: frame.position.x, origY: frame.position.y, nodeOffsets })
    setContextMenu(null)
  }, [graph])

  const handleFrameResizeStart = useCallback((e: React.MouseEvent, frameId: string) => {
    e.stopPropagation()
    e.preventDefault()
    const frame = graph.frames?.find(f => f.id === frameId)
    if (!frame) return
    setFrameResize({ frameId, startX: e.clientX, startY: e.clientY, origW: frame.size.w, origH: frame.size.h })
  }, [graph])

  const handleFrameLabelDoubleClick = useCallback((e: React.MouseEvent, frameId: string) => {
    e.stopPropagation()
    const frame = graph.frames?.find(f => f.id === frameId)
    if (!frame) return
    setEditingFrameLabel(frameId)
    setEditingFrameLabelValue(frame.label)
  }, [graph])

  const commitFrameLabel = useCallback((frameId: string) => {
    if (onUpdateFrameLabel && editingFrameLabelValue.trim()) {
      onUpdateFrameLabel(frameId, editingFrameLabelValue.trim())
    }
    setEditingFrameLabel(null)
    setEditingFrameLabelValue('')
  }, [onUpdateFrameLabel, editingFrameLabelValue])

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden relative select-none"
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      onWheel={handleWheel}
      style={{ cursor: panning ? 'grabbing' : 'default' }}
    >
      {/* Dot grid background */}
      <div
        className="graph-bg absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)`,
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      {/* Transform layer */}
      <div
        className="absolute origin-top-left"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        {/* Frames — rendered below nodes */}
        {(graph.frames ?? []).map(frame => (
          <div
            key={frame.id}
            className="absolute rounded-lg border-2 pointer-events-auto"
            style={{
              left: frame.position.x,
              top: frame.position.y,
              width: frame.size.w,
              height: frame.size.h,
              backgroundColor: frame.color + '15',
              borderColor: frame.color + '40',
            }}
          >
            {/* Header bar — drag target */}
            <div
              className="flex items-center gap-2 px-2 py-1 rounded-t cursor-move"
              style={{ backgroundColor: frame.color + '30' }}
              onMouseDown={e => handleFrameMouseDown(e, frame.id)}
            >
              {editingFrameLabel === frame.id ? (
                <input
                  autoFocus
                  className="text-[10px] font-medium bg-transparent border-none outline-none flex-1 min-w-0"
                  style={{ color: frame.color }}
                  value={editingFrameLabelValue}
                  onChange={e => setEditingFrameLabelValue(e.target.value)}
                  onBlur={() => commitFrameLabel(frame.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitFrameLabel(frame.id)
                    if (e.key === 'Escape') { setEditingFrameLabel(null); setEditingFrameLabelValue('') }
                  }}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span
                  className="text-[10px] font-medium flex-1 min-w-0 truncate cursor-text"
                  style={{ color: frame.color }}
                  onDoubleClick={e => handleFrameLabelDoubleClick(e, frame.id)}
                >
                  {frame.label}
                </span>
              )}
              {onDeleteFrame && (
                <button
                  onClick={e => { e.stopPropagation(); onDeleteFrame(frame.id) }}
                  className="ml-auto text-[9px] text-white/20 hover:text-red-400 transition-colors shrink-0"
                  onMouseDown={e => e.stopPropagation()}
                >
                  x
                </button>
              )}
            </div>
            {/* Resize handle — bottom-right corner */}
            <div
              className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
              onMouseDown={e => handleFrameResizeStart(e, frame.id)}
            />
          </div>
        ))}

        {/* SVG for edges */}
        <svg
          className="absolute top-0 left-0 pointer-events-none"
          style={{ width: 9999, height: 9999, overflow: 'visible' }}
        >
          {/* Explicit edges (text node connections, reroute connections) */}
          {graph.edges.map(edge => {
            const fromNode = graph.nodes.find(n => n.id === edge.from)
            const toNode = graph.nodes.find(n => n.id === edge.to)
            if (!fromNode || !toNode) return null

            const portIdx = edge.fromPort?.startsWith('option_') ? parseInt(edge.fromPort.split('_')[1]) : 0
            const from = getOutputPort(fromNode, portIdx)
            const to = getInputPort(toNode)
            const colors = NODE_COLORS[fromNode.type]

            return (
              <g key={edge.id}>
                <path
                  d={edgePath(from.x, from.y, to.x, to.y)}
                  stroke="transparent"
                  strokeWidth={12}
                  fill="none"
                  className="pointer-events-auto cursor-pointer"
                  onClick={() => onDeleteEdge(edge.id)}
                />
                <path
                  d={edgePath(from.x, from.y, to.x, to.y)}
                  stroke={colors.border}
                  strokeWidth={2}
                  strokeOpacity={0.6}
                  fill="none"
                />
                <circle cx={to.x} cy={to.y} r={3} fill={colors.border} fillOpacity={0.6} />
              </g>
            )
          })}

          {/* Derived edges (from choice targetNodeIds, action nextNodeIds, condition branches) */}
          {derivedEdges.map(de => {
            const fromNode = graph.nodes.find(n => n.id === de.from)
            const toNode = graph.nodes.find(n => n.id === de.to)
            if (!fromNode || !toNode) return null

            let portIdx = 0
            if (de.fromPort.startsWith('option_')) portIdx = parseInt(de.fromPort.split('_')[1])
            else if (de.fromPort.startsWith('condition_')) portIdx = parseInt(de.fromPort.split('_')[1])
            else if (de.fromPort === 'fallback') portIdx = (fromNode.data as ConditionNodeData).conditions?.length ?? 0

            const from = getOutputPort(fromNode, portIdx)
            const to = getInputPort(toNode)
            const colors = NODE_COLORS[fromNode.type]

            return (
              <g key={de.id}>
                <path
                  d={edgePath(from.x, from.y, to.x, to.y)}
                  stroke="transparent"
                  strokeWidth={12}
                  fill="none"
                  className="pointer-events-auto cursor-pointer"
                  onClick={() => onDisconnect?.(de.from, de.fromPort)}
                />
                <path
                  d={edgePath(from.x, from.y, to.x, to.y)}
                  stroke={colors.border}
                  strokeWidth={2}
                  strokeOpacity={0.6}
                  fill="none"
                />
                <circle cx={to.x} cy={to.y} r={3} fill={colors.border} fillOpacity={0.6} />
              </g>
            )
          })}

          {/* Wire-drag temporary connection */}
          {dragConnection && (() => {
            const fromNode = graph.nodes.find(n => n.id === dragConnection.fromId)
            if (!fromNode) return null
            const portIdx = dragConnection.fromPort?.startsWith('option_') ? parseInt(dragConnection.fromPort.split('_')[1])
              : dragConnection.fromPort?.startsWith('condition_') ? parseInt(dragConnection.fromPort.split('_')[1])
              : dragConnection.fromPort === 'fallback' ? ((fromNode.data as any).conditions?.length ?? 0)
              : 0
            const from = getOutputPort(fromNode, portIdx)
            const rect = containerRef.current?.getBoundingClientRect()
            if (!rect) return null
            const toX = (dragConnection.mouseX - rect.left - pan.x) / zoom
            const toY = (dragConnection.mouseY - rect.top - pan.y) / zoom
            return (
              <path
                d={edgePath(from.x, from.y, toX, toY)}
                stroke="#4ade80"
                strokeWidth={2}
                strokeDasharray="6 4"
                fill="none"
                opacity={0.7}
              />
            )
          })()}
        </svg>

        {/* Node divs */}
        {graph.nodes.map(node => {
          const colors = NODE_COLORS[node.type]
          const isSelected = selectedNodeId === node.id
          const isEntry = graph.entryNodeId === node.id
          const nodeH = getNodeHeight(node)
          const hasIssue = highlightNodeIds?.has(node.id)
          const isCurrentMatch = currentSearchMatchId === node.id
          const isSearchMatch = searchMatchIds?.has(node.id)

          // ── Reroute node — special compact rendering ──
          if (node.type === 'reroute') {
            return (
              <div
                key={node.id}
                className="absolute"
                style={{
                  left: node.position.x - REROUTE_R,
                  top: node.position.y - REROUTE_R,
                  width: REROUTE_R * 2,
                  height: REROUTE_R * 2,
                }}
                onMouseDown={e => handleNodeMouseDown(e, node.id)}
              >
                <div
                  className={`w-full h-full rounded-full border-2 transition-all ${isSelected ? 'scale-125' : ''}`}
                  style={{
                    backgroundColor: NODE_COLORS.reroute.bg,
                    borderColor: isSelected ? '#a78bfa' : NODE_COLORS.reroute.border,
                  }}
                />
                {/* Input port (left) */}
                <div
                  className="absolute flex items-center justify-center cursor-pointer"
                  style={{ left: -10, top: REROUTE_R - 10, width: 20, height: 20 }}
                  onClick={e => handleInputPortClick(e, node.id)}
                >
                  <div
                    className={`w-2 h-2 rounded-full border transition-all ${
                      dragConnection && dragConnection.fromId !== node.id ? 'scale-150' : ''
                    }`}
                    style={{
                      backgroundColor: dragConnection && dragConnection.fromId !== node.id ? '#22c55e' : NODE_COLORS.reroute.bg,
                      borderColor: dragConnection && dragConnection.fromId !== node.id ? '#4ade80' : NODE_COLORS.reroute.border,
                    }}
                  />
                </div>
                {/* Output port (right) */}
                <div
                  className="absolute flex items-center justify-center cursor-pointer"
                  style={{ right: -10, top: REROUTE_R - 10, width: 20, height: 20 }}
                  onMouseDown={e => handleOutputPortMouseDown(e, node.id)}
                >
                  <div
                    className="w-2 h-2 rounded-full border"
                    style={{
                      backgroundColor: NODE_COLORS.reroute.bg,
                      borderColor: NODE_COLORS.reroute.border,
                    }}
                  />
                </div>
              </div>
            )
          }

          // Priority: currentMatch > searchMatch > validation > selected > default
          const borderColor = isCurrentMatch ? '#f59e0b'
            : isSearchMatch ? '#d97706'
            : hasIssue ? '#ef4444'
            : isSelected ? '#a78bfa'
            : colors.border
          const boxShadow = isCurrentMatch ? '0 0 16px rgba(245,158,11,0.4)'
            : isSearchMatch ? '0 0 8px rgba(217,119,6,0.2)'
            : hasIssue && !isSelected ? '0 0 8px rgba(239,68,68,0.3)'
            : isSelected ? '0 0 12px rgba(167,139,250,0.3)'
            : 'none'

          return (
            <div
              key={node.id}
              className="absolute rounded-lg border transition-shadow"
              style={{
                left: node.position.x,
                top: node.position.y,
                width: NODE_W,
                minHeight: nodeH,
                backgroundColor: colors.bg,
                borderColor,
                boxShadow,
              }}
              onMouseDown={e => handleNodeMouseDown(e, node.id)}
              onDoubleClick={() => onSetEntry(node.id)}
            >
              {/* Entry badge */}
              {isEntry && (
                <div className="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-green-500 border border-green-300 flex items-center justify-center">
                  <span className="text-[7px] text-white font-bold">E</span>
                </div>
              )}

              {/* Header — show speaker name for text nodes */}
              <div
                className="flex items-center gap-1.5 px-2 py-1.5 border-b rounded-t-lg"
                style={{ borderColor: colors.border + '40' }}
              >
                <span
                  className="w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center shrink-0"
                  style={{ backgroundColor: colors.border + '30', color: colors.text }}
                >
                  {TYPE_ICONS[node.type]}
                </span>
                <span className="text-[10px] font-medium truncate" style={{ color: colors.text }}>
                  {node.type === 'text' && (node.data as any).speaker
                    ? (node.data as any).speaker
                    : node.type.charAt(0).toUpperCase() + node.type.slice(1)}
                </span>
              </div>

              {/* Body — richer content per type */}
              <div className="px-2 py-1.5">
                {node.type === 'choice' ? (
                  <div className="space-y-0.5">
                    {((node.data as ChoiceNodeData).options ?? []).map((opt, i) => (
                      <div key={i} className="text-[9px] text-white/40 truncate flex items-center gap-1">
                        <span className="text-[#d4a843]/50 shrink-0">{i + 1}.</span>
                        <span>{opt.label || 'Empty'}</span>
                      </div>
                    ))}
                  </div>
                ) : node.type === 'condition' ? (
                  <div className="space-y-0.5">
                    {((node.data as ConditionNodeData).conditions ?? []).map((cond, i) => (
                      <div key={i} className="text-[9px] text-white/40 truncate">
                        {cond.check.type === 'flag' ? `flag: ${(cond.check as any).flag}`
                          : cond.check.type === 'item' ? `item: ${(cond.check as any).itemId}`
                          : cond.check.type === 'skill' ? `skill: ${(cond.check as any).skillId}`
                          : cond.check.type}
                      </div>
                    ))}
                    <div className="text-[9px] text-white/25 italic">fallback</div>
                  </div>
                ) : (
                  <div className="text-[10px] text-white/50 truncate">{getNodeLabel(node)}</div>
                )}
              </div>

              {/* Input port (left) */}
              <div
                className="absolute flex items-center justify-center cursor-pointer"
                style={{ left: -10, top: nodeH / 2 - 10, width: 20, height: 20 }}
                onClick={e => handleInputPortClick(e, node.id)}
              >
                <div
                  className={`w-3 h-3 rounded-full border-2 pointer-events-none transition-all ${
                    dragConnection && dragConnection.fromId !== node.id ? 'scale-125' : ''
                  }`}
                  style={{
                    backgroundColor: dragConnection && dragConnection.fromId !== node.id ? '#22c55e' : colors.bg,
                    borderColor: dragConnection && dragConnection.fromId !== node.id ? '#4ade80' : colors.border,
                  }}
                />
              </div>

              {/* Output port(s) (right) — mousedown to start wire drag */}
              {node.type === 'choice' ? (
                ((node.data as ChoiceNodeData).options ?? [{ label: 'Option 1' }]).map((_: any, i: number) => {
                  const opts = (node.data as ChoiceNodeData).options?.length ?? 1
                  const spacing = nodeH / (opts + 1)
                  return (
                    <div
                      key={i}
                      className="absolute flex items-center justify-center cursor-crosshair"
                      style={{ right: -10, top: spacing * (i + 1) - 10, width: 20, height: 20 }}
                      onMouseDown={e => handleOutputPortMouseDown(e, node.id, i)}
                    >
                      <div
                        className="w-3 h-3 rounded-full border-2 pointer-events-none transition-all"
                        style={{
                          backgroundColor: colors.bg,
                          borderColor: colors.border,
                        }}
                      />
                    </div>
                  )
                })
              ) : node.type === 'condition' ? (
                (() => {
                  const conds = (node.data as ConditionNodeData).conditions?.length ?? 0
                  const total = conds + 1
                  const spacing = nodeH / (total + 1)
                  return Array.from({ length: total }, (_, i) => (
                    <div
                      key={i}
                      className="absolute flex items-center justify-center cursor-crosshair"
                      style={{ right: -10, top: spacing * (i + 1) - 10, width: 20, height: 20 }}
                      onMouseDown={e => handleOutputPortMouseDown(e, node.id, i)}
                    >
                      <div
                        className="w-3 h-3 rounded-full border-2 pointer-events-none transition-all"
                        style={{
                          backgroundColor: colors.bg,
                          borderColor: i === conds ? '#888' : colors.border,
                        }}
                      />
                    </div>
                  ))
                })()
              ) : (
                // Text/Action: single output port
                <div
                  className="absolute flex items-center justify-center cursor-crosshair"
                  style={{ right: -10, top: nodeH / 2 - 10, width: 20, height: 20 }}
                  onMouseDown={e => handleOutputPortMouseDown(e, node.id)}
                >
                  <div
                    className="w-3 h-3 rounded-full border-2 pointer-events-none transition-all"
                    style={{
                      backgroundColor: colors.bg,
                      borderColor: colors.border,
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="absolute z-50 bg-[#1a1a2e] border border-white/15 rounded-lg shadow-xl py-1 min-w-[140px]"
          style={{
            left: contextMenu.screenX - (containerRef.current?.getBoundingClientRect().left ?? 0),
            top: contextMenu.screenY - (containerRef.current?.getBoundingClientRect().top ?? 0),
          }}
        >
          <div className="px-3 py-1 text-[9px] text-white/30 uppercase tracking-wider">Add Node</div>
          {(['text', 'choice', 'condition', 'action'] as const).map(type => (
            <button
              key={type}
              onClick={() => handleContextAdd(type)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/10 transition-colors"
            >
              <span
                className="w-3 h-3 rounded"
                style={{ backgroundColor: NODE_COLORS[type].border }}
              />
              <span style={{ color: NODE_COLORS[type].text }}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </span>
            </button>
          ))}
          <div className="border-t border-white/10 my-1" />
          <button
            onClick={() => { handleContextAdd('reroute') }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/10 transition-colors"
          >
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS.reroute.border }} />
            <span style={{ color: NODE_COLORS.reroute.text }}>Reroute</span>
          </button>
          {onAddFrame && (
            <button
              onClick={() => { onAddFrame({ x: contextMenu.x, y: contextMenu.y }); setContextMenu(null) }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/10 transition-colors"
            >
              <span className="w-3 h-3 rounded border border-white/30" />
              <span className="text-white/60">Frame</span>
            </button>
          )}
        </div>
      )}

      {/* Wire-drop create menu */}
      {wireDropMenu && (
        <div
          className="absolute z-50 bg-[#1a1a2e] border border-white/15 rounded-lg shadow-xl py-1 min-w-[140px]"
          style={{
            left: wireDropMenu.screenX - (containerRef.current?.getBoundingClientRect().left ?? 0),
            top: wireDropMenu.screenY - (containerRef.current?.getBoundingClientRect().top ?? 0),
          }}
        >
          <div className="px-3 py-1 text-[9px] text-white/30 uppercase tracking-wider">Create + Connect</div>
          {(['text', 'choice', 'condition', 'action', 'reroute'] as const)
            .filter(type => {
              // Exclude choice from choice option ports (prevents nested choices via wire-drag)
              if (type === 'choice') {
                const fromNode = graph.nodes.find(n => n.id === wireDropMenu.fromId)
                if (fromNode?.type === 'choice') return false
              }
              return true
            })
            .map(type => (
              <button
                key={type}
                onClick={() => {
                  if (onCreateAndConnect) {
                    onCreateAndConnect(
                      type,
                      { x: wireDropMenu.x - NODE_W / 2, y: wireDropMenu.y - NODE_H / 2 },
                      wireDropMenu.fromId,
                      wireDropMenu.fromPort,
                    )
                  }
                  setWireDropMenu(null)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/10 transition-colors"
              >
                <span className="w-3 h-3 rounded" style={{ backgroundColor: NODE_COLORS[type].border }} />
                <span style={{ color: NODE_COLORS[type].text }}>
                  {type === 'reroute' ? 'Reroute' : type.charAt(0).toUpperCase() + type.slice(1)}
                </span>
              </button>
            ))}
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-[#0a0a1a]/80 border border-white/10 rounded-lg px-2 py-1">
        <button
          onClick={() => applyZoom(zoom - 0.15)}
          className="text-white/40 hover:text-white/70 text-sm w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
        >
          -
        </button>
        <input
          type="range"
          min={25}
          max={300}
          value={Math.round(zoom * 100)}
          onChange={e => applyZoom(parseInt(e.target.value) / 100)}
          className="w-20 h-1 accent-violet-500 cursor-pointer"
        />
        <button
          onClick={() => applyZoom(zoom + 0.15)}
          className="text-white/40 hover:text-white/70 text-sm w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
        >
          +
        </button>
        <span className="text-[9px] text-white/30 tabular-nums w-8 text-center">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => applyZoom(1)}
          className="text-[9px] text-white/30 hover:text-white/50 transition-colors"
        >
          1:1
        </button>
      </div>

      {/* Help hint */}
      <div className="absolute bottom-3 right-3 text-[9px] text-white/20">
        Right-click to add | Drag port to connect | Double-click for entry | Ctrl+scroll to zoom
      </div>
    </div>
  )
}
