import { FlashList } from '@shopify/flash-list'
import { useQuery } from '@tanstack/react-query'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native'

import {
  fetchKind10063Servers,
  listBlossomFiles,
  type BlobDescriptor
} from '@/api/blossom'
import { NostrAPI } from '@/api/nostr'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
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
    unitIndex += 1
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

type FileTypeFilter = 'all' | 'image' | 'video' | 'audio' | 'document' | 'other'

const FILE_TYPE_LABELS: Record<FileTypeFilter, string> = {
  all: 'All',
  audio: 'Audio',
  document: 'Docs',
  image: 'Images',
  other: 'Other',
  video: 'Video'
}

function mimeToCategory(mime?: string): Exclude<FileTypeFilter, 'all'> {
  if (!mime) {
    return 'other'
  }
  if (mime.startsWith('image/')) {
    return 'image'
  }
  if (mime.startsWith('video/')) {
    return 'video'
  }
  if (mime.startsWith('audio/')) {
    return 'audio'
  }
  if (mime.startsWith('text/') || mime === 'application/pdf') {
    return 'document'
  }
  return 'other'
}

function deduplicateBySha256(blobs: BlobDescriptor[]): BlobDescriptor[] {
  const seen = new Set<string>()
  return blobs.filter((b) => {
    if (seen.has(b.sha256)) {
      return false
    }
    seen.add(b.sha256)
    return true
  })
}

async function fetchAllBlossomFiles(
  servers: string[],
  pubkeyHex: string,
  nsec?: string
): Promise<BlobDescriptor[]> {
  const results = await Promise.allSettled(
    servers.map((url) => listBlossomFiles(url, pubkeyHex, nsec))
  )
  const blobs = results.flatMap((r) =>
    r.status === 'fulfilled' ? r.value : []
  )
  return deduplicateBySha256(blobs)
}

export default function NostrFiles() {
  const { npub } = useLocalSearchParams<FilesParams>()

  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )
  const globalRelays = useNostrIdentityStore((state) => state.relays)

  const pubkeyHex = getPubKeyHexFromNpub(npub) ?? ''
  const nsec = identity?.nsec
  const configuredServers = identity?.blossomServers ?? []
  const relays = identity?.relays?.length
    ? identity.relays
    : globalRelays.length
      ? globalRelays
      : NostrAPI.INDEXING_RELAYS

  const { data: discoveredServers = [], isLoading: isDiscovering } = useQuery({
    enabled: !!pubkeyHex && configuredServers.length === 0,
    queryFn: () => fetchKind10063Servers(pubkeyHex, relays),
    queryKey: ['nostr', 'kind10063', pubkeyHex],
    retry: 1,
    staleTime: 10 * 60_000
  })

  const servers =
    configuredServers.length > 0 ? configuredServers : discoveredServers

  const {
    data: files = [],
    isLoading: isFetching,
    isError
  } = useQuery({
    enabled: !!pubkeyHex && servers.length > 0,
    queryFn: () => fetchAllBlossomFiles(servers, pubkeyHex, nsec),
    queryKey: ['blossom', 'files', pubkeyHex, servers.join(',')],
    retry: 1,
    staleTime: 5 * 60_000
  })

  const [activeFilter, setActiveFilter] = useState<FileTypeFilter>('all')

  const isLoading = isDiscovering || isFetching
  const serverLabel = servers[0] ?? ''

  const availableFilters: FileTypeFilter[] = ['all']
  const categoryCounts: Partial<Record<FileTypeFilter, number>> = {}
  for (const f of files) {
    const cat = mimeToCategory(f.type)
    categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1
  }
  for (const cat of ['image', 'video', 'audio', 'document', 'other'] as const) {
    if (categoryCounts[cat]) {
      availableFilters.push(cat)
    }
  }

  const visibleFiles =
    activeFilter === 'all'
      ? files
      : files.filter((f) => mimeToCategory(f.type) === activeFilter)

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
            {serverLabel}
          </SSText>
        </SSVStack>
      ) : files.length === 0 ? (
        <SSVStack itemsCenter style={styles.center}>
          <SSText color="muted" size="sm">
            {t('nostrIdentity.files.empty')}
          </SSText>
          <SSText color="muted" size="xs">
            {serverLabel}
          </SSText>
        </SSVStack>
      ) : (
        <View style={styles.content}>
          {availableFilters.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipsScroll}
              contentContainerStyle={styles.chips}
            >
              {availableFilters.map((filter) => (
                <TouchableOpacity
                  key={filter}
                  onPress={() => setActiveFilter(filter)}
                  style={[
                    styles.chip,
                    activeFilter === filter && styles.chipActive
                  ]}
                >
                  <SSText
                    size="xs"
                    color={activeFilter === filter ? 'white' : 'muted'}
                    uppercase
                  >
                    {FILE_TYPE_LABELS[filter]}
                  </SSText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          <FlashList
            data={visibleFiles}
            estimatedItemSize={72}
            keyExtractor={(item) => item.sha256}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => <FileRow file={item} />}
          />
        </View>
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
  chip: {
    borderColor: Colors.gray[700],
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  chipActive: {
    backgroundColor: Colors.gray[700],
    borderColor: Colors.gray[700]
  },
  chips: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Layout.mainContainer.paddingHorizontal,
    paddingVertical: 8
  },
  chipsScroll: {
    flexGrow: 0,
    flexShrink: 0
  },
  content: {
    flex: 1
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
