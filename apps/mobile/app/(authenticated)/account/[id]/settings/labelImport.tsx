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
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { Colors } from '@/styles'
import { AccountSearchParams } from '@/types/navigation/searchParams'
import {
  Bip329FileType,
  bip329FileTypes,
  Label,
  bip329mimes,
  bip329parser
} from '@/utils/bip329'
import { pickFile } from '@/utils/filesystem'

export default function SSLabelExport() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()

  const [account, importLabelsToAccount] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.name === accountId),
      state.importLabels
    ])
  )

  const [importType, setImportType] = useState<Bip329FileType>('JSONL')
  const [importContent, setImportContent] = useState('')
  const [invalidContent, setInvalidContent] = useState(false)

  if (!account || !accountId) return <Redirect href="/" />

  function importLabelsFromClipboard() {
    const labels: Label[] = bip329parser[importType](importContent)
    importLabelsToAccount(accountId!, labels)
    router.back()
  }

  async function importLabels() {
    const type = bip329mimes[importType]
    const fileContent = await pickFile({ type })
    if (!fileContent) return

    const labels: Label[] = bip329parser[importType](fileContent)
    importLabelsToAccount(accountId!, labels)
    router.back()
  }

  async function pasteFromClipboard() {
    const text = await Clipboard.getStringAsync()
    if (!text) return
    setImportContent(text)

    // try guessing import type
    for (const type of bip329FileTypes) {
      try {
        bip329parser[type](text)
        setImportType(type)
        break
      } catch {
        //
      }
    }
  }

  function updateImportType(type: Bip329FileType) {
    setImportType(type)
    try {
      bip329parser[type](importContent)
      setInvalidContent(false)
    } catch {
      setInvalidContent(true)
    }
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
        <SSText center uppercase weight="bold" size="lg" color="muted">
          IMPORT BIP329 LABELS
        </SSText>
        <SSHStack>
          {bip329FileTypes.map((type) => (
            <SSCheckbox
              key={type}
              label={type}
              selected={importType === type}
              onPress={() => updateImportType(type)}
            />
          ))}
        </SSHStack>
        {importContent && (
          <SSVStack>
            <View
              style={{
                padding: 10,
                backgroundColor: Colors.gray[900],
                borderRadius: 5,
                borderWidth: 1,
                borderColor: invalidContent ? Colors.error : Colors.gray[900]
              }}
            >
              <SSText color="white" size="md" type="mono">
                {importContent}
              </SSText>
            </View>
            <SSButton
              label="IMPORT FROM CLIPBOARD"
              onPress={importLabelsFromClipboard}
            />
          </SSVStack>
        )}
        <SSButton label="PASTE FROM CLIPBOARD" onPress={pasteFromClipboard} />
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
