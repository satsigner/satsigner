import * as Clipboard from 'expo-clipboard'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { validateEcashToken } from '@/api/ecash'
import {
  SSIconIncoming,
  SSIconIncomingLightning,
  SSIconOutgoing,
  SSIconOutgoingLightning
} from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSTimeAgoText from '@/components/SSTimeAgoText'
import { useEcash } from '@/hooks/useEcash'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { type EcashTransaction } from '@/types/models/Ecash'
import { type EcashSearchParams } from '@/types/navigation/searchParams'
import { formatFiatPrice } from '@/utils/format'

export default function EcashTransactionDetailPage() {
  const router = useRouter()
  const { id } = useLocalSearchParams<EcashSearchParams>()
  const { transactions, mints, updateTransaction, receiveEcash } = useEcash()
  const useZeroPadding = useSettingsStore((state) => state.useZeroPadding)
  const [fiatCurrency, btcPrice, fetchPrices] = usePriceStore(
    useShallow((state) => [
      state.fiatCurrency,
      state.btcPrice,
      state.fetchPrices
    ])
  )
  const mempoolUrl = useBlockchainStore(
    (state) => state.configsMempool['bitcoin']
  )
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)
  const [isRedeeming, setIsRedeeming] = useState(false)

  // Fetch prices on mount and when currency changes
  useEffect(() => {
    fetchPrices(mempoolUrl)
  }, [fetchPrices, fiatCurrency, mempoolUrl])

  const transaction = transactions.find((t) => t.id === id)

  if (!transaction) {
    return (
      <SSMainLayout>
        <Stack.Screen
          options={{
            headerTitle: () => <SSText uppercase>Transaction Not Found</SSText>
          }}
        />
        <SSVStack gap="md">
          <SSText>Transaction not found</SSText>
          <SSButton
            label="Go Back"
            onPress={() => router.back()}
            variant="outline"
          />
        </SSVStack>
      </SSMainLayout>
    )
  }

  const mint = mints.find((m) => m.url === transaction.mintUrl)

  const getTransactionIcon = (type: EcashTransaction['type']) => {
    switch (type) {
      case 'send':
        return <SSIconOutgoing height={32} width={32} />
      case 'receive':
        return <SSIconIncoming height={32} width={32} />
      case 'mint':
        return <SSIconIncomingLightning height={32} width={32} />
      case 'melt':
        return <SSIconOutgoingLightning height={32} width={32} />
      default:
        return <SSText size="2xl">•</SSText>
    }
  }

  const getTransactionLabel = (type: EcashTransaction['type']) => {
    switch (type) {
      case 'send':
        return t('ecash.transaction.send')
      case 'receive':
        return t('ecash.transaction.receive')
      case 'mint':
        return t('ecash.transaction.mint')
      case 'melt':
        return t('ecash.transaction.melt')
      default:
        return type
    }
  }

  function getTokenStatusColor(tokenStatus: EcashTransaction['tokenStatus']) {
    switch (tokenStatus) {
      case 'unspent':
        return Colors.softBarGreen
      case 'spent':
        return Colors.softBarRed
      case 'invalid':
        return Colors.error
      case 'pending':
        return Colors.warning
      default:
        return Colors.white
    }
  }

  const handleCopyToken = useCallback(async () => {
    if (!transaction.token) return

    try {
      await Clipboard.setStringAsync(transaction.token)
      toast.success(t('common.copiedToClipboard'))
    } catch (error) {
      toast.error('Failed to copy to clipboard')
    }
  }, [transaction.token])

  const handleCopyInvoice = useCallback(async () => {
    if (!transaction.invoice) return

    try {
      await Clipboard.setStringAsync(transaction.invoice)
      toast.success(t('common.copiedToClipboard'))
    } catch (error) {
      toast.error('Failed to copy to clipboard')
    }
  }, [transaction.invoice])

  const handleCheckTokenStatus = useCallback(async () => {
    if (!transaction.token || !transaction.mintUrl) return

    setIsCheckingStatus(true)

    try {
      const result = await validateEcashToken(
        transaction.token,
        transaction.mintUrl
      )
      let tokenStatus: EcashTransaction['tokenStatus']

      if (result.isValid) {
        if (result.isSpent) {
          tokenStatus = 'spent'
        } else {
          tokenStatus = 'unspent'
        }
      } else {
        tokenStatus = 'invalid'
      }

      // Save token status to store
      updateTransaction(transaction.id, { tokenStatus })
    } catch (error) {
      updateTransaction(transaction.id, { tokenStatus: 'invalid' })
      toast.error('Failed to check token status')
    } finally {
      setIsCheckingStatus(false)
    }
  }, [
    transaction.token,
    transaction.mintUrl,
    transaction.id,
    updateTransaction
  ])

  const handleRedeemToken = useCallback(async () => {
    if (!transaction.token || !transaction.mintUrl) return

    setIsRedeeming(true)

    try {
      await receiveEcash(transaction.mintUrl, transaction.token)
      // Update transaction status to indicate it's been redeemed
      updateTransaction(transaction.id, { tokenStatus: 'spent' })
      // Navigate back to ecash main page
      router.back()
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setIsRedeeming(false)
    }
  }, [
    transaction.token,
    transaction.mintUrl,
    transaction.id,
    receiveEcash,
    updateTransaction,
    router
  ])

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('ecash.transactionDetail.title')}</SSText>
          )
        }}
      />

      <ScrollView>
        <SSVStack gap="lg">
          <SSVStack gap="md" style={styles.headerCard}>
            <SSHStack gap="md" style={{ alignItems: 'center' }}>
              {getTransactionIcon(transaction.type)}
              <SSVStack gap="xs">
                <SSText size="lg" weight="medium">
                  {getTransactionLabel(transaction.type)}
                </SSText>
                <SSHStack gap="sm" style={{ alignItems: 'baseline' }}>
                  <SSStyledSatText
                    amount={transaction.amount}
                    decimals={0}
                    useZeroPadding={useZeroPadding}
                    type={
                      transaction.type === 'mint'
                        ? 'receive'
                        : transaction.type === 'melt'
                          ? 'send'
                          : transaction.type
                    }
                    textSize="xl"
                    noColor={false}
                    weight="light"
                    letterSpacing={-0.5}
                  />
                  <SSText color="muted">
                    {t('bitcoin.sats').toLowerCase()}
                  </SSText>
                </SSHStack>
                {btcPrice > 0 && (
                  <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                    <SSText color="muted">
                      {formatFiatPrice(transaction.amount, btcPrice)}
                    </SSText>
                    <SSText size="xs" style={{ color: Colors.gray[500] }}>
                      {fiatCurrency}
                    </SSText>
                  </SSHStack>
                )}
              </SSVStack>
            </SSHStack>

            <SSHStack justifyBetween>
              <SSVStack gap="xs">
                <SSTimeAgoText
                  date={new Date(transaction.timestamp)}
                  size="sm"
                />
              </SSVStack>
              {transaction.type === 'send' && (
                <SSText
                  uppercase
                  size="sm"
                  weight="medium"
                  style={{
                    color: transaction.tokenStatus
                      ? getTokenStatusColor(transaction.tokenStatus)
                      : Colors.gray[700]
                  }}
                >
                  {transaction.tokenStatus
                    ? transaction.tokenStatus.toUpperCase()
                    : 'Unknown'}
                </SSText>
              )}
            </SSHStack>
          </SSVStack>

          {/* Check Status Button for Token Transactions */}
          {transaction.token && (
            <SSVStack gap="sm">
              <SSButton
                label={t('ecash.transactionDetail.checkStatus')}
                onPress={handleCheckTokenStatus}
                loading={isCheckingStatus}
                variant="outline"
              />
              {transaction.type === 'send' &&
                transaction.tokenStatus === 'unspent' && (
                  <SSButton
                    label={t('ecash.transactionDetail.redeemToken')}
                    onPress={handleRedeemToken}
                    loading={isRedeeming}
                    variant="gradient"
                    gradientType="special"
                  />
                )}
            </SSVStack>
          )}

          <SSVStack gap="md">
            <SSText uppercase>{t('ecash.transactionDetail.details')}</SSText>
            <SSVStack gap="sm">
              <SSHStack justifyBetween>
                <SSText color="muted">
                  {t('ecash.transactionDetail.id')}:
                </SSText>
                <SSText
                  size="sm"
                  numberOfLines={1}
                  style={{ flex: 1, textAlign: 'right' }}
                >
                  {transaction.id}
                </SSText>
              </SSHStack>
              <SSHStack justifyBetween>
                <SSText color="muted">
                  {t('ecash.transactionDetail.mint')}:
                </SSText>
                <SSText
                  size="sm"
                  numberOfLines={1}
                  style={{ flex: 1, textAlign: 'right' }}
                >
                  {mint?.name || transaction.mintUrl}
                </SSText>
              </SSHStack>
              {transaction.memo && (
                <SSHStack justifyBetween>
                  <SSText color="muted">
                    {t('ecash.transactionDetail.memo')}:
                  </SSText>
                  <SSText
                    size="sm"
                    numberOfLines={2}
                    style={{ flex: 1, textAlign: 'right' }}
                  >
                    {transaction.memo}
                  </SSText>
                </SSHStack>
              )}
              {transaction.quoteId && (
                <SSHStack justifyBetween>
                  <SSText color="muted">
                    {t('ecash.transactionDetail.quoteId')}:
                  </SSText>
                  <SSText
                    size="sm"
                    numberOfLines={1}
                    style={{ flex: 1, textAlign: 'right' }}
                  >
                    {transaction.quoteId}
                  </SSText>
                </SSHStack>
              )}
            </SSVStack>
          </SSVStack>
          {(transaction.token || transaction.invoice) && (
            <SSVStack gap="md">
              <SSText uppercase>
                {transaction.token
                  ? t('ecash.transactionDetail.token')
                  : t('ecash.transactionDetail.invoice')}
              </SSText>
              <SSVStack gap="sm">
                <SSTextInput
                  value={transaction.token || transaction.invoice || ''}
                  multiline
                  editable={false}
                  style={styles.dataInput}
                />
                <SSButton
                  label={t('common.copy')}
                  onPress={
                    transaction.token ? handleCopyToken : handleCopyInvoice
                  }
                  variant="subtle"
                />
              </SSVStack>
            </SSVStack>
          )}
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  headerCard: {},
  dataInput: {
    minHeight: 120,
    height: 'auto',
    textAlignVertical: 'top',
    fontFamily: 'monospace',
    fontSize: 12,
    padding: 12
  }
})
