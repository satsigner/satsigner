import type { VideoPlayer } from 'expo-video'

import { useNostrVideoStore } from '@/store/nostrVideo'
import { registerNostrLifecycleHandler } from '@/utils/nostrLifecycle'

type ControlledVideoPlayer = Pick<
  VideoPlayer,
  'loop' | 'muted' | 'pause' | 'play'
>

// Players are created by the mounted SSNostrVideoPlayer rows; this registry
// lets one store subscription decide which single player runs, instead of an
// effect in every row. A url can have several players at once (a feed row
// stays mounted under a pushed note screen), so only the newest one plays.
const playersByUrl = new Map<string, ControlledVideoPlayer[]>()

function setPlaying(player: ControlledVideoPlayer, playing: boolean): boolean {
  try {
    if (playing) {
      player.play()
    } else {
      player.pause()
    }
    return true
  } catch {
    // The row unmounted and expo-video already released this player.
    return false
  }
}

function applyPlayback(url: string, activeUrl: string | null) {
  const live: ControlledVideoPlayer[] = []
  for (const player of (playersByUrl.get(url) ?? []).toReversed()) {
    if (setPlaying(player, url === activeUrl && live.length === 0)) {
      live.unshift(player)
    }
  }
  if (live.length === 0) {
    playersByUrl.delete(url)
    return
  }
  playersByUrl.set(url, live)
}

function syncPlayers(activeUrl: string | null, loadedUrls: string[]) {
  for (const url of playersByUrl.keys()) {
    if (!loadedUrls.includes(url)) {
      applyPlayback(url, null)
      playersByUrl.delete(url)
      continue
    }
    applyPlayback(url, activeUrl)
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

function registerVideoPlayer(url: string, player: ControlledVideoPlayer): void {
  player.muted = true
  player.loop = true
  playersByUrl.set(url, [...(playersByUrl.get(url) ?? []), player])
  applyPlayback(url, useNostrVideoStore.getState().activeUrl)
}

function unmuteVideoPlayer(player: VideoPlayer): void {
  player.muted = false
}

function registeredVideoPlayerCount(): number {
  return [...playersByUrl.values()].reduce(
    (count, players) => count + players.length,
    0
  )
}

export {
  registeredVideoPlayerCount,
  registerVideoPlayer,
  syncPlayers,
  unmuteVideoPlayer
}
