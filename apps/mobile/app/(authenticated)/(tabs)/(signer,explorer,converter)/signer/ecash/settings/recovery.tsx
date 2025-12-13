import * as Clipboard from 'expo-clipboard'
import { Stack, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert, ScrollView, StyleSheet } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useEcash } from '@/hooks/useEcash'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

export default function EcashRecoveryPage() {
  const router = useRouter()
  const { restoreFromBackup } = useEcash()
  const [backupData, setBackupData] = useState('')
  const [isValidating, setIsValidating] = useState(false)

  const validateBackupData = useCallback((data: string) => {
    try {
      const parsed = JSON.parse(data)

      // Check for required fields
      if (!parsed.version) {
        throw new Error('Missing version field')
      }

      if (!Array.isArray(parsed.mints)) {
        throw new Error('Invalid mints data')
      }

      if (!Array.isArray(parsed.proofs)) {
        throw new Error('Invalid proofs data')
      }

      if (!Array.isArray(parsed.transactions)) {
        throw new Error('Invalid transactions data')
      }

      // Validate mint structure
      for (const mint of parsed.mints) {
        if (!mint.url || typeof mint.url !== 'string') {
          throw new Error('Invalid mint URL')
        }
      }

      // Validate proof structure
      for (const proof of parsed.proofs) {
        if (
          !proof.id ||
          !proof.secret ||
          !proof.C ||
          typeof proof.amount !== 'number'
        ) {
          throw new Error('Invalid proof structure')
        }
      }

      return parsed
    } catch (error) {
      throw new Error(
        `Invalid backup data: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }, [])

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const clipboardText = await Clipboard.getStringAsync()
      if (clipboardText) {
        setBackupData(clipboardText)
        toast.success(t('common.pastedFromClipboard'))
      } else {
        toast.error('No data found in clipboard')
      }
    } catch {
      toast.error('Failed to read clipboard')
    }
  }, [])

  const handleRestoreBackup = useCallback(
    (validatedData: {
      version: string
      mints: { url: string }[]
      proofs: { id: string; secret: string; C: string; amount: number }[]
      transactions: unknown[]
      totalBalance?: number
    }) => {
      try {
        restoreFromBackup(validatedData)
        router.back()
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to restore backup'
        )
      }
    },
    [restoreFromBackup, router]
  )

  const handleValidateBackup = useCallback(() => {
    if (!backupData.trim()) {
      toast.error('Please enter backup data')
      return
    }

    setIsValidating(true)
    try {
      const validatedData = validateBackupData(backupData)

      // Show preview of what will be restored
      const mintCount = validatedData.mints.length
      const proofCount = validatedData.proofs.length
      const transactionCount = validatedData.transactions.length
      const totalBalance = validatedData.totalBalance || 0

      Alert.alert(
        t('ecash.recovery.confirmRestore'),
        `This will restore:\n• ${mintCount} mint(s)\n• ${proofCount} proof(s)\n• ${transactionCount} transaction(s)\n• ${totalBalance} sats total balance\n\nThis will replace all current ecash data. Continue?`,
        [
          {
            text: t('common.cancel'),
            style: 'cancel'
          },
          {
            text: t('ecash.recovery.restore'),
            style: 'destructive',
            onPress: () => handleRestoreBackup(validatedData)
          }
        ]
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Invalid backup data'
      )
    } finally {
      setIsValidating(false)
    }
  }, [backupData, validateBackupData, handleRestoreBackup])

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('ecash.recovery.title')}</SSText>
          ),
          headerRight: () => null
        }}
      />
      <ScrollView>
        <SSVStack gap="lg">
          <SSVStack gap="sm">
            <SSText color="muted" size="sm">
              {t('ecash.recovery.backupInstructions')}
            </SSText>

            <SSTextInput
              value={backupData}
              onChangeText={setBackupData}
              multiline
              placeholder={t('ecash.recovery.backupPlaceholder')}
              style={styles.backupInput}
            />
            <SSButton
              label={t('common.paste')}
              onPress={handlePasteFromClipboard}
              variant="subtle"
              style={{ flex: 1 }}
            />

            <SSButton
              label={t('ecash.recovery.validateAndRestore')}
              onPress={handleValidateBackup}
              variant="secondary"
              style={{ flex: 1 }}
              disabled={isValidating}
              loading={isValidating}
            />
          </SSVStack>
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  backupInput: {
    minHeight: 200,
    textAlignVertical: 'top',
    fontFamily: 'monospace',
    fontSize: 12,
    padding: 10,
    height: 'auto',
    width: '100%',
    textAlign: 'left'
  }
})
