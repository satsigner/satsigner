import * as Clipboard from 'expo-clipboard'
import { Stack } from 'expo-router'
import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useEcash } from '@/hooks/useEcash'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useSettingsStore } from '@/store/settings'
import { formatNumber } from '@/utils/format'

export default function EcashBackupPage() {
  const { mints, proofs, activeMint, transactions } = useEcash()
  const [currencyUnit, useZeroPadding] = useSettingsStore(
    useShallow((state) => [state.currencyUnit, state.useZeroPadding])
  )
  const zeroPadding = useZeroPadding || currencyUnit === 'btc'
  const [showBackupData, setShowBackupData] = useState(false)
  const [backupData, setBackupData] = useState('')

  const generateBackupData = () => {
    const data = {
      version: '1.0',
      mints: mints.map((mint) => ({
        url: mint.url,
        name: mint.name,
        balance: mint.balance,
        isConnected: mint.isConnected,
        keysets: mint.keysets,
        lastSync: mint.lastSync
      })),
      proofs: proofs.map((proof) => ({
        id: proof.id,
        amount: proof.amount,
        secret: proof.secret,
        C: proof.C
      })),
      transactions: transactions.map((transaction) => ({
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        memo: transaction.memo,
        mintUrl: transaction.mintUrl,
        timestamp: transaction.timestamp,
        token: transaction.token,
        tokenStatus: transaction.tokenStatus,
        invoice: transaction.invoice,
        quoteId: transaction.quoteId
      })),
      totalBalance: proofs.reduce((sum, proof) => sum + proof.amount, 0),
      activeMint: activeMint
        ? {
            url: activeMint.url,
            name: activeMint.name
          }
        : null,
      timestamp: new Date().toISOString()
    }

    setBackupData(JSON.stringify(data, null, 2))
    setShowBackupData(true)
  }

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
          <SSButton
            label={t('ecash.backup.generateBackup')}
            onPress={generateBackupData}
            variant="gradient"
            gradientType="special"
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
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#333'
  },
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
