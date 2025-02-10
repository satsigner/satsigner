import * as Clipboard from 'expo-clipboard'
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { Colors } from '@/styles'
import { AccountSearchParams } from '@/types/navigation/searchParams'
import { CSVtoLabels } from '@/utils/bip329'
import { pickFile } from '@/utils/filesystem'

export default function SSLabelExport() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()

  const [account, importLabelsToAccount] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.name === accountId),
      state.importLabels
    ])
  )

  const [importType, setImportType] = useState<'JSON' | 'CSV'>('JSON')
  const [importContent, setImportContent] = useState('')

  function importLabelsFromClipboard() {
    const labels =
      importType === 'JSON'
        ? JSON.parse(importContent)
        : CSVtoLabels(importContent)
    importLabelsToAccount(accountId!, labels)
    router.back()
  }

  async function importLabels() {
    const type = importType === 'JSON' ? 'application/json' : 'text/csv'
    const fileContent = await pickFile({ type })
    if (!fileContent) return
    const labels =
      importType === 'JSON' ? JSON.parse(fileContent) : CSVtoLabels(fileContent)
    importLabelsToAccount(accountId!, labels)
    router.back()
  }

  if (!account || !accountId) return <Redirect href="/" />

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
          {t('account.import.labels')}
        </SSText>
        <SSHStack>
          <SSCheckbox
            label={t('files.json')}
            selected={importType === 'JSON'}
            onPress={() => setImportType('JSON')}
          />
          <SSCheckbox
            label={t('files.csv')}
            selected={importType === 'CSV'}
            onPress={() => setImportType('CSV')}
          />
        </SSHStack>
        {importContent && (
          <SSVStack>
            <View
              style={{
                padding: 10,
                backgroundColor: Colors.gray[900],
                borderRadius: 5
              }}
            >
              <SSText color="white" size="md" type="mono">
                {importContent}
              </SSText>
            </View>
            <SSButton
              label={t('common.importFromClipboard')}
              onPress={importLabelsFromClipboard}
            />
          </SSVStack>
        )}
        <SSButton
          label={t('common.pasteFromClipboard')}
          onPress={async () => {
            const text = await Clipboard.getStringAsync()
            setImportContent(text || '')
          }}
        />
        <SSButton
          label={t('import.from', { name: importType })}
          variant="secondary"
          onPress={importLabels}
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
