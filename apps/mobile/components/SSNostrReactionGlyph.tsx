import { Image, StyleSheet } from 'react-native'

import SSIconHeart from '@/components/icons/SSIconHeart'
import SSText from '@/components/SSText'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { type NostrReaction } from '@/types/models/Nostr'

const GLYPH_SIZE = 16

type SSNostrReactionGlyphProps = {
  reaction: NostrReaction
}

function SSNostrReactionGlyph({ reaction }: SSNostrReactionGlyphProps) {
  switch (reaction.type) {
    case 'like': {
      return (
        <SSIconHeart
          color={Colors.mainRed}
          filled
          height={GLYPH_SIZE}
          width={GLYPH_SIZE}
        />
      )
    }
    case 'dislike': {
      return (
        <SSText size="xs" color="muted">
          {t('nostrIdentity.note.reactions.dislike')}
        </SSText>
      )
    }
    case 'customEmoji': {
      return (
        <Image
          accessibilityLabel={reaction.shortcode}
          source={{ uri: reaction.url }}
          style={styles.customEmoji}
        />
      )
    }
    default: {
      return (
        <SSText size="sm" numberOfLines={1}>
          {reaction.content}
        </SSText>
      )
    }
  }
}

const styles = StyleSheet.create({
  customEmoji: {
    height: GLYPH_SIZE,
    width: GLYPH_SIZE
  }
})

export default SSNostrReactionGlyph
