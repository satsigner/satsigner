import { useState } from 'react'
import {
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle
} from 'react-native'

import { Colors } from '@/styles'

type SSNoteInlineImageProps = {
  uri: string
}

function SSNoteInlineImage({ uri }: SSNoteInlineImageProps) {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null)

  return (
    <Image
      source={{ uri }}
      onLoad={(e) => {
        const { width: w, height: h } = e.nativeEvent.source
        if (typeof w === 'number' && typeof h === 'number' && h > 0) {
          setAspectRatio(w / h)
        }
      }}
      style={[
        styles.image,
        aspectRatio !== null && aspectRatio !== undefined
          ? { aspectRatio }
          : styles.imagePlaceholder
      ]}
      resizeMode="contain"
    />
  )
}

type SSNoteInlineImagesProps = {
  uris: string[]
  style?: StyleProp<ViewStyle>
}

function SSNoteInlineImages({ uris, style }: SSNoteInlineImagesProps) {
  if (uris.length === 0) {
    return null
  }

  return (
    <View style={[styles.wrap, style]}>
      {uris.map((uri) => (
        <SSNoteInlineImage key={uri} uri={uri} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: Colors.gray[800],
    borderRadius: 3,
    width: '100%'
  },
  imagePlaceholder: {
    minHeight: 160,
    width: '100%'
  },
  wrap: {
    gap: 8,
    marginTop: 8,
    width: '100%'
  }
})

export default SSNoteInlineImages
