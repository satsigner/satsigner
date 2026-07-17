import { Image } from 'expo-image'
import { StyleSheet, View } from 'react-native'

import { type BlobDescriptor } from '@/api/blossom'
import SSDetailsList from '@/components/SSDetailsList'
import SSText from '@/components/SSText'
import { NOSTR_BLOSSOM_FILE_PREVIEW_HEIGHT } from '@/constants/nostr'
import SSVStack from '@/layouts/SSVStack'
import { Colors } from '@/styles'
import {
  buildBlossomFileDetailItems,
  getBlossomFileDisplayName,
  isBlossomImageMime
} from '@/utils/blossomFiles'

type SSNostrBlossomFileDetailContentProps = {
  file: BlobDescriptor
}

function SSNostrBlossomFileDetailContent({
  file
}: SSNostrBlossomFileDetailContentProps) {
  const displayName = getBlossomFileDisplayName(file)
  const showImagePreview = isBlossomImageMime(file.type)

  return (
    <SSVStack gap="lg" style={styles.content}>
      {showImagePreview ? (
        <View style={styles.preview}>
          <Image
            contentFit="contain"
            source={{ uri: file.url }}
            style={styles.previewImage}
          />
        </View>
      ) : null}
      <SSVStack gap="sm">
        <SSText size="lg" type="mono">
          {displayName}
        </SSText>
        <SSDetailsList
          columns={1}
          copyToClipboard
          gap={16}
          items={buildBlossomFileDetailItems(file)}
          uppercase
          variant="mono"
        />
      </SSVStack>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 32
  },
  preview: {
    alignItems: 'center',
    backgroundColor: Colors.black,
    width: '100%'
  },
  previewImage: {
    height: NOSTR_BLOSSOM_FILE_PREVIEW_HEIGHT,
    width: '100%'
  }
})

export default SSNostrBlossomFileDetailContent
