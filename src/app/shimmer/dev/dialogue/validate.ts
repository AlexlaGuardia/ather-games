import type { DialogueGraph, DialogueNode, TextNodeData, ChoiceNodeData, ConditionNodeData, ActionNodeData } from './types'

export type ValidationSeverity = 'error' | 'warning'

export interface ValidationIssue {
  severity: ValidationSeverity
  nodeId?: string
  code: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
  errorCount: number
  warningCount: number
}

/** Collect all outgoing node ID references from a node (both data-embedded and explicit edges) */
function getOutgoingRefs(node: DialogueNode, graph: DialogueGraph): string[] {
  const refs: string[] = []
  switch (node.type) {
    case 'text': {
      for (const e of graph.edges) {
        if (e.from === node.id && e.to) refs.push(e.to)
      }
      break
    }
    case 'reroute': {
      for (const e of graph.edges) {
        if (e.from === node.id && e.to) refs.push(e.to)
      }
      break
    }
    case 'choice': {
      const d = node.data as ChoiceNodeData
      for (const opt of d.options ?? []) {
        if (opt.targetNodeId) refs.push(opt.targetNodeId)
      }
      break
    }
    case 'condition': {
      const d = node.data as ConditionNodeData
      for (const cond of d.conditions ?? []) {
        if (cond.targetNodeId) refs.push(cond.targetNodeId)
      }
      if (d.fallbackNodeId) refs.push(d.fallbackNodeId)
      break
    }
    case 'action': {
      const d = node.data as ActionNodeData
      if (d.nextNodeId) refs.push(d.nextNodeId)
      break
    }
  }
  return refs
}

export function validateGraph(graph: DialogueGraph): ValidationResult {
  const issues: ValidationIssue[] = []
  const nodeIds = new Set(graph.nodes.map(n => n.id))

  // 1. Invalid entry node
  if (!graph.entryNodeId || !nodeIds.has(graph.entryNodeId)) {
    issues.push({
      severity: 'error',
      code: 'invalid_entry',
      message: `Entry node "${graph.entryNodeId || '(empty)'}" does not exist`,
    })
  }

  // 2. Dangling references + 3-5 per-node checks
  for (const node of graph.nodes) {
    switch (node.type) {
      case 'text': {
        const d = node.data as TextNodeData
        // 3. Empty text
        if (!d.speaker?.trim()) {
          issues.push({ severity: 'error', nodeId: node.id, code: 'empty_text', message: 'Text node has no speaker' })
        }
        if (!d.text?.trim()) {
          issues.push({ severity: 'error', nodeId: node.id, code: 'empty_text', message: 'Text node has no dialogue text' })
        }
        // Dangling: check explicit edges
        for (const edge of graph.edges) {
          if (edge.from === node.id && edge.to && !nodeIds.has(edge.to)) {
            issues.push({ severity: 'error', nodeId: node.id, code: 'dangling_ref', message: `Edge points to missing node "${edge.to}"` })
          }
        }
        break
      }
      case 'reroute': {
        // Only check dangling edge references
        for (const edge of graph.edges) {
          if (edge.from === node.id && edge.to && !nodeIds.has(edge.to)) {
            issues.push({ severity: 'error', nodeId: node.id, code: 'dangling_ref', message: `Edge points to missing node "${edge.to}"` })
          }
        }
        break
      }
      case 'choice': {
        const d = node.data as ChoiceNodeData
        for (let i = 0; i < (d.options ?? []).length; i++) {
          const opt = d.options[i]
          // 5. Choice without target
          if (!opt.targetNodeId) {
            issues.push({ severity: 'error', nodeId: node.id, code: 'choice_no_target', message: `Option ${i + 1} "${opt.label || 'Empty'}" has no target` })
          }
          // 2. Dangling
          else if (!nodeIds.has(opt.targetNodeId)) {
            issues.push({ severity: 'error', nodeId: node.id, code: 'dangling_ref', message: `Option ${i + 1} points to missing node "${opt.targetNodeId}"` })
          }
        }
        break
      }
      case 'condition': {
        const d = node.data as ConditionNodeData
        // Dangling on branches
        for (let i = 0; i < (d.conditions ?? []).length; i++) {
          const cond = d.conditions[i]
          if (cond.targetNodeId && !nodeIds.has(cond.targetNodeId)) {
            issues.push({ severity: 'error', nodeId: node.id, code: 'dangling_ref', message: `Condition ${i + 1} points to missing node "${cond.targetNodeId}"` })
          }
        }
        // 4. Missing fallback
        if ((d.conditions ?? []).length > 0 && !d.fallbackNodeId) {
          issues.push({ severity: 'error', nodeId: node.id, code: 'missing_fallback', message: 'Condition node has no fallback target' })
        }
        // Dangling fallback
        if (d.fallbackNodeId && !nodeIds.has(d.fallbackNodeId)) {
          issues.push({ severity: 'error', nodeId: node.id, code: 'dangling_ref', message: `Fallback points to missing node "${d.fallbackNodeId}"` })
        }
        break
      }
      case 'action': {
        const d = node.data as ActionNodeData
        if (d.nextNodeId && !nodeIds.has(d.nextNodeId)) {
          issues.push({ severity: 'error', nodeId: node.id, code: 'dangling_ref', message: `Next node "${d.nextNodeId}" does not exist` })
        }
        break
      }
    }
  }

  // 6. Unreachable nodes — BFS from entry
  if (graph.entryNodeId && nodeIds.has(graph.entryNodeId)) {
    const reachable = new Set<string>()
    const queue = [graph.entryNodeId]
    while (queue.length > 0) {
      const id = queue.shift()!
      if (reachable.has(id)) continue
      reachable.add(id)
      const node = graph.nodes.find(n => n.id === id)
      if (!node) continue
      for (const ref of getOutgoingRefs(node, graph)) {
        if (nodeIds.has(ref) && !reachable.has(ref)) queue.push(ref)
      }
    }
    for (const node of graph.nodes) {
      if (!reachable.has(node.id)) {
        issues.push({ severity: 'warning', nodeId: node.id, code: 'unreachable', message: 'Node is not reachable from entry' })
      }
    }
  }

  // 7. Cycle detection — DFS back-edge check (warning only)
  if (graph.entryNodeId && nodeIds.has(graph.entryNodeId)) {
    const visited = new Set<string>()
    const inStack = new Set<string>()
    const reportedCycles = new Set<string>()

    function dfs(id: string) {
      if (inStack.has(id)) {
        if (!reportedCycles.has(id)) {
          reportedCycles.add(id)
          const node = graph.nodes.find(n => n.id === id)
          const label = node?.type === 'text' ? (node.data as TextNodeData).speaker || id : id
          issues.push({ severity: 'warning', nodeId: id, code: 'cycle', message: `Cycle detected at "${label}"` })
        }
        return
      }
      if (visited.has(id)) return
      visited.add(id)
      inStack.add(id)
      const node = graph.nodes.find(n => n.id === id)
      if (node) {
        for (const ref of getOutgoingRefs(node, graph)) {
          if (nodeIds.has(ref)) dfs(ref)
        }
      }
      inStack.delete(id)
    }

    dfs(graph.entryNodeId)
  }

  const errorCount = issues.filter(i => i.severity === 'error').length
  const warningCount = issues.filter(i => i.severity === 'warning').length

  return {
    valid: errorCount === 0,
    issues,
    errorCount,
    warningCount,
  }
}
