import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { ScrollView, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { Colors } from '@/styles'
import { AccountSearchParams } from '@/types/navigation/searchParams'
import { formatTransactionLabels, formatUtxoLabels } from '@/utils/bip329'
import { shareFile } from '@/utils/filesystem'
import { setClipboard } from '@/utils/clipboard'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSCheckbox from '@/components/SSCheckbox'
import { useEffect, useState } from 'react'
import SSHStack from '@/layouts/SSHStack'
import { labelsToCSV } from '@/utils/bip329'

export default function SSLabelExport() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()

  const [account] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.name === accountId)
    ])
  )

  const [exportType, setExportType] = useState('JSON')
  const [exportContent, setExportContent] = useState('')

  if (!account) return <Redirect href="/" />

  const labels = [
    ...formatTransactionLabels(account.transactions),
    ...formatUtxoLabels(account.utxos)
  ]

  useEffect(() => {
    if (exportType === 'JSON') setExportContent(JSON.stringify(labels))
    if (exportType === 'CSV') setExportContent(labelsToCSV(labels))
  }, [exportType])

  async function exportLabels() {
    if (!account) return
    const date = new Date().toISOString().slice(0, -5)
    const ext = exportType.toLowerCase()
    const filename = `labels_${accountId}_${date}.${ext}`
    shareFile({
      filename,
      fileContent: exportContent,
      dialogTitle: 'Save Labels file',
      mimeType: `application/${ext}`
    })
  }

  //
  return (
    <ScrollView style={{ width: '100%' }}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText size="xl">{i18n.t('settings.title')}</SSText>
          ),
          headerRight: undefined
        }}
      />
      <SSVStack style={{ padding: 20 }}>
        {labels.length === 0 && (
          <>
            <SSText center size="md" weight="bold">
              No labels!
            </SSText>
            <SSText size="md">
              Once you add labels to your transactions, utxos, and addresses,
              you will be able to export them.
            </SSText>
          </>
        )}
        {labels.length > 0 && (
          <>
            <SSText center uppercase weight="bold" size="lg" color="muted">
              EXPORT BIP329 LABELS
            </SSText>
            <SSHStack>
              <SSCheckbox
                label="JSON"
                selected={exportType === 'JSON'}
                onPress={() => setExportType('JSON')}
              />
              <SSCheckbox
                label="CSV"
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
              <SSText color="white" size="md" weight="mono">
                {exportContent}
              </SSText>
            </View>
            <SSClipboardCopy text={JSON.stringify(labels)}>
              <SSButton label="COPY TO CLIPBOARD" onPress={() => true} />
            </SSClipboardCopy>
            <SSButton
              label={`DOWNLOAD ${exportType}`}
              variant="secondary"
              onPress={exportLabels}
            />
            <SSButton
              label="CANCEL"
              variant="ghost"
              onPress={() => router.back()}
            />
          </>
        )}
      </SSVStack>
    </ScrollView>
  )
}
