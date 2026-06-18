import { FlashList } from '@shopify/flash-list'
import { useQuery } from '@tanstack/react-query'
import { Stack, useLocalSearchParams } from 'expo-router'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { listBlossomFiles, type BlobDescriptor } from '@/api/blossom'
import SSText from '@/components/SSText'
import { BLOSSOM_DEFAULT_SERVER } from '@/constants/nostr'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors, Layout } from '@/styles'
import { getPubKeyHexFromNpub } from '@/utils/nostr'

type FilesParams = {
  npub: string
}

const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB'] as const

function formatFileSize(bytes: number): string {
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < FILE_SIZE_UNITS.length - 1) {
    value /= 1024
    unitIndex++
  }
  const rounded = unitIndex === 0 ? value : Math.round(value * 10) / 10
  return `${rounded} ${FILE_SIZE_UNITS[unitIndex]}`
}

function formatUploadDate(unixTs: number): string {
  const date = new Date(unixTs * 1000)
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

export default function NostrFiles() {
  const { npub } = useLocalSearchParams<FilesParams>()

  const pubkeyHex = getPubKeyHexFromNpub(npub) ?? ''
  const serverUrl = BLOSSOM_DEFAULT_SERVER

  const {
    data: files = [],
    isLoading,
    isError
  } = useQuery({
    enabled: !!pubkeyHex,
    queryFn: () => listBlossomFiles(serverUrl, pubkeyHex),
    queryKey: ['blossom', 'files', pubkeyHex, serverUrl],
    retry: 1,
    staleTime: 5 * 60_000
  })

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('nostrIdentity.files.title')}</SSText>
          )
        }}
      />
      {isLoading ? (
        <SSVStack itemsCenter style={styles.center}>
          <ActivityIndicator color={Colors.gray[400]} />
        </SSVStack>
      ) : isError ? (
        <SSVStack itemsCenter style={styles.center}>
          <SSText color="muted" size="sm">
            {t('nostrIdentity.files.error')}
          </SSText>
          <SSText color="muted" size="xs">
            {serverUrl}
          </SSText>
        </SSVStack>
      ) : files.length === 0 ? (
        <SSVStack itemsCenter style={styles.center}>
          <SSText color="muted" size="sm">
            {t('nostrIdentity.files.empty')}
          </SSText>
          <SSText color="muted" size="xs">
            {serverUrl}
          </SSText>
        </SSVStack>
      ) : (
        <FlashList
          data={files}
          estimatedItemSize={72}
          keyExtractor={(item) => item.sha256}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <FileRow file={item} />}
        />
      )}
    </SSMainLayout>
  )
}

type FileRowProps = {
  file: BlobDescriptor
}

function FileRow({ file }: FileRowProps) {
  const filename =
    file.name ?? file.url.split('/').pop() ?? file.sha256.slice(0, 12)
  const ext = filename.split('.').pop()?.toUpperCase() ?? ''

  return (
    <View style={styles.row}>
      <View style={styles.badge}>
        <SSText size="xs" color="muted" numberOfLines={1}>
          {ext || '—'}
        </SSText>
      </View>
      <SSVStack gap="none" style={styles.rowText}>
        <SSText size="sm" numberOfLines={1}>
          {filename}
        </SSText>
        <SSText size="xs" color="muted">
          {formatFileSize(file.size)}
          {file.uploaded ? `  ·  ${formatUploadDate(file.uploaded)}` : ''}
        </SSText>
      </SSVStack>
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
  center: {
    flex: 1,
    justifyContent: 'center'
  },
  list: {
    paddingHorizontal: Layout.mainContainer.paddingHorizontal,
    paddingVertical: 8
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
