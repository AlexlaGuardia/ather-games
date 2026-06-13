export interface ShortcutDef {
  key: string
  description: string
  category?: string
}

export const PIXEL_EDITOR_SHORTCUTS: ShortcutDef[] = [
  { key: 'B', description: 'Draw tool', category: 'Tools' },
  { key: 'V', description: 'Select tool', category: 'Tools' },
  { key: 'M', description: 'Toggle mirror paint', category: 'Tools' },
  { key: 'Alt+Click', description: 'Eyedropper (sample color)', category: 'Tools' },
  { key: 'Shift+Click', description: 'Draw line from last point', category: 'Tools' },
  { key: 'O', description: 'Toggle onion skin', category: 'Display' },
  { key: 'Ctrl+Z', description: 'Undo', category: 'Editing' },
  { key: 'Ctrl+Shift+Z', description: 'Redo', category: 'Editing' },
  { key: 'Ctrl+Y', description: 'Redo (alt)', category: 'Editing' },
  { key: 'Ctrl+Shift+C', description: 'Copy frame', category: 'Frames' },
  { key: 'Ctrl+Shift+V', description: 'Paste frame', category: 'Frames' },
  { key: 'Alt+D', description: 'Duplicate frame', category: 'Frames' },
  { key: '[', description: 'Previous frame', category: 'Frames' },
  { key: ']', description: 'Next frame', category: 'Frames' },
  { key: 'Home', description: 'First frame', category: 'Frames' },
  { key: 'End', description: 'Last frame', category: 'Frames' },
  { key: 'Arrows', description: 'Nudge selection', category: 'Selection' },
  { key: 'Enter', description: 'Commit selection', category: 'Selection' },
  { key: 'Escape', description: 'Cancel selection', category: 'Selection' },
]

export const DIALOGUE_EDITOR_SHORTCUTS: ShortcutDef[] = [
  { key: 'Right-click', description: 'Add node menu', category: 'Nodes' },
  { key: 'Double-click', description: 'Set entry node', category: 'Nodes' },
  { key: 'Del / Backspace', description: 'Delete selected node', category: 'Nodes' },
  { key: 'Click port', description: 'Toggle connection', category: 'Nodes' },
  { key: 'Ctrl+Z', description: 'Undo', category: 'Editing' },
  { key: 'Ctrl+Shift+Z', description: 'Redo', category: 'Editing' },
  { key: 'Ctrl+Y', description: 'Redo (alt)', category: 'Editing' },
  { key: 'Ctrl+F', description: 'Search nodes', category: 'Navigation' },
  { key: 'Escape', description: 'Cancel / close', category: 'Navigation' },
  { key: 'Ctrl+Scroll', description: 'Zoom in/out', category: 'Navigation' },
]

export const MAP_EDITOR_SHORTCUTS: ShortcutDef[] = [
  { key: 'B', description: 'Brush mode', category: 'Tools' },
  { key: 'V', description: 'Select mode', category: 'Tools' },
  { key: 'R', description: 'Rotate brush', category: 'Tools' },
  { key: 'Ctrl+Z', description: 'Undo', category: 'Editing' },
  { key: 'Ctrl+Shift+Z', description: 'Redo', category: 'Editing' },
  { key: 'Ctrl+Y', description: 'Redo (alt)', category: 'Editing' },
  { key: 'Delete', description: 'Delete selection', category: 'Editing' },
  { key: 'Escape', description: 'Deselect', category: 'Navigation' },
]
