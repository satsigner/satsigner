import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { Colors } from '@/styles'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
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

export default function ExportLabels() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()

  const account = useAccountsStore((state) =>
    state.accounts.find((_account) => _account.id === accountId)
  )

  const [exportType, setExportType] = useState<Bip329FileType>('JSONL')
  const [exportContent, setExportContent] = useState('')

  useEffect(() => {
    setExportContent(bip329export[exportType](labels))
  }, [exportType]) // eslint-disable-line react-hooks/exhaustive-deps

  async function exportLabels() {
    if (!account) return
    const date = new Date().toISOString().slice(0, -5)
    const ext = exportType.toLowerCase()
    const filename = `${t('export.file.name.labels')}_${accountId}_${date}.${ext}`
    const mime = bip329mimes[exportType]
    shareFile({
      filename,
      fileContent: exportContent,
      dialogTitle: t('export.file.save'),
      mimeType: mime
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
              <SSButton label={t('common.copyToClipboard')} />
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
