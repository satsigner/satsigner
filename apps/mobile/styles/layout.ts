import { type DimensionValue } from 'react-native'

import { HEADER_HEIGHT_TRIM_PX } from '@/constants/headerChrome'

const MAIN_CONTAINER_PADDING_TOP_BASE = 12

const MAIN_CONTAINER_PADDING_HORIZONTAL = '6%' as DimensionValue

export const mainContainer = {
  paddingBottom: 32,
  paddingHorizontal: MAIN_CONTAINER_PADDING_HORIZONTAL,
  /** Paired with `HEADER_HEIGHT_TRIM_PX` on the stack header. */
  paddingTop: MAIN_CONTAINER_PADDING_TOP_BASE + HEADER_HEIGHT_TRIM_PX
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
