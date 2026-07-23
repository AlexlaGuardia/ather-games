export interface FieldDef {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'checkbox' | 'color' | 'range' | 'textarea'
  options?: { value: string; label: string }[]
  min?: number
  max?: number
  step?: number
  placeholder?: string
  required?: boolean
  group?: string
  condition?: (data: any) => boolean
}

// Predefined field schemas for common patterns

export const TEXT_NODE_FIELDS: FieldDef[] = [
  { key: 'speaker', label: 'Speaker', type: 'text', placeholder: 'NPC name...', required: true },
  { key: 'text', label: 'Dialogue Text', type: 'textarea', placeholder: 'What the NPC says...', required: true },
  {
    key: 'emotion', label: 'Emotion', type: 'select',
    options: [
      { value: '', label: 'neutral' },
      { value: 'happy', label: 'happy' },
      { value: 'angry', label: 'angry' },
      { value: 'sad', label: 'sad' },
      { value: 'surprised', label: 'surprised' },
      { value: 'thinking', label: 'thinking' },
    ],
  },
  { key: 'autoAdvance', label: 'Auto-advance (ms)', type: 'number', min: 0, step: 500 },
]

export const ENCOUNTER_ENTRY_FIELDS: FieldDef[] = [
  { key: 'weight', label: 'Weight', type: 'number', min: 1, max: 10 },
  // Absolute level override for a single species (blank = inherit the zone band).
  { key: 'levels.0', label: 'Level Min', type: 'number', min: 1, max: 100 },
  { key: 'levels.1', label: 'Level Max', type: 'number', min: 1, max: 100 },
]
