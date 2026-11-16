import { useEffect, useState } from 'react'

import { SYNC_LABEL_TICK_MS } from '@/constants/sync'

/** Index into a rotating list of labels, advanced every SYNC_LABEL_TICK_MS. */
function useSyncLabelTicker(labelCount: number) {
  const [tick, setTick] = useState(0)

  // A timer has no React-driven alternative; the interval only runs while
  // there is more than one label to rotate through.
  useEffect(() => {
    if (labelCount < 2) {
      return
    }
    const interval = setInterval(
      () => setTick((current) => current + 1),
      SYNC_LABEL_TICK_MS
    )
    return () => clearInterval(interval)
  }, [labelCount])

  return labelCount > 0 ? tick % labelCount : 0
}

export default useSyncLabelTicker
