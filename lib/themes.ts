export type Theme = 'jul' | 'bursdag' | 'bryllup' | null

export const THEMES: { id: Theme; label: string; emoji: string; emptyEmoji: string }[] = [
  { id: null,      label: 'Standard', emoji: '✨', emptyEmoji: '🌟' },
  { id: 'jul',     label: 'Jul',      emoji: '🎄', emptyEmoji: '🎄' },
  { id: 'bursdag', label: 'Bursdag',  emoji: '🎂', emptyEmoji: '🎈' },
  { id: 'bryllup', label: 'Bryllup',  emoji: '💍', emptyEmoji: '💐' },
]
