import { type TextFontSize } from '@/styles/sizes'

/**
 * Scale label text down as it grows so long notes stay readable on cards
 * and detail screens (and match while editing).
 */
function getLabelTextSize(label: string): TextFontSize {
  if (label.length > 48) {
    return 'sm'
  }
  if (label.length > 32) {
    return 'md'
  }
  if (label.length > 20) {
    return 'lg'
  }
  return 'xl'
}

export { getLabelTextSize }
