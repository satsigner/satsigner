import { type DimensionValue } from 'react-native'

export const mainContainer = {
  paddingBottom: 32,
  paddingHorizontal: '6%' as DimensionValue,
  paddingTop: 12
}

export const vStack = {
  gap: {
    '2xl': 128,
    lg: 32,
    md: 16,
    none: 0,
    sm: 8,
    xl: 64,
    xs: 4,
    xxs: 2
  }
}

export type VStackGap = keyof (typeof vStack)['gap']

export const hStack = {
  gap: {
    '2xl': 128,
    lg: 32,
    md: 16,
    none: 0,
    sm: 8,
    xl: 64,
    xs: 4,
    xxs: 2
  }
}

export type HStackGap = keyof (typeof hStack)['gap']

export const form = {
  gap: 16
}

export const formItem = {
  gap: 8
}
