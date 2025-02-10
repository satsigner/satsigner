import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { Colors } from '@/styles'
import { AccountSearchParams } from '@/types/navigation/searchParams'
import {
  formatTransactionLabels,
  formatUtxoLabels,
  Label,
  labelsToCSV
} from '@/utils/bip329'
import { shareFile } from '@/utils/filesystem'

export default function SSLabelExport() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()

  const [account] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.name === accountId)
    ])
  )

  const [exportType, setExportType] = useState<'JSON' | 'CSV'>('JSON')
  const [exportContent, setExportContent] = useState('')

  useEffect(() => {
    if (exportType === 'JSON') setExportContent(JSON.stringify(labels))
    if (exportType === 'CSV') setExportContent(labelsToCSV(labels))
  }, [exportType]) // eslint-disable-line react-hooks/exhaustive-deps

  async function exportLabels() {
    if (!account) return
    const date = new Date().toISOString().slice(0, -5)
    const ext = exportType.toLowerCase()
    const filename = `${t('export.file.name.labels')}_${accountId}_${date}.${ext}`
    shareFile({
      filename,
      fileContent: exportContent,
      dialogTitle: t('export.file.save'),
      mimeType: `application/${ext}`
    })
  }

  if (!account) return <Redirect href="/" />

  const labels = [
    ...formatTransactionLabels(account.transactions),
    ...formatUtxoLabels(account.utxos)
  ] as Label[]

  return (
    <ScrollView style={{ width: '100%' }}>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText size="xl">{t('settings.title')}</SSText>,
          headerRight: undefined
        }}
      />
      <SSVStack style={{ padding: 20 }}>
        {labels.length === 0 && (
          <>
            <SSText center size="md" weight="bold">
              {t('account.export.noLabels.title')}
            </SSText>
            <SSText size="md">
              {t('account.export.noLabels.description')}
            </SSText>
          </>
        )}
        {labels.length > 0 && (
          <>
            <SSText center uppercase weight="bold" size="lg" color="muted">
              {t('account.export.labels')}
            </SSText>
            <SSHStack>
              <SSCheckbox
                label={t('files.json')}
                selected={exportType === 'JSON'}
                onPress={() => setExportType('JSON')}
              />
              <SSCheckbox
                label={t('files.csv')}
                selected={exportType === 'CSV'}
                onPress={() => setExportType('CSV')}
              />
            </SSHStack>
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
              <SSButton
                label={t('common.copyToClipboard')}
                onPress={() => true}
              />
            </SSClipboardCopy>
            <SSButton
              label={`${t('common.download')} ${exportType}`}
              variant="secondary"
              onPress={exportLabels}
            />
            <SSButton
              label={t('common.cancel')}
              variant="ghost"
              onPress={() => router.back()}
            />
          </>
        )}
      </SSVStack>
    </ScrollView>
  )
}
