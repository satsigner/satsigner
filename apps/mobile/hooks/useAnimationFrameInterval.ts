import { useEffect, useEffectEvent } from 'react'

/**
 * Calls `onTick` every `intervalMs` while `active`, timed with
 * requestAnimationFrame. Used to cycle the frames of animated QR codes.
 */
export function useAnimationFrameInterval(
  onTick: () => void,
  intervalMs: number,
  active: boolean
) {
  const tick = useEffectEvent(onTick)

  useEffect(() => {
    if (!active) {
      return
    }

    const state = { frameId: 0, lastTick: 0 }

    function animate(timestamp: number) {
      if (timestamp - state.lastTick >= intervalMs) {
        tick()
        state.lastTick = timestamp
      }
      state.frameId = requestAnimationFrame(animate)
    }
    state.frameId = requestAnimationFrame(animate)

    return () => cancelAnimationFrame(state.frameId)
  }, [active, intervalMs])
}
