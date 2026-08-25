import { type TextFontSize } from '@/styles/sizes'

const LABEL_TEXT_SIZE_SM_THRESHOLD = 48
const LABEL_TEXT_SIZE_MD_THRESHOLD = 32
const LABEL_TEXT_SIZE_LG_THRESHOLD = 20

/**
 * Scale label text down as it grows so long notes stay readable on cards
 * and detail screens (and match while editing).
 */
function getLabelTextSize(label: string): TextFontSize {
  if (label.length > LABEL_TEXT_SIZE_SM_THRESHOLD) {
    return 'sm'
  }
  if (label.length > LABEL_TEXT_SIZE_MD_THRESHOLD) {
    return 'md'
  }
  if (label.length > LABEL_TEXT_SIZE_LG_THRESHOLD) {
    return 'lg'
  }
  return 'xl'
}

export { getLabelTextSize }
