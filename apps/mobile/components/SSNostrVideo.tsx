import { useEvent, useEventListener } from 'expo'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import SSPressable from '@/components/SSPressable'
import SSText from '@/components/SSText'
import { NOSTR_VIDEO_DEFAULT_ASPECT_RATIO } from '@/constants/nostr'
import { t } from '@/locales'
import { isVideoCoolingDown, useNostrVideoStore } from '@/store/nostrVideo'
import { Colors } from '@/styles'
import type { NostrVideoEmbed } from '@/types/models/Nostr'
import {
  registerVideoPlayer,
  unmuteVideoPlayer
} from '@/utils/nostrVideoPlayers'

type SSNostrVideoProps = {
  embed: NostrVideoEmbed
}

type SSNostrVideoPosterProps = {
  embed: NostrVideoEmbed
  failed: boolean
}

function SSNostrVideoPoster({ embed, failed }: SSNostrVideoPosterProps) {
  function handleLoad() {
    const { failedUntil, loadVideo } = useNostrVideoStore.getState()
    if (isVideoCoolingDown(failedUntil, embed.watchUrl)) {
      return
    }
    loadVideo(embed.watchUrl)
  }

  return (
    <SSPressable
      accessibilityLabel={t('nostrIdentity.feed.playVideo')}
      accessibilityRole="button"
      onPress={handleLoad}
    >
      <View style={styles.frame}>
        <View style={styles.overlay}>
          <SSText size="sm" weight="medium" style={styles.overlayText}>
            {failed
              ? t('nostrIdentity.feed.videoFailed')
              : t('nostrIdentity.feed.playVideo')}
          </SSText>
        </View>
      </View>
    </SSPressable>
  )
}

function SSNostrVideoPlayer({ embed }: SSNostrVideoProps) {
  const markVideoFailed = useNostrVideoStore((state) => state.markVideoFailed)
  const [controlsEnabled, setControlsEnabled] = useState(false)
  const player = useVideoPlayer(embed.watchUrl, (created) =>
    registerVideoPlayer(embed.watchUrl, created)
  )
  const { status } = useEvent(player, 'statusChange', {
    status: player.status
  })

  useEventListener(player, 'statusChange', ({ status: next }) => {
    if (next === 'error') {
      markVideoFailed(embed.watchUrl)
    }
  })

  function handleEnableControls() {
    unmuteVideoPlayer(player)
    setControlsEnabled(true)
  }

  return (
    <View style={styles.frame}>
      <VideoView
        contentFit="contain"
        nativeControls={controlsEnabled}
        player={player}
        style={StyleSheet.absoluteFill}
      />
      {status === 'readyToPlay' ? null : (
        <View style={styles.overlay} pointerEvents="none">
          {embed.thumbnailUrl ? (
            <Image
              contentFit="cover"
              source={{ uri: embed.thumbnailUrl }}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <SSText size="sm" style={styles.overlayText}>
            {t('nostrIdentity.feed.videoLoading')}
          </SSText>
        </View>
      )}
      {controlsEnabled ? null : (
        <SSPressable
          accessibilityLabel={t('nostrIdentity.feed.videoControls')}
          accessibilityRole="button"
          onPress={handleEnableControls}
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  )
}

/**
 * Direct video file in a note. Shows a poster until tapped, so scrolling the
 * feed never contacts media hosts; loaded videos autoplay muted while they
 * are the most visible one.
 */
function SSNostrVideo({ embed }: SSNostrVideoProps) {
  const loaded = useNostrVideoStore((state) =>
    state.loadedUrls.includes(embed.watchUrl)
  )
  const failed = useNostrVideoStore((state) =>
    isVideoCoolingDown(state.failedUntil, embed.watchUrl)
  )
  const aspectRatio = embed.aspectRatio ?? NOSTR_VIDEO_DEFAULT_ASPECT_RATIO

  return (
    <View style={[styles.container, { aspectRatio }]}>
      {loaded && !failed ? (
        <SSNostrVideoPlayer embed={embed} />
      ) : (
        <SSNostrVideoPoster embed={embed} failed={failed} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.gray[900],
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%'
  },
  frame: {
    height: '100%',
    width: '100%'
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center'
  },
  overlayText: {
    color: Colors.white
  }
})

export default SSNostrVideo
