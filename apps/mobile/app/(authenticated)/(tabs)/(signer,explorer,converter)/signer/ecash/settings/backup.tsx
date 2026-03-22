import * as Clipboard from 'expo-clipboard'
import { Stack } from 'expo-router'
import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useEcash } from '@/hooks/useEcash'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { formatNumber } from '@/utils/format'

export default function EcashBackupPage() {
  const { mints, proofs, activeMint, transactions } = useEcash()
  const [currencyUnit, useZeroPadding] = useSettingsStore(
    useShallow((state) => [state.currencyUnit, state.useZeroPadding])
  )
  const zeroPadding = useZeroPadding || currencyUnit === 'btc'
  const [showBackupData, setShowBackupData] = useState(false)
  const [backupData, setBackupData] = useState('')
  const [includeTokenProofs, setIncludeTokenProofs] = useState(true)
  const [includeMintInformation, setIncludeMintInformation] = useState(true)
  const [includeTransactionHistory, setIncludeTransactionHistory] =
    useState(true)
  const [isGenerating, setIsGenerating] = useState(false)

  const generateBackupData = useCallback(async () => {
    setIsGenerating(true)
    try {
      const data: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
        version: '1.0'
      }

      if (includeTokenProofs) {
        data.proofs = proofs.map((proof) => ({
          C: proof.C,
          amount: proof.amount,
          id: proof.id,
          secret: proof.secret
        }))
        data.totalBalance = proofs.reduce((sum, proof) => sum + proof.amount, 0)
      }

      if (includeMintInformation) {
        data.mints = mints.map((mint) => ({
          balance: mint.balance,
          isConnected: mint.isConnected,
          keysets: mint.keysets,
          lastSync: mint.lastSync,
          name: mint.name,
          url: mint.url
        }))
        data.activeMint = activeMint
          ? {
              name: activeMint.name,
              url: activeMint.url
            }
          : null
      }

      if (includeTransactionHistory) {
        data.transactions = transactions.map((transaction) => ({
          amount: transaction.amount,
          id: transaction.id,
          invoice: transaction.invoice,
          memo: transaction.memo,
          mintUrl: transaction.mintUrl,
          quoteId: transaction.quoteId,
          timestamp: transaction.timestamp,
          token: transaction.token,
          tokenStatus: transaction.tokenStatus,
          type: transaction.type
        }))
      }

      const jsonData = JSON.stringify(data, null, 2)
      setBackupData(jsonData)
      setShowBackupData(true)
    } catch {
      toast.error(t('ecash.error.backupGenerationFailed'))
    } finally {
      setIsGenerating(false)
    }
  }, [
    includeTokenProofs,
    includeMintInformation,
    includeTransactionHistory,
    proofs,
    mints,
    activeMint,
    transactions
  ])

  const handleCopyBackup = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(backupData)
      toast.success(t('common.copiedToClipboard'))
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }, [backupData])

  const handleClose = () => {
    setShowBackupData(false)
    setBackupData('')
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerRight: () => null,
          headerTitle: () => (
            <SSText uppercase>{t('ecash.backup.title')}</SSText>
          )
        }}
      />
      <ScrollView>
        <SSVStack gap="lg">
          <SSVStack gap="md">
            <SSText uppercase>{t('ecash.backup.title')}</SSText>
            <SSText color="muted">{t('ecash.backup.description')}</SSText>
          </SSVStack>
          <SSVStack gap="md">
            <SSText uppercase>{t('ecash.backup.walletInfo')}</SSText>
            <SSVStack gap="sm">
              <SSHStack>
                <SSText color="muted" style={{ flex: 1 }}>
                  {t('ecash.backup.totalBalance')}:
                </SSText>
                <SSText weight="medium">
                  {formatNumber(
                    proofs.reduce((sum, proof) => sum + proof.amount, 0),
                    0,
                    zeroPadding
                  )}{' '}
                  {currencyUnit === 'btc'
                    ? t('bitcoin.btc')
                    : t('bitcoin.sats')}
                </SSText>
              </SSHStack>
              <SSHStack>
                <SSText color="muted" style={{ flex: 1 }}>
                  {t('ecash.backup.connectedMints')}:
                </SSText>
                <SSText weight="medium">{mints.length}</SSText>
              </SSHStack>
              <SSHStack>
                <SSText color="muted" style={{ flex: 1 }}>
                  {t('ecash.backup.totalProofs')}:
                </SSText>
                <SSText weight="medium">{proofs.length}</SSText>
              </SSHStack>
              {activeMint && (
                <SSHStack>
                  <SSText color="muted" style={{ flex: 1 }}>
                    {t('ecash.backup.activeMint')}:
                  </SSText>
                  <SSText weight="medium" numberOfLines={1}>
                    {activeMint.name || activeMint.url}
                  </SSText>
                </SSHStack>
              )}
            </SSVStack>
          </SSVStack>
          <SSVStack gap="md">
            <SSText uppercase>{t('ecash.backup.warning')}</SSText>
            <SSText color="muted" size="sm">
              {t('ecash.backup.warningText')}
            </SSText>
          </SSVStack>
          <SSVStack gap="md">
            <SSText uppercase>{t('ecash.backup.backupOptions')}</SSText>
            <SSVStack gap="sm">
              <SSCheckbox
                label={t('ecash.backup.includeTokenProofs')}
                selected={includeTokenProofs}
                onPress={() => setIncludeTokenProofs(!includeTokenProofs)}
              />
              <SSCheckbox
                label={t('ecash.backup.includeMintInformation')}
                selected={includeMintInformation}
                onPress={() =>
                  setIncludeMintInformation(!includeMintInformation)
                }
              />
              <SSCheckbox
                label={t('ecash.backup.includeTransactionHistory')}
                selected={includeTransactionHistory}
                onPress={() =>
                  setIncludeTransactionHistory(!includeTransactionHistory)
                }
              />
            </SSVStack>
          </SSVStack>
          <SSButton
            label={t('ecash.backup.generateBackup')}
            onPress={generateBackupData}
            variant="gradient"
            gradientType="special"
            loading={isGenerating}
          />
          {showBackupData && (
            <SSVStack gap="md" style={styles.backupDataSection}>
              <SSText uppercase>{t('ecash.backup.backupData')}</SSText>
              <SSText color="muted" size="sm">
                {t('ecash.backup.backupInstructions')}
              </SSText>

              <SSTextInput
                value={backupData}
                multiline
                editable={false}
                style={styles.backupInput}
              />
              <SSHStack gap="sm">
                <SSButton
                  label={t('common.copy')}
                  onPress={handleCopyBackup}
                  variant="outline"
                  style={{ flex: 1 }}
                />
                <SSButton
                  label={t('common.close')}
                  onPress={handleClose}
                  variant="subtle"
                  style={{ flex: 1 }}
                />
              </SSHStack>
            </SSVStack>
          )}
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  backupDataSection: {
    borderTopColor: Colors.gray[800],
    borderTopWidth: 1,
    marginTop: 20,
    paddingTop: 20
  },
  backupInput: {
    fontFamily: 'monospace',
    fontSize: 12,
    height: 'auto',
    minHeight: 200,
    padding: 10,
    textAlign: 'left',
    textAlignVertical: 'top',
    width: '100%'
  }
})
