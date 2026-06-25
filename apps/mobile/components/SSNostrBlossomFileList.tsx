import { FlashList } from '@shopify/flash-list'
import { Pressable, StyleSheet, View } from 'react-native'

import { type BlobDescriptor } from '@/api/blossom'
import SSText from '@/components/SSText'
import {
  NOSTR_BLOSSOM_FILE_ROW_HEIGHT,
  NOSTR_LIST_PADDING_VERTICAL
} from '@/constants/nostr'
import SSVStack from '@/layouts/SSVStack'
import { Colors } from '@/styles'
import {
  formatBlossomFileSize,
  formatBlossomUploadDate,
  getBlossomFileDisplayName,
  getBlossomFileExtension
} from '@/utils/blossomFiles'

type SSNostrBlossomFileListProps = {
  files: BlobDescriptor[]
  onPress: (file: BlobDescriptor) => void
}

type SSNostrBlossomFileRowProps = {
  file: BlobDescriptor
  onPress: (file: BlobDescriptor) => void
}

function SSNostrBlossomFileRow({ file, onPress }: SSNostrBlossomFileRowProps) {
  const filename = getBlossomFileDisplayName(file)
  const extension = getBlossomFileExtension(file)

  function handlePress() {
    onPress(file)
  }

  return (
    <Pressable onPress={handlePress} style={styles.row}>
      <View style={styles.badge}>
        <SSText color="muted" numberOfLines={1} size="xs">
          {extension || '—'}
        </SSText>
      </View>
      <SSVStack gap="none" style={styles.rowText}>
        <SSText numberOfLines={1} size="sm">
          {filename}
        </SSText>
        <SSText color="muted" size="xs">
          {formatBlossomFileSize(file.size)}
          {file.uploaded
            ? `  ·  ${formatBlossomUploadDate(file.uploaded)}`
            : ''}
        </SSText>
      </SSVStack>
    </Pressable>
  )
}

function SSNostrBlossomFileList({
  files,
  onPress
}: SSNostrBlossomFileListProps) {
  function renderItem({ item }: { item: BlobDescriptor }) {
    return <SSNostrBlossomFileRow file={item} onPress={onPress} />
  }

  function keyExtractor(item: BlobDescriptor) {
    return item.sha256
  }

  return (
    <View style={styles.list}>
      <FlashList
        contentContainerStyle={styles.listContent}
        data={files}
        estimatedItemSize={NOSTR_BLOSSOM_FILE_ROW_HEIGHT}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    backgroundColor: Colors.gray[800],
    borderRadius: 4,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  list: {
    flex: 1,
    width: '100%'
  },
  listContent: {
    paddingVertical: NOSTR_LIST_PADDING_VERTICAL
  },
  row: {
    alignItems: 'center',
    borderBottomColor: Colors.gray[800],
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12
  },
  rowText: {
    flex: 1
  }
})

export default SSNostrBlossomFileList
