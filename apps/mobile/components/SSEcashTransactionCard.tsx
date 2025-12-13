import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import {
  SSIconIncoming,
  SSIconIncomingLightning,
  SSIconOutgoing,
  SSIconOutgoingLightning
} from '@/components/icons'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { useEcashStore } from '@/store/ecash'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { type EcashTransaction } from '@/types/models/Ecash'
import { formatFiatPrice } from '@/utils/format'

import SSStyledSatText from './SSStyledSatText'
import SSTimeAgoText from './SSTimeAgoText'

type SSEcashTransactionCardProps = {
  transaction: EcashTransaction
}

function SSEcashTransactionCard({ transaction }: SSEcashTransactionCardProps) {
  const router = useRouter()
  const checkingTransactionIds = useEcashStore(
    (state) => state.checkingTransactionIds
  )
  const isChecking = checkingTransactionIds.includes(transaction.id)
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

  // Fetch prices on mount and when currency changes
  useEffect(() => {
    fetchPrices(mempoolUrl)
  }, [fetchPrices, fiatCurrency, mempoolUrl])

  // Calculate price display during render
  const priceDisplay = btcPrice
    ? `${formatFiatPrice(transaction.amount, btcPrice)} ${fiatCurrency}`
    : ''

  function getTransactionIcon(type: EcashTransaction['type']) {
    switch (type) {
      case 'send':
        return <SSIconOutgoing height={12} width={12} />
      case 'receive':
        return <SSIconIncoming height={12} width={12} />
      case 'mint':
        return <SSIconIncomingLightning height={12} width={12} />
      case 'melt':
        return <SSIconOutgoingLightning height={12} width={12} />
      default:
        return <SSText size="2xl">•</SSText>
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
    <TouchableOpacity
      onPress={() =>
        router.push({
          pathname: '/signer/ecash/transaction/[id]',
          params: { id: transaction.id }
        } as never)
      }
      activeOpacity={0.7}
    >
      <SSVStack style={styles.container} gap="none">
        <SSHStack justifyBetween>
          <SSText color="muted" size="xs">
            {transaction.id.slice(0, 30)}...
          </SSText>
          <SSHStack gap="xs">
            {transaction.status && (
              <SSText
                uppercase
                size="xs"
                style={{
                  color: (() => {
                    switch (transaction.status) {
                      case 'pending':
                        return Colors.warning
                      case 'completed':
                        return Colors.softBarGreen
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
              <SSHStack gap="xs" style={{ alignItems: 'center' }}>
                {isChecking && (
                  <ActivityIndicator
                    size={10}
                    color={
                      transaction.tokenStatus
                        ? getTokenStatusColor(transaction.tokenStatus)
                        : Colors.white
                    }
                  />
                )}
                <SSText
                  uppercase
                  size="xs"
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
              </SSHStack>
            )}
          </SSHStack>
        </SSHStack>

        <SSTimeAgoText date={new Date(transaction.timestamp)} size="xs" />

        <SSVStack gap="none" style={{ marginTop: 5 }}>
          <SSHStack
            style={{
              justifyContent: 'space-between',
              alignItems: 'flex-end'
            }}
          >
            <SSHStack
              gap="sm"
              style={{
                alignItems: 'center'
              }}
            >
              {getTransactionIcon(transaction.type)}
              <SSHStack
                gap="xs"
                style={{
                  alignItems: 'flex-end'
                }}
              >
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
                <SSText color="muted" size="sm" style={{ marginBottom: -2 }}>
                  {currencyUnit === 'btc'
                    ? t('bitcoin.btc')
                    : t('bitcoin.sats')}
                </SSText>
              </SSHStack>
            </SSHStack>
          </SSHStack>
          {priceDisplay !== '' && (
            <SSHStack justifyBetween>
              <SSHStack
                gap="xs"
                style={{
                  height: 14
                }}
              >
                <SSText style={{ color: Colors.gray[400] }} size="xs">
                  {priceDisplay}
                </SSText>
              </SSHStack>
            </SSHStack>
          )}
        </SSVStack>

        {transaction.label || transaction.memo ? (
          <SSHStack justifyBetween>
            <SSText
              size="xs"
              style={{
                textAlign: 'left',
                flex: 1
              }}
            >
              {transaction.label || transaction.memo}
            </SSText>
          </SSHStack>
        ) : null}
      </SSVStack>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 0,
    paddingTop: 4,
    paddingBottom: 2,
    borderTopWidth: 1,
    borderColor: Colors.gray[800]
  }
})

export default SSEcashTransactionCard
