'use client'

import { useCallback } from 'react'
import type {
  DialogueGraph,
  DialogueNode,
  TextNodeData,
  ChoiceNodeData,
  ConditionNodeData,
  ActionNodeData,
  DialogueAction,
  DialogueNodeType,
} from './types'
import { NODE_COLORS } from './types'
import SchemaForm from '../templates/SchemaForm'
import { TEXT_NODE_FIELDS } from '../templates/field-types'

interface PropertiesPanelProps {
  node: DialogueNode | null
  graph: DialogueGraph | null
  onUpdateNode: (nodeId: string, data: DialogueNode['data']) => void
  onSetEntry: (nodeId: string) => void
}

// Small labeled input
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] text-white/40 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

const INPUT_CLS = 'w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-violet-500/50'
const SELECT_CLS = 'w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-violet-500/50 appearance-none'

// Node target dropdown — replaces raw ID text inputs
function NodeSelect({ value, onChange, graph, excludeId, label }: {
  value: string; onChange: (id: string) => void; graph: DialogueGraph | null; excludeId: string; label?: string
}) {
  const nodeLabel = (n: DialogueNode) => {
    if (n.type === 'text') {
      const speaker = (n.data as TextNodeData).speaker
      const text = (n.data as TextNodeData).text
      return `${speaker}: ${text?.slice(0, 18) ?? ''}${(text?.length ?? 0) > 18 ? '...' : ''}`
    }
    return `${n.type} (${n.id.slice(-8)})`
  }

  return (
    <select
      className={SELECT_CLS}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">{label ?? '-- none --'}</option>
      {graph?.nodes.filter(n => n.id !== excludeId).map(n => (
        <option key={n.id} value={n.id}>{nodeLabel(n)}</option>
      ))}
    </select>
  )
}

export default function PropertiesPanel({ node, graph, onUpdateNode, onSetEntry }: PropertiesPanelProps) {
  const updateData = useCallback((patch: Record<string, any>) => {
    if (!node) return
    onUpdateNode(node.id, { ...node.data, ...patch })
  }, [node, onUpdateNode])

  if (!node) {
    return (
      <div className="flex items-center justify-center h-full text-white/25 text-xs p-4 text-center">
        Select a node to edit its properties
      </div>
    )
  }

  const colors = NODE_COLORS[node.type]
  const isEntry = graph?.entryNodeId === node.id

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded"
            style={{ backgroundColor: colors.border }}
          />
          <span className="text-xs font-medium" style={{ color: colors.text }}>
            {node.type.charAt(0).toUpperCase() + node.type.slice(1)} Node
          </span>
        </div>
        <div className="text-[9px] text-white/30 mt-1 font-mono">{node.id}</div>

        {/* Entry toggle */}
        <button
          onClick={() => onSetEntry(node.id)}
          className={`mt-2 px-2 py-0.5 rounded text-[10px] border transition-colors ${
            isEntry
              ? 'bg-green-500/20 border-green-500/40 text-green-300'
              : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
          }`}
        >
          {isEntry ? 'Entry Node' : 'Set as Entry'}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {node.type === 'text' && <TextNodeEditor data={node.data as TextNodeData} onChange={updateData} />}
        {node.type === 'choice' && <ChoiceNodeEditor data={node.data as ChoiceNodeData} onChange={updateData} graph={graph} currentNodeId={node.id} />}
        {node.type === 'condition' && <ConditionNodeEditor data={node.data as ConditionNodeData} onChange={updateData} graph={graph} currentNodeId={node.id} />}
        {node.type === 'action' && <ActionNodeEditor data={node.data as ActionNodeData} onChange={updateData} graph={graph} currentNodeId={node.id} />}
        {node.type === 'reroute' && <div className="text-[10px] text-white/30 italic">Reroute node &mdash; no properties to edit</div>}
      </div>
    </div>
  )
}

// ── Text Node — powered by SchemaForm ──
function TextNodeEditor({ data, onChange }: { data: TextNodeData; onChange: (p: any) => void }) {
  return <SchemaForm fields={TEXT_NODE_FIELDS} data={data as any} onChange={onChange} />
}

// ── Choice Node ──
function ChoiceNodeEditor({ data, onChange, graph, currentNodeId }: { data: ChoiceNodeData; onChange: (p: any) => void; graph: DialogueGraph | null; currentNodeId: string }) {
  const updateOption = (index: number, patch: Record<string, any>) => {
    const options = [...data.options]
    options[index] = { ...options[index], ...patch }
    onChange({ options })
  }

  const addOption = () => {
    onChange({
      options: [...data.options, { label: `Option ${data.options.length + 1}`, targetNodeId: '' }],
    })
  }

  const removeOption = (index: number) => {
    onChange({ options: data.options.filter((_, i) => i !== index) })
  }

  return (
    <>
      <Field label="Prompt">
        <input
          className={INPUT_CLS}
          value={data.prompt ?? ''}
          onChange={e => onChange({ prompt: e.target.value })}
          placeholder="Optional text before choices..."
        />
      </Field>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-white/40 uppercase tracking-wider">Options</span>
          <button
            onClick={addOption}
            className="text-[9px] text-violet-400 hover:text-violet-300"
          >
            + Add
          </button>
        </div>

        {data.options.map((opt, i) => (
          <div key={i} className="bg-white/5 rounded p-2 space-y-1.5">
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-white/30 w-4 shrink-0">{i + 1}.</span>
              <input
                className={INPUT_CLS}
                value={opt.label}
                onChange={e => updateOption(i, { label: e.target.value })}
                placeholder="Option text..."
              />
              {data.options.length > 1 && (
                <button
                  onClick={() => removeOption(i)}
                  className="text-red-400/60 hover:text-red-400 text-xs shrink-0 px-1"
                >
                  x
                </button>
              )}
            </div>
            <NodeSelect
              value={opt.targetNodeId}
              onChange={id => updateOption(i, { targetNodeId: id })}
              graph={graph}
              excludeId={currentNodeId}
              label="-- target node --"
            />
          </div>
        ))}
      </div>
    </>
  )
}

// ── Condition Node ──
function ConditionNodeEditor({ data, onChange, graph, currentNodeId }: { data: ConditionNodeData; onChange: (p: any) => void; graph: DialogueGraph | null; currentNodeId: string }) {
  const addCondition = () => {
    onChange({
      conditions: [...data.conditions, { check: { type: 'flag', flag: '', value: true }, targetNodeId: '' }],
    })
  }

  const removeCondition = (index: number) => {
    onChange({ conditions: data.conditions.filter((_, i) => i !== index) })
  }

  const updateCondition = (index: number, patch: Record<string, any>) => {
    const conditions = [...data.conditions]
    conditions[index] = { ...conditions[index], ...patch }
    onChange({ conditions })
  }

  const updateCheck = (index: number, checkPatch: Record<string, any>) => {
    const conditions = [...data.conditions]
    conditions[index] = { ...conditions[index], check: { ...conditions[index].check, ...checkPatch } }
    onChange({ conditions })
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-white/40 uppercase tracking-wider">Conditions</span>
          <button
            onClick={addCondition}
            className="text-[9px] text-violet-400 hover:text-violet-300"
          >
            + Add
          </button>
        </div>

        {data.conditions.map((cond, i) => (
          <div key={i} className="bg-white/5 rounded p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-white/30">Check {i + 1}</span>
              <button
                onClick={() => removeCondition(i)}
                className="text-red-400/60 hover:text-red-400 text-[9px]"
              >
                remove
              </button>
            </div>

            <select
              className={SELECT_CLS}
              value={cond.check.type}
              onChange={e => updateCheck(i, { type: e.target.value })}
            >
              <option value="flag">Flag</option>
              <option value="item">Has Item</option>
              <option value="skill">Skill Level</option>
              <option value="spirit">Spirit in Party</option>
              <option value="time">Time of Day</option>
            </select>

            {cond.check.type === 'flag' && (
              <div className="flex gap-1">
                <input
                  className={INPUT_CLS}
                  value={(cond.check as any).flag ?? ''}
                  onChange={e => updateCheck(i, { flag: e.target.value })}
                  placeholder="Flag name..."
                />
                <select
                  className={SELECT_CLS + ' w-16 shrink-0'}
                  value={String((cond.check as any).value ?? true)}
                  onChange={e => updateCheck(i, { value: e.target.value === 'true' })}
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </div>
            )}

            {cond.check.type === 'item' && (
              <div className="flex gap-1">
                <input
                  className={INPUT_CLS}
                  value={(cond.check as any).itemId ?? ''}
                  onChange={e => updateCheck(i, { itemId: e.target.value })}
                  placeholder="Item ID..."
                />
                <select
                  className={SELECT_CLS + ' w-12 shrink-0'}
                  value={(cond.check as any).op ?? '>='}
                  onChange={e => updateCheck(i, { op: e.target.value })}
                >
                  <option value=">=">{'>='}  </option>
                  <option value="<">{'<'}</option>
                  <option value="==">{'=='}</option>
                </select>
                <input
                  type="number"
                  className={INPUT_CLS + ' w-12 shrink-0'}
                  value={(cond.check as any).count ?? 1}
                  onChange={e => updateCheck(i, { count: parseInt(e.target.value) || 0 })}
                  min={0}
                />
              </div>
            )}

            {cond.check.type === 'time' && (
              <select
                className={SELECT_CLS}
                value={(cond.check as any).phase ?? 'day'}
                onChange={e => updateCheck(i, { phase: e.target.value })}
              >
                <option value="dawn">Dawn</option>
                <option value="day">Day</option>
                <option value="dusk">Dusk</option>
                <option value="night">Night</option>
              </select>
            )}

            <NodeSelect
              value={cond.targetNodeId}
              onChange={id => updateCondition(i, { targetNodeId: id })}
              graph={graph}
              excludeId={currentNodeId}
              label="-- if true, go to --"
            />
          </div>
        ))}
      </div>

      <Field label="Fallback (no match)">
        <NodeSelect
          value={data.fallbackNodeId}
          onChange={id => onChange({ fallbackNodeId: id })}
          graph={graph}
          excludeId={currentNodeId}
          label="-- fallback node --"
        />
      </Field>
    </>
  )
}

// ── Action Node ──
function ActionNodeEditor({ data, onChange, graph, currentNodeId }: { data: ActionNodeData; onChange: (p: any) => void; graph: DialogueGraph | null; currentNodeId: string }) {
  const addAction = () => {
    onChange({
      actions: [...data.actions, { type: 'setFlag', flag: '', value: true }],
    })
  }

  const removeAction = (index: number) => {
    onChange({ actions: data.actions.filter((_, i) => i !== index) })
  }

  const updateAction = (index: number, patch: Record<string, any>) => {
    const actions = [...data.actions]
    actions[index] = { ...actions[index], ...patch }
    onChange({ actions })
  }

  const ACTION_TYPES: { value: DialogueAction['type']; label: string }[] = [
    { value: 'setFlag', label: 'Set Flag' },
    { value: 'giveItem', label: 'Give Item' },
    { value: 'removeItem', label: 'Remove Item' },
    { value: 'startBattle', label: 'Start Battle' },
    { value: 'openShop', label: 'Open Shop' },
    { value: 'heal', label: 'Heal Party' },
    { value: 'teleport', label: 'Teleport' },
    { value: 'playSound', label: 'Play Sound' },
    { value: 'setEmotion', label: 'Set Emotion' },
    { value: 'giveStarterSeed', label: 'Give Starter Seed (RNG)' },
  ]

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-white/40 uppercase tracking-wider">Actions</span>
          <button
            onClick={addAction}
            className="text-[9px] text-violet-400 hover:text-violet-300"
          >
            + Add
          </button>
        </div>

        {data.actions.map((action, i) => (
          <div key={i} className="bg-white/5 rounded p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <select
                className={SELECT_CLS + ' flex-1'}
                value={action.type}
                onChange={e => updateAction(i, { type: e.target.value })}
              >
                {ACTION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <button
                onClick={() => removeAction(i)}
                className="text-red-400/60 hover:text-red-400 text-[9px] ml-1"
              >
                x
              </button>
            </div>

            {action.type === 'setFlag' && (
              <div className="flex gap-1">
                <input
                  className={INPUT_CLS}
                  value={(action as any).flag ?? ''}
                  onChange={e => updateAction(i, { flag: e.target.value })}
                  placeholder="Flag name..."
                />
                <select
                  className={SELECT_CLS + ' w-16 shrink-0'}
                  value={String((action as any).value ?? true)}
                  onChange={e => updateAction(i, { value: e.target.value === 'true' })}
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </div>
            )}

            {(action.type === 'giveItem' || action.type === 'removeItem') && (
              <div className="flex gap-1">
                <input
                  className={INPUT_CLS}
                  value={(action as any).itemId ?? ''}
                  onChange={e => updateAction(i, { itemId: e.target.value })}
                  placeholder="Item ID..."
                />
                <input
                  type="number"
                  className={INPUT_CLS + ' w-14 shrink-0'}
                  value={(action as any).count ?? 1}
                  onChange={e => updateAction(i, { count: parseInt(e.target.value) || 1 })}
                  min={1}
                />
              </div>
            )}

            {action.type === 'startBattle' && (
              <input
                className={INPUT_CLS}
                value={(action as any).trainerId ?? ''}
                onChange={e => updateAction(i, { trainerId: e.target.value })}
                placeholder="Trainer ID..."
              />
            )}

            {action.type === 'openShop' && (
              <input
                className={INPUT_CLS}
                value={(action as any).shopId ?? ''}
                onChange={e => updateAction(i, { shopId: e.target.value })}
                placeholder="Shop ID..."
              />
            )}

            {action.type === 'teleport' && (
              <div className="flex gap-1">
                <input
                  className={INPUT_CLS}
                  value={(action as any).zoneId ?? ''}
                  onChange={e => updateAction(i, { zoneId: e.target.value })}
                  placeholder="Zone..."
                />
                <input
                  type="number"
                  className={INPUT_CLS + ' w-12 shrink-0'}
                  value={(action as any).tileX ?? 0}
                  onChange={e => updateAction(i, { tileX: parseInt(e.target.value) || 0 })}
                  placeholder="X"
                />
                <input
                  type="number"
                  className={INPUT_CLS + ' w-12 shrink-0'}
                  value={(action as any).tileY ?? 0}
                  onChange={e => updateAction(i, { tileY: parseInt(e.target.value) || 0 })}
                  placeholder="Y"
                />
              </div>
            )}

            {action.type === 'playSound' && (
              <input
                className={INPUT_CLS}
                value={(action as any).soundId ?? ''}
                onChange={e => updateAction(i, { soundId: e.target.value })}
                placeholder="Sound ID..."
              />
            )}

            {action.type === 'setEmotion' && (
              <div className="flex gap-1">
                <input
                  className={INPUT_CLS}
                  value={(action as any).npcId ?? ''}
                  onChange={e => updateAction(i, { npcId: e.target.value })}
                  placeholder="NPC ID..."
                />
                <input
                  className={INPUT_CLS}
                  value={(action as any).emotion ?? ''}
                  onChange={e => updateAction(i, { emotion: e.target.value })}
                  placeholder="Emotion..."
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <Field label="Next Node">
        <NodeSelect
          value={data.nextNodeId ?? ''}
          onChange={id => onChange({ nextNodeId: id || undefined })}
          graph={graph}
          excludeId={currentNodeId}
          label="-- end dialogue --"
        />
      </Field>
    </>
  )
}
