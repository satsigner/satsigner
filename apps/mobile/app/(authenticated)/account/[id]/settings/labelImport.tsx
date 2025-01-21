import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { ScrollView, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'
import * as Clipboard from 'expo-clipboard'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { Colors } from '@/styles'
import { AccountSearchParams } from '@/types/navigation/searchParams'
import { pickFile } from '@/utils/filesystem'
import SSCheckbox from '@/components/SSCheckbox'
import { useState } from 'react'
import SSHStack from '@/layouts/SSHStack'

export default function SSLabelExport() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()

  const [account, importLabelsToAccount] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.name === accountId),
      state.importLabels
    ])
  )

  const [importType, setImportType] = useState('JSON')
  const [importContent, setImportContent] = useState('')

  if (!account) return <Redirect href="/" />

  async function importLabels() {
    const type = importType === 'JSON' ? 'application/json' : 'text/csv'
    const fileContent = await pickFile({ type })
    const labels = JSON.parse(fileContent)
    importLabelsToAccount(accountId, labels)
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
        <SSText center uppercase weight="bold" size="lg" color="muted">
          IMPORT BIP329 LABELS
        </SSText>
        <SSHStack>
          <SSCheckbox
            label="JSON"
            selected={importType === 'JSON'}
            onPress={() => setImportType('JSON')}
          />
          <SSCheckbox
            label="CSV"
            selected={importType === 'CSV'}
            onPress={() => setImportType('CSV')}
          />
        </SSHStack>
        {importContent && (
          <View
            style={{
              padding: 10,
              backgroundColor: Colors.gray[900],
              borderRadius: 5
            }}
          >
            <SSText color="white" size="md" weight="mono">
              {importContent}
            </SSText>
          </View>
        )}
        <SSButton
          label="PASTE FROM CLIPBOARD"
          onPress={async () => {
            const text = await Clipboard.getStringAsync()
            setImportContent(text || '')
          }}
        />
        <SSButton
          label={`IMPORT FROM ${importType}`}
          variant="secondary"
          onPress={importLabels}
        />
        <SSButton
          label="CANCEL"
          variant="ghost"
          onPress={() => router.back()}
        />
      </SSVStack>
    </ScrollView>
  )
}
