export const text = {
  fontSize: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    '2xl': 20
  }
}

export type TextFontSize = keyof (typeof text)['fontSize']

export const button = {
  borderRadius: 3,
  height: 58,
  fontSize: text.fontSize.sm
}

export const radioButton = {
  borderRadius: 3,
  borderWidth: 2,
  height: 62
}

export const textInput = {
  borderRadius: 3,
  height: 58,
  fontSize: text.fontSize['2xl']
}

export const wordInput = {
  borderRadius: 3,
  height: 44,
  fontSize: text.fontSize.lg,
  lineHeight: 12
}
