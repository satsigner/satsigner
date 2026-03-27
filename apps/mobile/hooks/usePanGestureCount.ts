import { useRef } from 'react'

export const usePanGestureCount = () => {
  const panGestureCount = useRef(0)

  const isPanning = () => panGestureCount.current > 0
  const startPan = () => {
    panGestureCount.current += 1
  }
  const endPan = () => {
    if (panGestureCount.current > 0) {
      panGestureCount.current -= 1
    }
  }

  return { endPan, isPanning, startPan }
}
