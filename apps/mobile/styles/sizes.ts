export const text = {
  fontSize: {
    '2xxs': 8,
    xxs: 9,
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    '2xl': 20,
    '3xl': 24,
    '4xl': 30,
    '5xl': 36,
    '6xl': 42,
    '7xl': 50,
    '8xl': 62
  },
  fontWeight: {
    ultralight: '200',
    light: '300',
    regular: '400',
    medium: '500',
    bold: '700'
  } as const
}

export type TextFontSize = keyof (typeof text)['fontSize']
export type TextFontWeight = keyof (typeof text)['fontWeight']

export const button = {
  borderRadius: 3,
  height: 58,
  fontSize: text.fontSize.sm
}

export const actionButton = {
  height: 62,
  fontSize: text.fontSize.md
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
  height: {
    default: 58,
    small: 34,
    large: 42
  },
  fontSize: {
    default: text.fontSize['2xl'],
    small: text.fontSize['lg'],
    large: text.fontSize['3xl']
  }
}

export const wordInput = {
  borderRadius: 3,
  height: 44,
  fontSize: text.fontSize.lg,
  lineHeight: 12
}

export const pinInput = {
  borderRadius: 3,
  height: 58,
  width: 58
}
