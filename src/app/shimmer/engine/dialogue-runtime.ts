// Dialogue Runtime — Graph Walker
// Replaces the linear dialogue.ts state machine with branching graph support

import type {
  DialogueGraph, DialogueNode, DialogueEdge, DialogueRuntimeState,
  TextNodeData, ChoiceNodeData, ConditionNodeData, ActionNodeData,
  DialogueCondition, DialogueAction, ChoiceOption,
} from './dialogue-schema'

// ── Graph Registry ──

const graphs = new Map<string, DialogueGraph>()

export function registerGraph(g: DialogueGraph) { graphs.set(g.id, g) }
export function registerGraphs(gs: DialogueGraph[]) { gs.forEach(registerGraph) }
export function getGraph(id: string): DialogueGraph | null { return graphs.get(id) ?? null }
export function getAllGraphIds(): string[] { return Array.from(graphs.keys()) }
export function getGraphsForNPC(npcId: string): DialogueGraph[] {
  return Array.from(graphs.values()).filter(g => g.npcId === npcId)
}

// ── Game Context (passed in for condition evaluation) ──

export interface GameContext {
  flags: Record<string, boolean>
  countItem: (id: string) => number
  getSkillLevel: (id: string) => number
  getReputation: (npcId: string) => number
  spirits: { species: string }[]
  timePhase: 'dawn' | 'day' | 'dusk' | 'night'
}

// ── State ──

const CHARS_PER_FRAME = 0.6  // ~36 chars/sec at 60fps

export function createRuntimeState(): DialogueRuntimeState {
  return {
    active: false,
    graphId: '',
    currentNodeId: '',
    charProgress: 0,
    lineComplete: false,
    choices: null,
    pendingActions: null,
  }
}

// ── Core API ──

/** Start a dialogue graph. Returns false if graph not found. */
export function startDialogue(state: DialogueRuntimeState, graphId: string, ctx: GameContext): boolean {
  const graph = graphs.get(graphId)
  if (!graph || graph.nodes.length === 0) return false

  state.active = true
  state.graphId = graphId
  state.currentNodeId = graph.entryNodeId
  state.charProgress = 0
  state.lineComplete = false
  state.choices = null
  state.pendingActions = null

  // If entry node is condition/action, resolve immediately
  resolveNonTextNodes(state, ctx)
  return state.active
}

/** Typewriter tick — call every render frame. Returns true if text changed. */
export function tickDialogue(state: DialogueRuntimeState): boolean {
  if (!state.active || state.lineComplete) return false
  const node = getCurrentNode(state)
  if (!node || node.type !== 'text') return false

  const text = (node.data as TextNodeData).text
  state.charProgress += CHARS_PER_FRAME
  if (state.charProgress >= text.length) {
    state.charProgress = text.length
    state.lineComplete = true
  }
  return true
}

/** Space/click on a text node — skip typewriter or advance to next node. */
export function advanceDialogue(state: DialogueRuntimeState, ctx: GameContext): boolean {
  if (!state.active) return false
  const node = getCurrentNode(state)
  if (!node) { state.active = false; return false }

  // Text node: skip typewriter first, then advance
  if (node.type === 'text') {
    if (!state.lineComplete) {
      const text = (node.data as TextNodeData).text
      state.charProgress = text.length
      state.lineComplete = true
      return true
    }
    // Follow edge to next node
    return advanceToNext(state, node.id, ctx)
  }

  return false
}

/** Player selects a choice option (0-indexed). */
export function selectChoice(state: DialogueRuntimeState, index: number, ctx: GameContext): boolean {
  if (!state.active || !state.choices) return false
  const option = state.choices[index]
  if (!option) return false

  state.choices = null
  return advanceToNode(state, option.targetNodeId, ctx)
}

// ── Queries ──

export function getCurrentNode(state: DialogueRuntimeState): DialogueNode | null {
  if (!state.active) return null
  const graph = graphs.get(state.graphId)
  return graph?.nodes.find(n => n.id === state.currentNodeId) ?? null
}

export function getVisibleText(state: DialogueRuntimeState): string {
  const node = getCurrentNode(state)
  if (!node || node.type !== 'text') return ''
  return (node.data as TextNodeData).text.substring(0, Math.floor(state.charProgress))
}

export function getCurrentSpeaker(state: DialogueRuntimeState): string | null {
  const node = getCurrentNode(state)
  if (!node) return null
  if (node.type === 'text') return (node.data as TextNodeData).speaker || null
  if (node.type === 'choice') return null // choices don't have a speaker
  return null
}

export function getCurrentEmotion(state: DialogueRuntimeState): string | null {
  const node = getCurrentNode(state)
  if (!node || node.type !== 'text') return null
  return (node.data as TextNodeData).emotion ?? null
}

/** Get pending actions that the game should execute. Clears them after reading. */
export function consumeActions(state: DialogueRuntimeState): DialogueAction[] | null {
  if (!state.pendingActions) return null
  const actions = state.pendingActions
  state.pendingActions = null
  return actions
}

/** Get available choices (filtered by conditions). Null when not on a choice node. */
export function getChoices(state: DialogueRuntimeState, ctx: GameContext): ChoiceOption[] | null {
  const node = getCurrentNode(state)
  if (!node || node.type !== 'choice') return null
  const data = node.data as ChoiceNodeData
  return data.options.filter(opt => !opt.condition || evaluateCondition(opt.condition, ctx))
}

export function getChoicePrompt(state: DialogueRuntimeState): string | null {
  const node = getCurrentNode(state)
  if (!node || node.type !== 'choice') return null
  return (node.data as ChoiceNodeData).prompt ?? null
}

// ── Condition Evaluator ──

export function evaluateCondition(cond: DialogueCondition, ctx: GameContext): boolean {
  switch (cond.type) {
    case 'flag':
      return (ctx.flags[cond.flag] ?? false) === cond.value
    case 'item': {
      const count = ctx.countItem(cond.itemId)
      if (cond.op === '>=') return count >= cond.count
      if (cond.op === '<') return count < cond.count
      return count === cond.count
    }
    case 'skill': {
      const level = ctx.getSkillLevel(cond.skillId)
      if (cond.op === '>=') return level >= cond.level
      if (cond.op === '<') return level < cond.level
      return false
    }
    case 'spirit':
      return ctx.spirits.some(s => s.species === cond.species)
    case 'time':
      return ctx.timePhase === cond.phase
    case 'reputation': {
      const rep = ctx.getReputation(cond.npcId)
      if (cond.op === '>=') return rep >= cond.level
      if (cond.op === '<') return rep < cond.level
      return false
    }
    case 'and':
      return cond.conditions.every(c => evaluateCondition(c, ctx))
    case 'or':
      return cond.conditions.some(c => evaluateCondition(c, ctx))
    default:
      return false
  }
}

// ── Internal helpers ──

function getEdgesFrom(graph: DialogueGraph, nodeId: string): DialogueEdge[] {
  return graph.edges.filter(e => e.from === nodeId)
}

/** Move to a specific node by ID. Resolves non-text nodes automatically. */
function advanceToNode(state: DialogueRuntimeState, nodeId: string, ctx: GameContext): boolean {
  const graph = graphs.get(state.graphId)
  if (!graph) { state.active = false; return false }
  const target = graph.nodes.find(n => n.id === nodeId)
  if (!target) { state.active = false; return false }

  state.currentNodeId = nodeId
  state.charProgress = 0
  state.lineComplete = false
  state.choices = null

  resolveNonTextNodes(state, ctx)
  return state.active
}

/** Follow the first edge out of the current node. */
function advanceToNext(state: DialogueRuntimeState, fromNodeId: string, ctx: GameContext): boolean {
  const graph = graphs.get(state.graphId)
  if (!graph) { state.active = false; return false }

  const edges = getEdgesFrom(graph, fromNodeId)
  if (edges.length === 0) {
    // No outgoing edges — dialogue ends
    state.active = false
    return false
  }

  return advanceToNode(state, edges[0].to, ctx)
}

/** Auto-resolve condition and action nodes until we land on text or choice. */
function resolveNonTextNodes(state: DialogueRuntimeState, ctx: GameContext): void {
  let depth = 0
  while (state.active && depth < 50) {
    const node = getCurrentNode(state)
    if (!node) { state.active = false; return }

    if (node.type === 'text') return // stay here, show typewriter
    if (node.type === 'choice') {
      // Filter choices by conditions, present to player
      const data = node.data as ChoiceNodeData
      state.choices = data.options.filter(opt => !opt.condition || evaluateCondition(opt.condition, ctx))
      if (state.choices.length === 0) {
        // No valid choices — end dialogue
        state.active = false
      }
      return
    }
    if (node.type === 'condition') {
      const data = node.data as ConditionNodeData
      let matched = false
      for (const branch of data.conditions) {
        if (evaluateCondition(branch.check, ctx)) {
          state.currentNodeId = branch.targetNodeId
          matched = true
          break
        }
      }
      if (!matched) {
        if (data.fallbackNodeId) {
          state.currentNodeId = data.fallbackNodeId
        } else {
          state.active = false
          return
        }
      }
    } else if (node.type === 'action') {
      const data = node.data as ActionNodeData
      state.pendingActions = [...(state.pendingActions ?? []), ...data.actions]
      if (data.nextNodeId) {
        state.currentNodeId = data.nextNodeId
      } else {
        // Actions with no next = end of dialogue
        state.active = false
        return
      }
    }
    depth++
  }
}

// ── Legacy bridge: convert old linear Dialogue to DialogueGraph ──

interface LegacyDialogueLine {
  speaker?: string
  text: string
  voiceRef?: string
  mood?: string
}

interface LegacyDialogue {
  id: string
  lines: LegacyDialogueLine[]
  repeatable?: boolean
  onComplete?: string
}

/** Convert a legacy linear dialogue to a DialogueGraph (for migration). */
export function convertLegacyDialogue(d: LegacyDialogue, npcId: string): DialogueGraph {
  const nodes: DialogueNode[] = []
  const edges: DialogueEdge[] = []

  // Create text nodes in sequence
  d.lines.forEach((line, i) => {
    nodes.push({
      id: `${d.id}_${i}`,
      type: 'text',
      position: { x: 100, y: i * 120 },
      data: {
        speaker: line.speaker ?? 'narrator',
        text: line.text,
        emotion: line.mood,
      } satisfies TextNodeData,
    })
  })

  // If there's an onComplete flag, add an action node at the end
  if (d.onComplete) {
    const actionId = `${d.id}_action`
    nodes.push({
      id: actionId,
      type: 'action',
      position: { x: 100, y: d.lines.length * 120 },
      data: {
        actions: [{ type: 'setFlag', flag: d.onComplete, value: true }],
      } satisfies ActionNodeData,
    })
  }

  // Wire edges: each text node → next text node, last text → action (if exists)
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({ id: `${d.id}_e${i}`, from: nodes[i].id, to: nodes[i + 1].id })
  }

  return {
    id: d.id,
    npcId,
    nodes,
    edges,
    entryNodeId: nodes[0].id,
    metadata: { tags: d.repeatable === false ? ['one-shot'] : [] },
  }
}
