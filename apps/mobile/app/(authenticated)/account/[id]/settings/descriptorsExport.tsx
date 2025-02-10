import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { Colors } from '@/styles'
import { AccountSearchParams } from '@/types/navigation/searchParams'
import { shareFile } from '@/utils/filesystem'

export default function SSLabelExport() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()

  const [account] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.name === accountId)
    ])
  )

  const [exportContent, setExportContent] = useState('')

  useEffect(() => {
    setExportContent(
      [account?.externalDescriptor, account?.internalDescriptor]
        .filter((item) => item)
        .join('\n')
    )
  }, [account])

  if (!account) return <Redirect href="/" />

  async function exportDescriptors() {
    if (!account) return
    const date = new Date().toISOString().slice(0, -5)
    const ext = 'txt'
    const filename = `${t('export.file.name.descriptors')}_${accountId}_${date}.${ext}`
    shareFile({
      filename,
      fileContent: exportContent,
      dialogTitle: t('export.file.save'),
      mimeType: `text/plain`
    })
  }

  return (
    <ScrollView style={{ width: '100%' }}>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText size="xl">{t('settings.title')}</SSText>,
          headerRight: undefined
        }}
      />
      <SSVStack style={{ padding: 20 }}>
        <SSText center uppercase weight="bold" size="lg" color="muted">
          {t('account.export.descriptors')}
        </SSText>
        <View
          style={{
            padding: 10,
            backgroundColor: Colors.gray[900],
            borderRadius: 5
          }}
        >
          <SSText color="white" size="md" type="mono">
            {exportContent}
          </SSText>
        </View>
        <SSClipboardCopy text={exportContent}>
          <SSButton label={t('common.copyToClipboard')} onPress={() => true} />
        </SSClipboardCopy>
        <SSButton
          label={t('common.downloadFile')}
          variant="secondary"
          onPress={exportDescriptors}
        />
        <SSButton
          label={t('common.cancel')}
          variant="ghost"
          onPress={() => router.back()}
        />
      </SSVStack>
    </ScrollView>
  )
}
