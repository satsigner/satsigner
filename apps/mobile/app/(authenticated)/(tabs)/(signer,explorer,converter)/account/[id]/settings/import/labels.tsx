import * as Clipboard from 'expo-clipboard'
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconEyeOn } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import useNostrSync from '@/hooks/useNostrSync'
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
  bip329parser
} from '@/utils/bip329'
import { pickFile } from '@/utils/filesystem'

export default function ImportLabels() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()

  const [account, importLabelsToAccount] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.id === accountId),
      state.importLabels
    ])
  )

  const { sendLabelsToNostr } = useNostrSync()

  const [importType, setImportType] = useState<Bip329FileType>('JSONL')
  const [importContent, setImportContent] = useState('')
  const [invalidContent, setInvalidContent] = useState(false)
  const [successMsgVisible, setSuccessMsgVisible] = useState(false)

  const [importCount, setImportCount] = useState(0)
  const [importCountTotal, setImportCountTotal] = useState(0)

  function importLabels(content: string) {
    const labels = bip329parser[importType](content)
    const importCount = importLabelsToAccount(accountId!, labels)
    setImportCount(importCount)
    setImportCountTotal(labels.length)
    setSuccessMsgVisible(true)
    sendLabelsToNostr(account)
  }

  function importLabelsFromClipboard() {
    importLabels(importContent)
  }

  async function importLabelsFromFile() {
    const type = bip329mimes[importType]
    const fileContent = await pickFile({ type })
    if (!fileContent) return
    importLabels(fileContent)
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
          headerTitle: () => (
            <SSHStack gap="sm">
              <SSText uppercase>{account.name}</SSText>
              {account.policyType === 'watchonly' && (
                <SSIconEyeOn stroke="#fff" height={16} width={16} />
              )}
            </SSHStack>
          ),
          headerRight: undefined
        }}
      />
      <SSVStack style={{ padding: 40 }}>
        <SSText center uppercase color="muted">
          {t('account.import.labels')}
        </SSText>
        <SSHStack>
          {bip329FileTypes.map((type) => (
            <View
              key={type}
              style={{ width: `${100 / bip329FileTypes.length}%` }}
            >
              <SSCheckbox
                label={type}
                selected={importType === type}
                onPress={() => updateImportType(type)}
              />
            </View>
          ))}
        </SSHStack>
        {importContent && (
          <SSVStack>
            <View
              style={{
                padding: 10,
                backgroundColor: Colors.gray[950],
                borderRadius: 5,
                borderWidth: 1,
                borderColor: invalidContent ? Colors.error : Colors.gray[950]
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
          onPress={importLabelsFromFile}
        />
        <SSButton
          label={t('common.cancel')}
          variant="ghost"
          onPress={() => router.back()}
        />
      </SSVStack>
      <SSModal visible={successMsgVisible} onClose={router.back}>
        <SSVStack
          gap="lg"
          style={{ justifyContent: 'center', height: '100%', width: '100%' }}
        >
          <SSText uppercase size="md" center weight="bold">
            {t('import.success', { importCount, total: importCountTotal })}
          </SSText>
          <SSButton label={t('common.close')} onPress={router.back} />
        </SSVStack>
      </SSModal>
    </ScrollView>
  )
}
