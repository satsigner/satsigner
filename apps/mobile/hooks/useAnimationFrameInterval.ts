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

    // The clock starts on the first frame, so the first tick waits intervalMs.
    const state: { frameId: number; lastTick?: number } = { frameId: 0 }

    function animate(timestamp: number) {
      state.lastTick ??= timestamp
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
