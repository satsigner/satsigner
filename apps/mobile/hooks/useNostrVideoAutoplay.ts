import { useRef } from 'react'

import { NOSTR_VIDEO_ACTIVE_SETTLE_MS } from '@/constants/nostr'
import { pickActiveVideoUrl, useNostrVideoStore } from '@/store/nostrVideo'

/**
 * Feed lists report which video urls are on screen, most visible first. After
 * a short settle (so a fast fling doesn't start players) the first one the
 * user already loaded becomes the only one playing.
 */
export function useNostrVideoAutoplay() {
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function reportVisibleVideos(visibleUrls: string[]) {
    if (settleTimer.current) {
      clearTimeout(settleTimer.current)
    }
    settleTimer.current = setTimeout(() => {
      const { loadedUrls, setActiveVideo } = useNostrVideoStore.getState()
      setActiveVideo(pickActiveVideoUrl(visibleUrls, loadedUrls))
    }, NOSTR_VIDEO_ACTIVE_SETTLE_MS)
  }

  return { reportVisibleVideos }
}
