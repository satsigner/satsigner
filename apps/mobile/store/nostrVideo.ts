import { create } from 'zustand'

import {
  NOSTR_VIDEO_FAILURE_COOLDOWN_MS,
  NOSTR_VIDEO_MAX_PLAYERS
} from '@/constants/nostr'

type NostrVideoState = {
  activeUrl: string | null
  failedUntil: Record<string, number>
  /** Videos the user chose to load, most recent first; each one has a player. */
  loadedUrls: string[]
}

type NostrVideoActions = {
  loadVideo: (url: string) => void
  markVideoFailed: (url: string, now?: number) => void
  releaseAllVideos: () => void
  setActiveVideo: (url: string | null) => void
}

const useNostrVideoStore = create<NostrVideoState & NostrVideoActions>()(
  (set) => ({
    activeUrl: null,
    failedUntil: {},
    loadVideo: (url) =>
      set((state) => ({
        activeUrl: url,
        failedUntil: Object.fromEntries(
          Object.entries(state.failedUntil).filter(([failed]) => failed !== url)
        ),
        loadedUrls: [
          url,
          ...state.loadedUrls.filter((loaded) => loaded !== url)
        ].slice(0, NOSTR_VIDEO_MAX_PLAYERS)
      })),
    loadedUrls: [],
    markVideoFailed: (url, now = Date.now()) =>
      set((state) => ({
        activeUrl: state.activeUrl === url ? null : state.activeUrl,
        failedUntil: {
          ...state.failedUntil,
          [url]: now + NOSTR_VIDEO_FAILURE_COOLDOWN_MS
        },
        loadedUrls: state.loadedUrls.filter((loaded) => loaded !== url)
      })),
    releaseAllVideos: () => set({ activeUrl: null, loadedUrls: [] }),
    setActiveVideo: (url) => set({ activeUrl: url })
  })
)

function isVideoCoolingDown(
  failedUntil: Record<string, number>,
  url: string,
  now = Date.now()
): boolean {
  return (failedUntil[url] ?? 0) > now
}

/** First visible url that already has a player, so autoplay never loads media. */
function pickActiveVideoUrl(
  visibleUrls: string[],
  loadedUrls: string[]
): string | null {
  return visibleUrls.find((url) => loadedUrls.includes(url)) ?? null
}

export { isVideoCoolingDown, pickActiveVideoUrl, useNostrVideoStore }
