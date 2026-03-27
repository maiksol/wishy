export type Theme = 'jul' | 'bursdag' | 'bryllup' | null

export const THEMES: { id: Theme; label: string; emoji: string; emptyEmoji: string; color: string }[] = [
  { id: null,      label: 'Standard', emoji: '✨', emptyEmoji: '🌟', color: 'var(--primary)' },
  { id: 'jul',     label: 'Jul',      emoji: '🎄', emptyEmoji: '🎄', color: '#2d7a4f' },
  { id: 'bursdag', label: 'Bursdag',  emoji: '🎂', emptyEmoji: '🎈', color: '#f59e0b' },
  { id: 'bryllup', label: 'Bryllup',  emoji: '💍', emptyEmoji: '💐', color: '#b5924a' },
]

export function parseThemeValue(value: string): Theme {
  return (value === 'null' ? null : value) as Theme
}
