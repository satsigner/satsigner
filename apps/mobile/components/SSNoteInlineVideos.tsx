import * as WebBrowser from 'expo-web-browser'
import {
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle
} from 'react-native'

import SSText from '@/components/SSText'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { type NostrVideoEmbed } from '@/utils/nostrNoteVideoUrls'

type SSNoteInlineVideosProps = {
  embeds: NostrVideoEmbed[]
  style?: StyleProp<ViewStyle>
}

function labelForProvider(provider: NostrVideoEmbed['provider']): string {
  switch (provider) {
    case 'youtube':
      return t('nostrIdentity.feed.videoYoutube')
    case 'vimeo':
      return t('nostrIdentity.feed.videoVimeo')
    case 'twitch_clip':
    case 'twitch_vod':
      return t('nostrIdentity.feed.videoTwitch')
    default:
      return t('nostrIdentity.feed.videoFile')
  }
}

function SSNoteInlineVideos({ embeds, style }: SSNoteInlineVideosProps) {
  if (embeds.length === 0) {
    return null
  }

  return (
    <View style={[styles.wrap, style]}>
      {embeds.map((embed) => (
        <TouchableOpacity
          key={embed.watchUrl}
          activeOpacity={0.7}
          accessibilityLabel={t('nostrIdentity.feed.openVideo')}
          accessibilityRole="button"
          onPress={() => {
            void WebBrowser.openBrowserAsync(embed.watchUrl)
          }}
        >
          <View style={styles.card}>
            {embed.thumbnailUrl ? (
              <Image
                resizeMode="cover"
                source={{ uri: embed.thumbnailUrl }}
                style={styles.thumb}
              />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]}>
                <SSText size="sm" color="muted">
                  {labelForProvider(embed.provider)}
                </SSText>
              </View>
            )}
            <View style={styles.overlay}>
              <SSText size="xs" weight="medium" style={styles.overlayTitle}>
                {labelForProvider(embed.provider)}
              </SSText>
              <SSText size="xxs" style={styles.openCta}>
                {t('nostrIdentity.feed.openVideo')}
              </SSText>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
    width: '100%'
  },
  openCta: {
    color: Colors.white,
    opacity: 0.95
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    bottom: 0,
    gap: 2,
    left: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    position: 'absolute',
    right: 0
  },
  overlayTitle: {
    color: Colors.white
  },
  thumb: {
    backgroundColor: Colors.gray[800],
    minHeight: 160,
    width: '100%'
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  wrap: {
    gap: 8,
    width: '100%'
  }
})

export default SSNoteInlineVideos
