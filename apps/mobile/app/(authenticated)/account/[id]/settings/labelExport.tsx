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
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { Colors } from '@/styles'
import { AccountSearchParams } from '@/types/navigation/searchParams'
import {
  bip329export,
  type Bip329FileType,
  bip329FileTypes,
  bip329mimes,
  formatTransactionLabels,
  formatUtxoLabels,
  type Label
} from '@/utils/bip329'
import { shareFile } from '@/utils/filesystem'

export default function SSLabelExport() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()

  const [account] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.name === accountId)
    ])
  )

  const [exportType, setExportType] = useState<Bip329FileType>('JSONL')
  const [exportContent, setExportContent] = useState('')

  useEffect(() => {
    setExportContent(bip329export[exportType](labels))
  }, [exportType]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!account) return <Redirect href="/" />

  const labels = [
    ...formatTransactionLabels(account.transactions),
    ...formatUtxoLabels(account.utxos)
  ] as Label[]

  async function exportLabels() {
    if (!account) return
    const date = new Date().toISOString().slice(0, -5)
    const ext = exportType.toLowerCase()
    const filename = `labels_${accountId}_${date}.${ext}`
    const mime = bip329mimes[exportType]
    shareFile({
      filename,
      fileContent: exportContent,
      dialogTitle: 'Save Labels file',
      mimeType: mime
    })
  }

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
              {bip329FileTypes.map((ext) => (
                <SSCheckbox
                  key={ext}
                  label={ext}
                  selected={exportType === ext}
                  onPress={() => setExportType(ext)}
                />
              ))}
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
              <SSButton label="COPY TO CLIPBOARD" />
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
