export const text = {
  fontSize: {
    '2xl': 20,
    '2xxs': 8,
    '3xl': 24,
    '4xl': 30,
    '5xl': 36,
    '6xl': 42,
    '7xl': 50,
    '8xl': 62,
    lg: 16,
    md: 14,
    sm: 12,
    xl: 18,
    xs: 10,
    xxs: 9
  },
  fontWeight: {
    bold: '700',
    light: '300',
    medium: '500',
    regular: '400',
    ultralight: '200'
  } as const
}

export type TextFontSize = keyof (typeof text)['fontSize']
export type TextFontWeight = keyof (typeof text)['fontWeight']

// Geist digits rise 0.726em above the baseline and the font descends 0.295em.
// When lineHeight is below the font's own line height, iOS keeps the whole
// descent and trims the top, so a 1em line clips the top of the digits.
const DIGIT_LINE_HEIGHT_RATIO = 1.1

export function getDigitLineHeight(size: TextFontSize) {
  return Math.ceil(text.fontSize[size] * DIGIT_LINE_HEIGHT_RATIO)
}

export const button = {
  borderRadius: 3,
  fontSize: text.fontSize.sm,
  height: 58
}

export const actionButton = {
  fontSize: text.fontSize.md,
  height: 62
}

export const checkbox = {
  borderRadius: 4,
  borderWidth: 2,
  height: 32
}

export const radioButton = {
  borderRadius: 3,
  borderWidth: 2,
  height: 62
}

export const textInput = {
  borderRadius: 3,
  fontSize: {
    default: text.fontSize['2xl'],
    large: text.fontSize['3xl'],
    small: text.fontSize['lg']
  },
  height: {
    default: 58,
    large: 56,
    small: 42
  }
}

export const wordInput = {
  borderRadius: 3,
  fontSize: text.fontSize.lg,
  height: 44,
  lineHeight: 12
}

export const pinInput = {
  borderRadius: 3,
  height: 58,
  width: 58
}
