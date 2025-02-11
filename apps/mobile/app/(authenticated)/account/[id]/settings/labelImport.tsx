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
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import {
  type Bip329FileType,
  bip329FileTypes,
  bip329mimes,
  bip329parser,
  type Label
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
        setInvalidContent(false)
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
              label={t('common.importFromClipboard')}
              onPress={importLabelsFromClipboard}
              disabled={invalidContent}
            />
          </SSVStack>
        )}
        <SSButton
          label={t('common.pasteFromClipboard')}
          onPress={pasteFromClipboard}
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
