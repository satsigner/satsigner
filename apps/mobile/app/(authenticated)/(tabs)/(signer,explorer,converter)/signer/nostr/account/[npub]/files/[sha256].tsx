import { Stack, useLocalSearchParams } from 'expo-router'
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native'

import SSNostrBlossomFileDetailContent from '@/components/SSNostrBlossomFileDetailContent'
import SSText from '@/components/SSText'
import { useNostrBlossomFiles } from '@/hooks/useNostrBlossomFiles'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { findBlossomFileBySha256 } from '@/utils/blossomFiles'

type FileDetailParams = {
  npub: string
  sha256: string
}

export default function NostrFileDetail() {
  const { npub, sha256 } = useLocalSearchParams<FileDetailParams>()
  const { files, isError, isLoading } = useNostrBlossomFiles(npub)

  const file = findBlossomFileBySha256(files, sha256)

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('nostrIdentity.files.detail.title')}</SSText>
          )
        }}
      />
      {isLoading ? (
        <SSVStack itemsCenter style={styles.center}>
          <ActivityIndicator color={Colors.gray[400]} />
        </SSVStack>
      ) : isError || !file ? (
        <SSVStack itemsCenter gap="sm" style={styles.center}>
          <SSText color="muted" size="sm">
            {t('nostrIdentity.files.detail.notFound')}
          </SSText>
        </SSVStack>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <SSNostrBlossomFileDetailContent file={file} />
        </ScrollView>
      )}
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center'
  }
})
