import { useEffect, useRef } from 'react'

/**
 * Calls `onTick` every `intervalMs` while `active`, timed with
 * requestAnimationFrame. Used to cycle the frames of animated QR codes.
 */
export function useAnimationFrameInterval(
  onTick: () => void,
  intervalMs: number,
  active: boolean
) {
  const onTickRef = useRef(onTick)

  useEffect(() => {
    onTickRef.current = onTick
  }, [onTick])

  useEffect(() => {
    if (!active) {
      return
    }

    const state = { frameId: 0, lastTick: 0 }

    function animate(timestamp: number) {
      if (timestamp - state.lastTick >= intervalMs) {
        onTickRef.current()
        state.lastTick = timestamp
      }
      state.frameId = requestAnimationFrame(animate)
    }
    state.frameId = requestAnimationFrame(animate)

    return () => cancelAnimationFrame(state.frameId)
  }, [active, intervalMs])
}
