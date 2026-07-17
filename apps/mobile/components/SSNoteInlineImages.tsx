import { useState } from 'react'
import {
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle
} from 'react-native'

import SSFullscreenImageViewer from '@/components/SSFullscreenImageViewer'
import { useImageActionsStore } from '@/store/imageActions'
import { Colors } from '@/styles'
import { parseImageExif } from '@/utils/imageExif'

type ImageDimensions = { width: number; height: number }

type SSNoteInlineImageProps = {
  uri: string
  onPress: () => void
  onLongPress: (uri: string, dimensions: ImageDimensions) => void
}

function SSNoteInlineImage({
  uri,
  onPress,
  onLongPress
}: SSNoteInlineImageProps) {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null)
  const [dimensions, setDimensions] = useState<ImageDimensions>({
    height: 0,
    width: 0
  })

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      onLongPress={() => onLongPress(uri, dimensions)}
      delayLongPress={400}
    >
      <Image
        source={{ uri }}
        onLoad={(e) => {
          const { width: w, height: h } = e.nativeEvent.source
          if (typeof w === 'number' && typeof h === 'number' && h > 0) {
            setAspectRatio(w / h)
            setDimensions({ height: h, width: w })
          }
        }}
        style={[
          styles.image,
          aspectRatio !== null ? { aspectRatio } : styles.imagePlaceholder
        ]}
        resizeMode="contain"
      />
    </TouchableOpacity>
  )
}

async function fetchImageMeta(uri: string) {
  const filename = uri.split('/').pop()?.split('?')[0] ?? undefined
  try {
    const res = await fetch(uri, { method: 'HEAD' })
    const contentType = res.headers.get('content-type') ?? undefined
    const contentLength = res.headers.get('content-length')
    const fileSize =
      contentLength !== null ? parseInt(contentLength, 10) : undefined
    return { contentType, fileSize, filename }
  } catch {
    return { filename }
  }
}

type SSNoteInlineImagesProps = {
  uris: string[]
  style?: StyleProp<ViewStyle>
}

function SSNoteInlineImages({ uris, style }: SSNoteInlineImagesProps) {
  const [viewingUri, setViewingUri] = useState<string | null>(null)
  const setSelectedImage = useImageActionsStore((s) => s.setSelectedImage)

  if (uris.length === 0) {
    return null
  }

  async function handleLongPress(uri: string, dimensions: ImageDimensions) {
    // Show drawer immediately with what we know
    setSelectedImage({
      height: dimensions.height,
      uri,
      width: dimensions.width
    })
    // Fetch HTTP headers and EXIF in parallel
    const [meta, exif] = await Promise.all([
      fetchImageMeta(uri),
      parseImageExif(uri)
    ])
    setSelectedImage({
      contentType: meta.contentType,
      exif,
      fileSize: meta.fileSize,
      filename: meta.filename,
      height: dimensions.height,
      uri,
      width: dimensions.width
    })
  }

  return (
    <>
      <View style={[styles.wrap, style]}>
        {uris.map((uri) => (
          <SSNoteInlineImage
            key={uri}
            uri={uri}
            onPress={() => setViewingUri(uri)}
            onLongPress={(u, d) => void handleLongPress(u, d)}
          />
        ))}
      </View>
      <SSFullscreenImageViewer
        uri={viewingUri}
        visible={viewingUri !== null}
        onClose={() => setViewingUri(null)}
      />
    </>
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
