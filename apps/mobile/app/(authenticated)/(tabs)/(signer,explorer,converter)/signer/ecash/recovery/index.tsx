import * as Clipboard from 'expo-clipboard'
import { Stack, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert, ScrollView, StyleSheet } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useEcash } from '@/hooks/useEcash'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

export default function EcashRecoveryPage() {
  const router = useRouter()
  const { restoreFromBackup, clearAllData, mints, proofs, transactions } =
    useEcash()
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
    } catch (error) {
      toast.error('Failed to read clipboard')
    }
  }, [])

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
  }, [backupData, validateBackupData])

  const handleRestoreBackup = useCallback(
    (validatedData: any) => {
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

  const handleClearAllData = useCallback(() => {
    const hasData =
      mints.length > 0 || proofs.length > 0 || transactions.length > 0

    if (!hasData) {
      toast.info('No data to clear')
      return
    }

    Alert.alert(
      t('ecash.recovery.clearAllData'),
      'This will permanently delete all ecash data including mints, proofs, and transaction history. This action cannot be undone.',
      [
        {
          text: t('common.cancel'),
          style: 'cancel'
        },
        {
          text: t('ecash.recovery.clear'),
          style: 'destructive',
          onPress: () => {
            clearAllData()
            router.back()
          }
        }
      ]
    )
  }, [mints.length, proofs.length, transactions.length, clearAllData, router])

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('ecash.recovery.title')}</SSText>
          )
        }}
      />

      <ScrollView>
        <SSVStack gap="lg">
          <SSVStack gap="md">
            <SSText uppercase>{t('ecash.recovery.title')}</SSText>
            <SSText color="muted">{t('ecash.recovery.description')}</SSText>
          </SSVStack>

          <SSVStack gap="md">
            <SSText uppercase>{t('ecash.recovery.backupData')}</SSText>
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

            <SSHStack gap="sm">
              <SSButton
                label={t('common.paste')}
                onPress={handlePasteFromClipboard}
                variant="outline"
                style={{ flex: 1 }}
              />
              <SSButton
                label={t('ecash.recovery.validateAndRestore')}
                onPress={handleValidateBackup}
                variant="gradient"
                gradientType="special"
                style={{ flex: 1 }}
                disabled={isValidating}
              />
            </SSHStack>
          </SSVStack>

          <SSVStack gap="md" style={styles.dangerSection}>
            <SSText uppercase>{t('ecash.recovery.dangerZone')}</SSText>
            <SSText color="muted" size="sm">
              {t('ecash.recovery.dangerDescription')}
            </SSText>

            <SSButton
              label={t('ecash.recovery.clearAllData')}
              onPress={handleClearAllData}
              variant="danger"
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
  },
  dangerSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#333'
  }
})
