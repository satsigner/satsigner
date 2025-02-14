import { type DimensionValue } from 'react-native'

export const mainContainer = {
  paddingHorizontal: '6%' as DimensionValue,
  paddingTop: 32,
  paddingBottom: 32
}

export const vStack = {
  gap: {
    none: 0,
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 16,
    lg: 32,
    xl: 64,
    '2xl': 128
  }
}

export type VStackGap = keyof (typeof vStack)['gap']

export const hStack = {
  gap: {
    none: 0,
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 16,
    lg: 32,
    xl: 64,
    '2xl': 128
  }
}

export type HStackGap = keyof (typeof hStack)['gap']

export const form = {
  gap: 16
}

export const formItem = {
  gap: 8
}
