import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { type BlobDescriptor } from '@/api/blossom'
import SSNostrBlossomFileFilterChips from '@/components/SSNostrBlossomFileFilterChips'
import SSNostrBlossomFileList from '@/components/SSNostrBlossomFileList'
import SSText from '@/components/SSText'
import { useNostrBlossomFiles } from '@/hooks/useNostrBlossomFiles'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { type BlossomFileTypeFilter } from '@/types/models/Blossom'
import {
  filterBlossomFilesByType,
  getAvailableBlossomFileFilters
} from '@/utils/blossomFiles'
import { nostrFileDetailHref } from '@/utils/nostrNavigation'

type FilesParams = {
  npub: string
}

export default function NostrFiles() {
  const router = useRouter()
  const { npub } = useLocalSearchParams<FilesParams>()
  const { files, isError, isLoading, servers } = useNostrBlossomFiles(npub)
  const [activeFilter, setActiveFilter] = useState<BlossomFileTypeFilter>('all')

  const serverLabel = servers[0] ?? ''
  const availableFilters = getAvailableBlossomFileFilters(files)
  const visibleFiles = filterBlossomFilesByType(files, activeFilter)

  function handleFilePress(file: BlobDescriptor) {
    if (!npub) {
      return
    }

    router.navigate(nostrFileDetailHref(npub, file.sha256))
  }

  function handleFilterChange(filter: BlossomFileTypeFilter) {
    setActiveFilter(filter)
  }

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
          <SSNostrBlossomFileFilterChips
            activeFilter={activeFilter}
            availableFilters={availableFilters}
            onFilterChange={handleFilterChange}
          />
          <SSNostrBlossomFileList files={visibleFiles} onPress={handleFilePress} />
        </View>
      )}
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center'
  },
  content: {
    flex: 1
  }
})
