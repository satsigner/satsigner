import * as Clipboard from 'expo-clipboard'
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconEyeOn } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSLabelConflict, {
  type Conflict,
  detectConflcits
} from '@/components/SSLabelConflict'
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
  bip329parser,
  type Label
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

  const [showConflictSolver, setShowConflictSolver] = useState(false)
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [pendingLabels, setPendingLabels] = useState<Label[]>([])

  const [importCount, setImportCount] = useState(0)
  const [importCountTotal, setImportCountTotal] = useState(0)

  function tryImportLabels(content: string) {
    const labels = bip329parser[importType](content)
    const currentLabels = Object.values(account?.labels || [])
    const conflicts = detectConflcits(currentLabels, labels)
    if (conflicts.length > 0) {
      setPendingLabels(labels)
      setConflicts(conflicts)
      setShowConflictSolver(true)
    } else {
      importLabels(labels)
    }
  }

  function importLabels(labels: Label[]) {
    const importCount = importLabelsToAccount(accountId!, labels)
    setImportCount(importCount)
    setImportCountTotal(labels.length)
    setSuccessMsgVisible(true)
    sendLabelsToNostr(account)
  }

  function importLabelsWithConflicts(resolvedLabels: Label[]) {
    const labelsDict: Record<Label['ref'], Label> = {}
    for (const label of pendingLabels) labelsDict[label.ref] = label
    for (const label of resolvedLabels) labelsDict[label.ref] = label
    importLabels(Object.values(labelsDict))
    setShowConflictSolver(false)
  }

  function handleImport() {
    if (!importContent) return
    if (invalidContent) {
      toast.error(t('account.import.labelsInvalidFormat'))
      return
    }
    try {
      tryImportLabels(importContent)
    } catch {
      toast.error(t('account.import.labelsInvalidFormat'))
    }
  }

  async function importLabelsFromFile() {
    const type = bip329mimes[importType]
    const fileContent = await pickFile({ type })
    if (!fileContent) return
    setImportContent(fileContent)

    // Validate the content
    try {
      bip329parser[importType](fileContent)
      setInvalidContent(false)
    } catch {
      setInvalidContent(true)
      toast.error(t('account.import.labelsInvalidFormat'))
    }
  }

  async function pasteFromClipboard() {
    const text = await Clipboard.getStringAsync()
    if (!text) {
      toast.error(t('account.import.labelsEmptyClipboard'))
      return
    }
    setImportContent(text)

    // try guessing import type
    let foundValidType = false
    for (const type of bip329FileTypes) {
      try {
        bip329parser[type](text)
        setImportType(type)
        setInvalidContent(false)
        foundValidType = true
        break
      } catch {
        //
      }
    }

    if (!foundValidType) {
      setInvalidContent(true)
      toast.error(t('account.import.labelsInvalidFormat'))
    }
  }

  function updateImportType(type: Bip329FileType) {
    setImportType(type)
    if (!importContent) return
    try {
      bip329parser[type](importContent)
      setInvalidContent(false)
    } catch {
      setInvalidContent(true)
      toast.error(t('account.import.labelsInvalidFormat'))
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
      <SSVStack style={{ padding: 20 }}>
        <SSText center uppercase color="muted">
          {t('account.import.labels')}
        </SSText>
        <SSHStack gap="sm" style={{ paddingHorizontal: 20 }}>
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
                borderColor: invalidContent ? Colors.error : Colors.gray[800],
               
              }}
            >
              <SSText color="white" size="sm" type="mono">
                {importContent}
              </SSText>
            </View>
          </SSVStack>
        )}
        {importContent && !invalidContent ? (
          <SSVStack gap="sm">
            <SSButton
              label={t('common.import')}
              variant="secondary"
              onPress={handleImport}
            />
            <SSButton
              label={t('common.cancel')}
              variant="ghost"
              onPress={() => {
                setImportContent('')
                setInvalidContent(false)
              }}
            />
          </SSVStack>
        ) : (
          <SSVStack gap="sm">
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
        )}
      </SSVStack>
      <SSModal
        visible={showConflictSolver}
        onClose={() => setShowConflictSolver(false)}
        fullOpacity
      >
        <SSLabelConflict
          conflicts={conflicts}
          onResolve={importLabelsWithConflicts}
        />
      </SSModal>
      <SSModal visible={successMsgVisible} onClose={router.back} fullOpacity>
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
