import { useEffect, useEffectEvent } from 'react'

type FrameClock = { requestId: number; lastAdvanceTimestamp?: number }

export function useAnimatedQrFrameCycle(
  advanceFrame: () => void,
  frameIntervalMs: number,
  isCycling: boolean
) {
  const advanceLatestFrame = useEffectEvent(advanceFrame)

  useEffect(() => {
    if (!isCycling) {
      return
    }

    const clock: FrameClock = { requestId: 0 }

    function onAnimationFrame(timestamp: number) {
      if (clock.lastAdvanceTimestamp === undefined) {
        clock.lastAdvanceTimestamp = timestamp
      }
      const hasFrameIntervalElapsed =
        timestamp - clock.lastAdvanceTimestamp >= frameIntervalMs
      if (hasFrameIntervalElapsed) {
        advanceLatestFrame()
        clock.lastAdvanceTimestamp = timestamp
      }
      clock.requestId = requestAnimationFrame(onAnimationFrame)
    }
    clock.requestId = requestAnimationFrame(onAnimationFrame)

    return () => cancelAnimationFrame(clock.requestId)
  }, [isCycling, frameIntervalMs])
}
