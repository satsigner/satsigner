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
import SSModal from '@/components/SSModal'
import SSQRCode from '@/components/SSQRCode'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSTimeAgoText from '@/components/SSTimeAgoText'
import { useEcash, useQuotePolling } from '@/hooks/useEcash'
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
  const {
    transactions,
    mints,
    updateTransaction,
    receiveEcash,
    mintQuotes,
    checkMintQuote,
    mintProofs
  } = useEcash()
  const [currencyUnit, useZeroPadding] = useSettingsStore(
    useShallow((state) => [state.currencyUnit, state.useZeroPadding])
  )
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
  const [qrModalVisible, setQrModalVisible] = useState(false)

  // Polling hook for pending transactions
  const { startPolling, stopPolling, isPolling } = useQuotePolling()

  const transaction = transactions.find((t) => t.id === id)
  const mint = transaction
    ? mints.find((m) => m.url === transaction.mintUrl)
    : null

  // Get Lightning invoice from mint quote for pending mint transactions
  const mintQuote = transaction?.quoteId
    ? mintQuotes.find((q) => q.quote === transaction.quoteId)
    : null
  const lightningInvoice = mintQuote?.request || null

  // Fetch prices on mount and when currency changes
  useEffect(() => {
    fetchPrices(mempoolUrl)
  }, [fetchPrices, fiatCurrency, mempoolUrl])

  // Define all callbacks before any conditional logic
  const handleCopyToken = useCallback(async () => {
    if (!transaction?.token) return

    try {
      await Clipboard.setStringAsync(transaction.token)
      toast.success(t('common.copiedToClipboard'))
    } catch {
      toast.error(t('ecash.error.failedToCopy'))
    }
  }, [transaction?.token])

  const handleCopyInvoice = useCallback(async () => {
    if (!transaction?.invoice) return

    try {
      await Clipboard.setStringAsync(transaction.invoice)
      toast.success(t('common.copiedToClipboard'))
    } catch {
      toast.error(t('ecash.error.failedToCopy'))
    }
  }, [transaction?.invoice])

  const handleCopyLightningInvoice = useCallback(async () => {
    if (!lightningInvoice) return

    try {
      await Clipboard.setStringAsync(lightningInvoice)
      toast.success(t('common.copiedToClipboard'))
    } catch {
      toast.error(t('ecash.error.failedToCopy'))
    }
  }, [lightningInvoice])

  const handleCheckTokenStatus = useCallback(async () => {
    if (!transaction?.token || !transaction?.mintUrl) return

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
    } catch {
      updateTransaction(transaction.id, { tokenStatus: 'invalid' })
      toast.error(t('ecash.error.failedToCheckStatus'))
    } finally {
      setIsCheckingStatus(false)
    }
  }, [
    transaction?.token,
    transaction?.mintUrl,
    transaction?.id,
    updateTransaction
  ])

  const handleRedeemToken = useCallback(async () => {
    if (!transaction?.token || !transaction?.mintUrl) return

    setIsRedeeming(true)

    try {
      await receiveEcash(transaction.mintUrl, transaction.token)
      // Update transaction status to indicate it's been redeemed
      updateTransaction(transaction.id, { tokenStatus: 'spent' })
      // Navigate back to ecash main page
      router.back()
    } catch {
      // Error handling is done in the hook
    } finally {
      setIsRedeeming(false)
    }
  }, [
    transaction?.token,
    transaction?.mintUrl,
    transaction?.id,
    receiveEcash,
    updateTransaction,
    router
  ])

  // Start polling for pending transactions
  useEffect(() => {
    if (
      !transaction ||
      transaction.status !== 'pending' ||
      !transaction.quoteId ||
      !mint
    ) {
      return
    }

    // Start polling for payment status
    startPolling(async () => {
      try {
        const status = await checkMintQuote(mint.url, transaction.quoteId!)

        if (status === 'PAID' || status === 'ISSUED') {
          // Payment detected, mint the proofs
          await mintProofs(mint.url, transaction.amount, transaction.quoteId!)

          // Update transaction status to completed
          updateTransaction(transaction.id, { status: 'completed' })

          // Hide QR modal if it's open
          setQrModalVisible(false)

          return true // Stop polling
        } else if (status === 'EXPIRED' || status === 'CANCELLED') {
          // Payment failed or expired
          updateTransaction(transaction.id, { status: 'failed' })
          return true // Stop polling
        }

        // Continue polling for PENDING, UNPAID, and unknown statuses
        return false
      } catch {
        // Continue polling on network errors
        return false
      }
    })

    // Cleanup polling when component unmounts or transaction changes
    return () => {
      stopPolling()
    }
  }, [
    transaction,
    mint,
    startPolling,
    stopPolling,
    checkMintQuote,
    mintProofs,
    updateTransaction
  ])

  if (!transaction) {
    return (
      <SSMainLayout>
        <Stack.Screen
          options={{
            headerTitle: () => (
              <SSText uppercase>{t('ecash.transactionDetail.notFound')}</SSText>
            )
          }}
        />
        <SSVStack gap="md">
          <SSText>{t('ecash.transactionDetail.notFound')}</SSText>
          <SSButton
            label={t('common.goBack')}
            onPress={() => router.back()}
            variant="outline"
          />
        </SSVStack>
      </SSMainLayout>
    )
  }

  function getTransactionIcon(type: EcashTransaction['type']) {
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

  function getTransactionLabel(type: EcashTransaction['type']) {
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
        return Colors.error
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
                    currency={currencyUnit}
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
                    {currencyUnit === 'btc'
                      ? t('bitcoin.btc')
                      : t('bitcoin.sats')}
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
              <SSHStack gap="sm">
                {transaction.status && (
                  <SSText
                    uppercase
                    size="sm"
                    weight="medium"
                    style={{
                      color: (() => {
                        switch (transaction.status) {
                          case 'pending':
                            return Colors.warning
                          case 'completed':
                            return Colors.success
                          case 'failed':
                          case 'expired':
                            return Colors.error
                          case 'settled':
                            return Colors.softBarRed
                          default:
                            return Colors.gray[700]
                        }
                      })()
                    }}
                  >
                    {(() => {
                      switch (transaction.status) {
                        case 'pending':
                          return t('ecash.quote.pending')
                        case 'completed':
                          return t('ecash.quote.completed')
                        case 'failed':
                          return t('ecash.quote.failed')
                        case 'expired':
                          return t('ecash.quote.expired')
                        case 'settled':
                          return t('ecash.quote.settled')
                        default:
                          return String(transaction.status).toUpperCase()
                      }
                    })()}
                  </SSText>
                )}
                {transaction.type === 'send' && (
                  <SSText
                    uppercase
                    size="sm"
                    weight="medium"
                    style={{
                      color: transaction.tokenStatus
                        ? getTokenStatusColor(transaction.tokenStatus)
                        : Colors.white
                    }}
                  >
                    {transaction.tokenStatus
                      ? transaction.tokenStatus.toUpperCase()
                      : 'Unknown'}
                  </SSText>
                )}
              </SSHStack>
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

          {/* Lightning Invoice Buttons for Pending Transactions */}
          {transaction.status === 'pending' && lightningInvoice && (
            <SSVStack gap="sm">
              {isPolling && (
                <SSText color="muted" size="sm" style={{ textAlign: 'center' }}>
                  {t('ecash.receive.polling')}
                </SSText>
              )}
              <SSHStack gap="sm">
                <SSButton
                  label={t('ecash.transactionDetail.showQR')}
                  onPress={() => setQrModalVisible(true)}
                  variant="subtle"
                  style={{ flex: 1 }}
                />
                <SSButton
                  label={t('ecash.transactionDetail.copyInvoice')}
                  onPress={handleCopyLightningInvoice}
                  variant="subtle"
                  style={{ flex: 1 }}
                />
              </SSHStack>
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
              {(transaction.label || transaction.memo) && (
                <SSHStack justifyBetween>
                  <SSText color="muted">
                    {t('ecash.transactionDetail.label')}:
                  </SSText>
                  <SSText
                    size="sm"
                    numberOfLines={2}
                    style={{ flex: 1, textAlign: 'right' }}
                  >
                    {transaction.label || transaction.memo}
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
              {transaction.expiry && (
                <SSHStack justifyBetween>
                  <SSText color="muted">
                    {t('ecash.transactionDetail.expiry')}:
                  </SSText>
                  <SSText
                    size="sm"
                    numberOfLines={1}
                    style={{ flex: 1, textAlign: 'right' }}
                  >
                    {new Date(transaction.expiry * 1000).toLocaleString()}
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
      <SSModal
        visible={qrModalVisible}
        onClose={() => setQrModalVisible(false)}
        label={t('common.close')}
      >
        <SSVStack gap="md" style={{ alignItems: 'center' }}>
          <SSText size="lg" weight="medium" style={{ textAlign: 'center' }}>
            {t('ecash.transactionDetail.lightningInvoice')}
          </SSText>
          {lightningInvoice && <SSQRCode value={lightningInvoice} size={250} />}
        </SSVStack>
      </SSModal>
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
