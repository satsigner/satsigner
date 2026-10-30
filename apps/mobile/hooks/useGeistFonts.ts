import { useFonts } from '@shopify/react-native-skia'

import { Typography } from '@/styles'

export function useGeistFonts() {
  return useFonts({
    [Typography.geistSkiaFamily]: [
      require('@/assets/fonts/Geist-Light.ttf'),
      require('@/assets/fonts/Geist-Regular.ttf'),
      require('@/assets/fonts/Geist-Medium.ttf')
    ]
  })
}
