import { useState } from 'react'
import { type LayoutChangeEvent } from 'react-native'

import { type ZoomLayoutState } from '@/types/ui/gestures'

export const useLayout = () => {
  const [state, setState] = useState<ZoomLayoutState>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    center: { x: 0, y: 0 }
  })

  const onCanvasLayout = (event: LayoutChangeEvent) => {
    const { layout } = event.nativeEvent
    const { x, y, width, height } = layout
    const center = {
      x: x + width / 2,
      y: y + height / 2
    }

    setState({ ...layout, center })
  }

  return { ...state, onCanvasLayout }
}
