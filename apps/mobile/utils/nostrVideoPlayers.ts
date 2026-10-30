import type { VideoPlayer } from 'expo-video'

import { useNostrVideoStore } from '@/store/nostrVideo'
import { registerNostrLifecycleHandler } from '@/utils/nostrLifecycle'

// Players are created by the mounted SSNostrVideoPlayer rows; this registry
// lets one store subscription decide which single player runs, instead of an
// effect in every row.
const playersByUrl = new Map<string, VideoPlayer>()

function applyPlayback(
  url: string,
  player: VideoPlayer,
  activeUrl: string | null
) {
  try {
    if (url === activeUrl) {
      player.play()
      return
    }
    player.pause()
  } catch {
    // The row unmounted and expo-video already released this player.
    playersByUrl.delete(url)
  }
}

function syncPlayers(activeUrl: string | null, loadedUrls: string[]) {
  for (const [url, player] of playersByUrl) {
    if (!loadedUrls.includes(url)) {
      playersByUrl.delete(url)
      continue
    }
    applyPlayback(url, player, activeUrl)
  }
}

useNostrVideoStore.subscribe((state, previous) => {
  if (
    state.activeUrl === previous.activeUrl &&
    state.loadedUrls === previous.loadedUrls
  ) {
    return
  }
  syncPlayers(state.activeUrl, state.loadedUrls)
})

registerNostrLifecycleHandler({
  onBackground: () => useNostrVideoStore.getState().releaseAllVideos()
})

function registerVideoPlayer(url: string, player: VideoPlayer): void {
  player.muted = true
  player.loop = true
  playersByUrl.set(url, player)
  applyPlayback(url, player, useNostrVideoStore.getState().activeUrl)
}

function registeredVideoPlayerCount(): number {
  return playersByUrl.size
}

export { registeredVideoPlayerCount, registerVideoPlayer, syncPlayers }
