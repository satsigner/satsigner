import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import {
  StyleSheet,
  useWindowDimensions,
  View,
  ScrollView,
  Animated,
  Easing
} from 'react-native'
import { useState, useRef, useEffect, useCallback } from 'react'
import { TabView, type SceneRendererProps } from 'react-native-tab-view'

import SSActionButton from '@/components/SSActionButton'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import { useLND } from '@/hooks/useLND'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { useLightningStore } from '@/stores/lightning'
import { Colors } from '@/styles'
import SSIconButton from '@/components/SSIconButton'
import {
  SSIconRefresh,
  SSIconCollapse,
  SSIconExpand,
  SSIconLNSettings
} from '@/components/icons'
import SSStyledSatText from '@/components/SSStyledSatText'
import { usePriceStore } from '@/store/price'
import { useShallow } from 'zustand/react/shallow'
import { t } from '@/locales'
import { formatNumber } from '@/utils/format'

interface LNDBalanceResponse {
  total_balance: string
  confirmed_balance: string
  unconfirmed_balance: string
  locked_balance: string
  reserved_balance_anchor_chan: string
  account_balance?: {
    [key: string]: {
      confirmed_balance: string
      unconfirmed_balance: string
    }
  }
}

interface LNDChannelBalanceResponse {
  balance: string
  pending_open_balance: string
  local_balance: {
    msat: string
    sat: string
  }
  remote_balance: {
    msat: string
    sat: string
  }
  unsettled_local_balance: {
    msat: string
    sat: string
  }
  unsettled_remote_balance: {
    msat: string
    sat: string
  }
  pending_open_local_balance: {
    msat: string
    sat: string
  }
  pending_open_remote_balance: {
    msat: string
    sat: string
  }
  custom_channel_data?: string
}

interface ProcessedBalance {
  total_balance: number
  channel_balance: number
  onchain_balance: number
}

interface LNDTransaction {
  tx_hash: string
  amount: string
  num_confirmations: number
  block_hash: string
  block_height: number
  time_stamp: string
  total_fees: string
  dest_addresses: string[]
  raw_tx_hex: string
  label: string
}

interface LNDPayment {
  payment_hash: string
  value: string
  creation_date: string
  fee: string
  payment_preimage: string
  value_sat: string
  value_msat: string
  payment_request: string
  status: string
  fee_sat: string
  fee_msat: string
  creation_time_ns: string
  htlcs: Array<{
    status: string
    route: {
      hops: Array<{
        chan_id: string
        chan_capacity: string
        amt_to_forward: string
        fee: string
        expiry: number
        amt_to_forward_msat: string
        fee_msat: string
        pub_key: string
      }>
      total_time_lock: number
      total_amt: string
      total_amt_msat: string
      total_fees: string
      total_fees_msat: string
    }
  }>
}

interface LNDInvoice {
  r_hash: string
  payment_request: string
  add_index: string
  payment_addr: string
  payment_sat: string
  payment_msat: string
  settled: boolean
  settle_date: string
  state: string
  value: string
  value_msat: string
  creation_date: string
  description: string
  memo?: string
  expiry: string
  cltv_expiry: string
  amt_paid_sat: string
  amt_paid_msat: string
}

interface CombinedTransaction {
  id: string
  type: 'onchain' | 'lightning_send' | 'lightning_receive'
  amount: number
  timestamp: number
  status: string
  hash: string
  description?: string
  num_confirmations?: number
  fee?: number
  originalAmount?: number
}

// Add type for makeRequest
type MakeRequest = <T>(path: string) => Promise<T>

export default function NodeDetailPage() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const params = useLocalSearchParams<{ alias: string; pubkey: string }>()
  const { config, clearConfig } = useLightningStore()
  const {
    getInfo,
    getBalance,
    getChannels,
    channels,
    lastError,
    isConnecting,
    isConnected,
    makeRequest
  } = useLND()

  const [balance, setBalance] = useState<ProcessedBalance | null>(null)
  const [btcPrice, fiatCurrency, fetchPrices] = usePriceStore(
    useShallow((state) => [
      state.btcPrice,
      state.fiatCurrency,
      state.fetchPrices
    ])
  )

  const [tabIndex, setTabIndex] = useState(0)
  const [expand, setExpand] = useState(false)
  const animationValue = useRef(new Animated.Value(0)).current
  const gradientHeight = animationValue.interpolate({
    inputRange: [0, 1],
    outputRange: [190, 0]
  })

  const tabs = [{ key: 'transactions' }, { key: 'channels' }]

  const satsToFiat = usePriceStore((state) => state.satsToFiat)

  const [transactions, setTransactions] = useState<CombinedTransaction[]>([])
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMoreTransactions, setHasMoreTransactions] = useState(true)
  const [lastTimestamp, setLastTimestamp] = useState<string | null>(null)

  const formatNumberWithLocale = (value: number | undefined | null): string => {
    if (value === undefined || value === null) return '0'
    return value.toLocaleString()
  }

  // Fetch prices on mount and when currency changes
  useEffect(() => {
    fetchPrices()
  }, [fetchPrices, fiatCurrency])

  // Memoize the fetch functions to prevent unnecessary re-renders
  const fetchBalance = useCallback(async () => {
    if (!isConnected) return
    try {
      const [blockchainBalance, channelBalance] = await Promise.all([
        getBalance() as Promise<LNDBalanceResponse>,
        (makeRequest as MakeRequest)<LNDChannelBalanceResponse>(
          '/v1/balance/channels'
        )
      ])

      // Parse all balances
      const totalBalance = Number(blockchainBalance?.total_balance || 0)
      const onchainBalance = Number(blockchainBalance?.confirmed_balance || 0)
      const channelBalanceValue = Number(
        channelBalance?.local_balance?.sat || 0
      )

      // Store all balances
      const processedBalance: ProcessedBalance = {
        total_balance: isNaN(totalBalance) ? 0 : totalBalance,
        channel_balance: isNaN(channelBalanceValue) ? 0 : channelBalanceValue,
        onchain_balance: isNaN(onchainBalance) ? 0 : onchainBalance
      }

      setBalance(processedBalance)
    } catch (_error) {
      // Error is handled by the hook
    }
  }, [getBalance, makeRequest, isConnected])

  const fetchLightningInvoices = useCallback(async () => {
    if (!isConnected) {
      return []
    }
    try {
      const response = await (makeRequest as MakeRequest)<{
        invoices: LNDInvoice[]
      }>('/v1/invoices?num_max_invoices=100')

      if (!response?.invoices) {
        return []
      }

      if (!Array.isArray(response.invoices)) {
        return []
      }

      if (response.invoices.length === 0) {
        return []
      }

      const mappedInvoices = response.invoices.map((invoice: LNDInvoice) => {
        // For settled invoices, use amt_paid_sat if available, otherwise fallback to value
        const amount = Number(
          invoice.state === 'SETTLED'
            ? invoice.amt_paid_sat || invoice.payment_sat || invoice.value || 0
            : invoice.value || 0
        )

        // Use settle_date for settled invoices, otherwise use creation_date
        const timestamp = Number(
          invoice.state === 'SETTLED' && invoice.settle_date !== '0'
            ? invoice.settle_date
            : invoice.creation_date
        )

        // Map invoice state to our status
        const status = invoice.state.toLowerCase()

        // Use description, memo, or fallback
        const description =
          invoice.description || invoice.memo || 'Lightning Invoice'

        return {
          id: invoice.r_hash,
          type: 'lightning_receive' as const,
          amount: amount, // Show amount for all states
          timestamp,
          status,
          hash: invoice.r_hash,
          description,
          originalAmount: invoice.value ? Number(invoice.value) : 0
        }
      })

      const sortedInvoices = mappedInvoices.sort(
        (a: CombinedTransaction, b: CombinedTransaction) =>
          b.timestamp - a.timestamp
      )

      return sortedInvoices
    } catch (error) {
      console.error('Error fetching invoices:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      return []
    }
  }, [makeRequest, isConnected])

  const fetchLightningPayments = useCallback(async () => {
    if (!isConnected) return []
    try {
      const response = await (makeRequest as MakeRequest)<{
        payments: LNDPayment[]
      }>('/v1/payments')
      if (!response.payments || !Array.isArray(response.payments)) return []

      return response.payments.map((payment: LNDPayment) => ({
        id: payment.payment_hash,
        type: 'lightning_send' as const,
        amount: -Number(payment.value_sat), // Negative because it's a payment
        timestamp: Number(payment.creation_date),
        status: payment.status,
        hash: payment.payment_hash,
        fee: Number(payment.fee_sat)
      }))
    } catch (_error) {
      return []
    }
  }, [makeRequest, isConnected])

  const fetchTransactions = useCallback(
    async (loadMore = false) => {
      if (!isConnected) return
      try {
        setIsLoadingMore(true)
        const [onchainResponse, lightningPayments, lightningInvoices] =
          await Promise.all([
            (makeRequest as MakeRequest)<{ transactions: LNDTransaction[] }>(
              '/v1/transactions'
            ),
            fetchLightningPayments(),
            fetchLightningInvoices()
          ])

        if (
          !onchainResponse.transactions ||
          !Array.isArray(onchainResponse.transactions)
        ) {
          setTransactions([])
          setHasMoreTransactions(false)
          return
        }

        // Convert onchain transactions to our combined format
        const onchainTxs = onchainResponse.transactions.map(
          (tx: LNDTransaction) => ({
            id: tx.tx_hash,
            type: 'onchain' as const,
            amount: Number(tx.amount),
            timestamp: Number(tx.time_stamp),
            status: tx.num_confirmations > 0 ? 'confirmed' : 'pending',
            hash: tx.tx_hash,
            num_confirmations: tx.num_confirmations
          })
        )

        // Combine all transactions and sort by timestamp
        const allTxs = [
          ...onchainTxs,
          ...lightningPayments,
          ...lightningInvoices
        ].sort((a, b) => b.timestamp - a.timestamp)

        // If loading more, append to existing transactions
        if (loadMore && transactions.length > 0) {
          // Filter out transactions we already have
          const newTxs = allTxs.filter(
            (tx) => !transactions.some((existingTx) => existingTx.id === tx.id)
          )
          setTransactions((prev) => [...prev, ...newTxs.slice(0, 10)])
          setLastTimestamp(
            allTxs[allTxs.length - 1]?.timestamp.toString() || null
          )
        } else {
          // Initial load, take first 20 transactions
          setTransactions(allTxs.slice(0, 20))
          setLastTimestamp(allTxs[19]?.timestamp.toString() || null)
        }

        // Check if we have more transactions to load
        setHasMoreTransactions(
          allTxs.length > (loadMore ? transactions.length + 10 : 20)
        )
      } catch (error) {
        console.error('Error in fetchTransactions:', error)
      } finally {
        setIsLoadingMore(false)
      }
    },
    [
      makeRequest,
      isConnected,
      transactions,
      fetchLightningPayments,
      fetchLightningInvoices
    ]
  )

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMoreTransactions) {
      fetchTransactions(true)
    }
  }, [fetchTransactions, isLoadingMore, hasMoreTransactions])

  const fetchData = useCallback(async () => {
    if (!isConnected) return
    try {
      await Promise.all([
        getInfo(),
        fetchBalance(),
        getChannels(),
        fetchTransactions()
      ])
    } catch (_error) {
      // Error is handled by the hook
    }
  }, [getInfo, fetchBalance, getChannels, fetchTransactions, isConnected])

  // Initial data fetch
  useEffect(() => {
    const loadData = async () => {
      if (isConnected) {
        await fetchBalance()
      }
    }
    loadData()
  }, [isConnected, fetchBalance])

  // Memoize animation function
  const animateTransition = useCallback(
    (expandState: boolean) => {
      Animated.timing(animationValue, {
        toValue: expandState ? 1 : 0,
        duration: 300,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false
      }).start()
    },
    [animationValue]
  )

  // Memoize expand handler
  const handleOnExpand = useCallback(
    (state: boolean) => {
      setExpand(state)
      animateTransition(state)
    },
    [animateTransition]
  )

  // Memoize refresh handler
  const handleRefresh = useCallback(async () => {
    await fetchData()
  }, [fetchData])

  // Memoize disconnect handler
  const handleDisconnect = useCallback(() => {
    clearConfig()
    router.back()
  }, [clearConfig, router])

  // Memoize tab change handler
  const handleTabChange = useCallback((index: number) => {
    setTabIndex(index)
  }, [])

  // Memoize render functions
  const renderBalances = useCallback(() => {
    if (!balance) {
      return (
        <SSVStack itemsCenter gap="none" style={{ paddingBottom: 8 }}>
          <SSText color="muted" size="sm">
            Loading balances...
          </SSText>
        </SSVStack>
      )
    }

    // Calculate balances
    const onchainBalance = Number(balance.onchain_balance) || 0
    const channelBalance = Number(balance.channel_balance) || 0
    const totalBalance = onchainBalance + channelBalance

    // Get fiat values
    const totalFiat = satsToFiat(totalBalance, btcPrice)
    const onchainFiat = satsToFiat(onchainBalance, btcPrice)
    const channelFiat = satsToFiat(channelBalance, btcPrice)

    return (
      <SSVStack itemsCenter gap="none" style={{ paddingBottom: 8 }}>
        <SSHStack gap="md" style={{ marginTop: 5 }}>
          <SSVStack itemsCenter gap="none" style={{ flex: 0.2 }}>
            <SSText color="muted" size="xs">
              Total
            </SSText>
            <SSStyledSatText
              amount={totalBalance}
              decimals={0}
              textSize="md"
              weight="light"
            />
            <SSText color="muted" size="xs">
              {formatNumber(totalFiat, 2)} {fiatCurrency}
            </SSText>
          </SSVStack>

          <SSVStack itemsCenter gap="none" style={{ flex: 0.6 }}>
            <SSText color="muted" size="xs">
              Lightning
            </SSText>
            <SSStyledSatText
              amount={channelBalance}
              decimals={0}
              textSize="5xl"
              weight="light"
            />
            <SSText color="muted" size="xs">
              {formatNumber(channelFiat, 2)} {fiatCurrency}
            </SSText>
          </SSVStack>

          <SSVStack itemsCenter gap="none" style={{ flex: 0.2 }}>
            <SSText color="muted" size="xs">
              Onchain
            </SSText>
            <SSStyledSatText
              amount={onchainBalance}
              decimals={0}
              textSize="md"
              weight="light"
            />
            <SSText color="muted" size="xs">
              {formatNumber(onchainFiat, 2)} {fiatCurrency}
            </SSText>
          </SSVStack>
        </SSHStack>
      </SSVStack>
    )
  }, [balance, fiatCurrency, satsToFiat, btcPrice])

  const renderChannels = useCallback(() => {
    if (!channels?.length) return null

    return (
      <SSVStack style={styles.section}>
        <SSVStack style={styles.channelsList}>
          {channels.map((channel) => {
            // Early return if channel is invalid
            if (!channel || typeof channel !== 'object') return null

            const {
              capacity = 0,
              local_balance = 0,
              remote_balance = 0,
              remote_pubkey = 'Unknown',
              chan_id = 'Unknown',
              chan_status_flags = 'Unknown',
              uptime = 0,
              total_satoshis_sent = 0,
              total_satoshis_received = 0,
              active = false
            } = channel

            return (
              <View key={chan_id} style={styles.channelItem}>
                <View style={styles.channelHeader}>
                  <SSText
                    weight="bold"
                    numberOfLines={1}
                    style={styles.channelAlias}
                  >
                    {remote_pubkey.slice(0, 16)}...
                  </SSText>
                  <SSText color={active ? 'white' : 'muted'} size="sm">
                    {active ? 'Active' : 'Inactive'}
                  </SSText>
                </View>

                <View style={styles.channelDetails}>
                  <View style={styles.channelDetailRow}>
                    <SSText color="muted">Capacity:</SSText>
                    <SSText>{formatNumberWithLocale(capacity)} sats</SSText>
                  </View>

                  <View style={styles.channelDetailRow}>
                    <SSText color="muted">Local Balance:</SSText>
                    <SSText>
                      {formatNumberWithLocale(local_balance)} sats
                    </SSText>
                  </View>

                  <View style={styles.channelDetailRow}>
                    <SSText color="muted">Remote Balance:</SSText>
                    <SSText>
                      {formatNumberWithLocale(remote_balance)} sats
                    </SSText>
                  </View>

                  <View style={styles.channelDetailRow}>
                    <SSText color="muted">Remote Pubkey:</SSText>
                    <SSText
                      numberOfLines={1}
                      ellipsizeMode="middle"
                      style={styles.pubkey}
                    >
                      {remote_pubkey}
                    </SSText>
                  </View>

                  <View style={styles.channelDetailRow}>
                    <SSText color="muted">Channel ID:</SSText>
                    <SSText
                      numberOfLines={1}
                      ellipsizeMode="middle"
                      style={styles.channelId}
                    >
                      {chan_id}
                    </SSText>
                  </View>

                  <View style={styles.channelDetailRow}>
                    <SSText color="muted">Status:</SSText>
                    <SSText>{chan_status_flags}</SSText>
                  </View>

                  <View style={styles.channelDetailRow}>
                    <SSText color="muted">Uptime:</SSText>
                    <SSText>{Math.floor(uptime / 3600)} hours</SSText>
                  </View>

                  <View style={styles.channelDetailRow}>
                    <SSText color="muted">Total Sent:</SSText>
                    <SSText>
                      {formatNumberWithLocale(total_satoshis_sent)} sats
                    </SSText>
                  </View>

                  <View style={styles.channelDetailRow}>
                    <SSText color="muted">Total Received:</SSText>
                    <SSText>
                      {formatNumberWithLocale(total_satoshis_received)} sats
                    </SSText>
                  </View>
                </View>
              </View>
            )
          })}
        </SSVStack>
      </SSVStack>
    )
  }, [channels])

  const renderTransactions = useCallback(() => {
    if (!transactions.length) {
      return (
        <SSVStack itemsCenter gap="none" style={{ paddingVertical: 16 }}>
          <SSText color="muted" size="sm">
            No recent transactions
          </SSText>
        </SSVStack>
      )
    }

    return (
      <SSVStack style={styles.section}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {transactions.map((tx) => {
            const timestamp = new Date(tx.timestamp * 1000)
            const fiatAmount = satsToFiat(Math.abs(tx.amount), btcPrice)
            const isReceive = tx.amount > 0
            const typeLabel =
              tx.type === 'onchain'
                ? 'On-chain'
                : tx.type === 'lightning_send'
                  ? 'Lightning Payment'
                  : 'Lightning Invoice'

            // Determine status color and text
            let statusColor: 'muted' | 'white' = 'muted'
            let statusText = ''

            if (tx.type === 'lightning_receive') {
              switch (tx.status) {
                case 'settled':
                  statusColor = 'white'
                  statusText = '• Settled'
                  break
                case 'canceled':
                  statusColor = 'muted'
                  statusText = '• Canceled'
                  break
                case 'open':
                  statusColor = 'muted'
                  statusText = '• Open'
                  break
                default:
                  statusColor = 'muted'
                  statusText = `• ${tx.status}`
              }
            } else if (tx.type === 'onchain') {
              statusText =
                tx.status === 'confirmed' ? '• Confirmed' : '• Pending'
              if (tx.num_confirmations) {
                statusText += ` • ${tx.num_confirmations} confirmations`
              }
            } else if (tx.type === 'lightning_send') {
              statusText = tx.status === 'SUCCEEDED' ? '• Sent' : '• Failed'
              if (tx.fee) {
                statusText += ` • Fee: ${tx.fee} sats`
              }
            }

            // For canceled/pending invoices, show the original amount in the description
            const showOriginalAmount =
              tx.type === 'lightning_receive' &&
              (tx.status === 'canceled' || tx.status === 'open') &&
              tx.description !== 'Lightning Invoice'

            return (
              <View key={tx.id} style={styles.transactionItem}>
                <SSHStack justifyBetween style={styles.transactionHeader}>
                  <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                    <SSStyledSatText
                      amount={Math.abs(tx.amount)}
                      decimals={0}
                      textSize="md"
                      weight="light"
                      type={isReceive ? 'receive' : 'send'}
                    />
                    <SSText size="xs" color="muted">
                      {t('bitcoin.sats').toLowerCase()}
                    </SSText>
                  </SSHStack>
                  {(tx.amount > 0 || showOriginalAmount) && (
                    <SSText color="muted" size="xs">
                      {formatNumber(fiatAmount, 2)} {fiatCurrency}
                    </SSText>
                  )}
                </SSHStack>
                <SSHStack justifyBetween style={styles.transactionDetails}>
                  <SSVStack gap="xs">
                    <SSText color="muted" size="xs">
                      {timestamp.toLocaleDateString()}{' '}
                      {timestamp.toLocaleTimeString()}
                    </SSText>
                    <SSVStack gap="xs">
                      <SSText color={statusColor} size="xs">
                        {typeLabel} {statusText}
                      </SSText>
                      {tx.description && (
                        <SSText color="muted" size="xs" numberOfLines={2}>
                          {tx.description}
                          {showOriginalAmount &&
                            tx.originalAmount &&
                            ` (Original: ${tx.originalAmount} sats)`}
                        </SSText>
                      )}
                    </SSVStack>
                  </SSVStack>
                </SSHStack>
              </View>
            )
          })}

          {hasMoreTransactions && (
            <SSButton
              label={isLoadingMore ? 'Loading...' : 'Load More'}
              onPress={handleLoadMore}
              variant="outline"
              style={styles.loadMoreButton}
              disabled={isLoadingMore}
            />
          )}
        </ScrollView>
      </SSVStack>
    )
  }, [
    transactions,
    btcPrice,
    fiatCurrency,
    satsToFiat,
    hasMoreTransactions,
    isLoadingMore,
    handleLoadMore
  ])

  const renderTab = useCallback(() => {
    if (expand) return null

    const tabWidth = '50%'
    const activeChannels =
      channels?.filter((channel) => channel.active).length || 0
    const totalChannels = channels?.length || 0

    return (
      <SSHStack
        gap="none"
        style={{ paddingVertical: 8, paddingHorizontal: '5%' }}
      >
        <SSActionButton
          style={{ width: tabWidth }}
          onPress={() => handleTabChange(0)}
        >
          <SSVStack gap="none">
            <SSText center size="lg">
              0
            </SSText>
            <SSText center color="muted" style={{ lineHeight: 12 }}>
              Transactions
            </SSText>
            {tabIndex === 0 && (
              <View
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: 2,
                  bottom: -12,
                  alignSelf: 'center',
                  backgroundColor: Colors.white
                }}
              />
            )}
          </SSVStack>
        </SSActionButton>
        <SSActionButton
          style={{ width: tabWidth }}
          onPress={() => handleTabChange(1)}
        >
          <SSVStack gap="none">
            <SSText center size="lg">
              {activeChannels}/{totalChannels}
            </SSText>
            <SSText center color="muted" style={{ lineHeight: 12 }}>
              Channels
            </SSText>
            {tabIndex === 1 && (
              <View
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: 2,
                  bottom: -12,
                  alignSelf: 'center',
                  backgroundColor: Colors.white
                }}
              />
            )}
          </SSVStack>
        </SSActionButton>
      </SSHStack>
    )
  }, [expand, channels, tabIndex, handleTabChange])

  const renderScene = useCallback(
    ({ route }: SceneRendererProps & { route: { key: string } }) => {
      const renderContent = () => {
        switch (route.key) {
          case 'transactions':
            return (
              <SSMainLayout style={[styles.section, styles.tabContent]}>
                <SSHStack justifyBetween style={{ paddingVertical: 16 }}>
                  <SSHStack>
                    <SSIconButton onPress={handleRefresh}>
                      <SSIconRefresh height={18} width={22} />
                    </SSIconButton>
                    <SSIconButton onPress={() => handleOnExpand(!expand)}>
                      {expand ? (
                        <SSIconCollapse height={15} width={15} />
                      ) : (
                        <SSIconExpand height={15} width={16} />
                      )}
                    </SSIconButton>
                  </SSHStack>
                  <SSText color="muted">Transaction History</SSText>
                </SSHStack>
                <ScrollView
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  {renderTransactions()}
                </ScrollView>
              </SSMainLayout>
            )
          case 'channels':
            return (
              <SSMainLayout style={[styles.section, styles.tabContent]}>
                <SSHStack justifyBetween style={{ paddingVertical: 16 }}>
                  <SSHStack>
                    <SSIconButton onPress={handleRefresh}>
                      <SSIconRefresh height={18} width={22} />
                    </SSIconButton>
                    <SSIconButton onPress={() => handleOnExpand(!expand)}>
                      {expand ? (
                        <SSIconCollapse height={15} width={15} />
                      ) : (
                        <SSIconExpand height={15} width={16} />
                      )}
                    </SSIconButton>
                  </SSHStack>
                  <SSText color="muted">Channels</SSText>
                </SSHStack>
                <ScrollView
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  {renderChannels()}
                </ScrollView>
              </SSMainLayout>
            )
          default:
            return null
        }
      }

      return renderContent()
    },
    [expand, handleRefresh, handleOnExpand, renderChannels, renderTransactions]
  )

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase style={{ letterSpacing: 1 }}>
              {params.alias}
            </SSText>
          ),
          headerRight: () => (
            <SSIconButton
              onPress={() =>
                router.push({
                  pathname: '/signer/lightning/node/settings',
                  params: { alias: params.alias }
                })
              }
            >
              <SSIconLNSettings height={20} width={20} />
            </SSIconButton>
          )
        }}
      />
      <SSMainLayout style={styles.mainLayout}>
        <Animated.View style={{ height: gradientHeight }}>
          {renderBalances()}
          {!balance && (
            <SSVStack style={styles.actions}>
              <SSButton
                label="Refresh"
                onPress={fetchBalance}
                variant="gradient"
                gradientType="special"
                loading={isConnecting}
                style={styles.button}
              />
            </SSVStack>
          )}
          {balance && (
            <SSHStack gap="sm" style={styles.actions}>
              <SSButton
                label="Invoice"
                onPress={() => router.push('/signer/lightning/invoice')}
                variant="gradient"
                gradientType="special"
                style={[styles.button, { flex: 1 }]}
              />
              <SSButton
                label="Pay"
                onPress={() => router.push('/signer/lightning/pay')}
                variant="gradient"
                gradientType="special"
                style={[styles.button, { flex: 1 }]}
              />
            </SSHStack>
          )}

          {lastError && (
            <SSText color="muted" style={styles.error}>
              {lastError}
            </SSText>
          )}
        </Animated.View>

        <TabView
          swipeEnabled={false}
          navigationState={{ index: tabIndex, routes: tabs }}
          renderScene={renderScene}
          renderTabBar={renderTab}
          onIndexChange={handleTabChange}
          initialLayout={{ width }}
        />
      </SSMainLayout>
    </>
  )
}

const styles = StyleSheet.create({
  mainLayout: {
    flex: 1,
    paddingTop: 10
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 0
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    gap: 10,
    paddingBottom: 32
  },
  section: {
    flex: 1,
    gap: 16
  },
  sectionTitle: {
    marginBottom: 1
  },
  infoGrid: {
    gap: 12
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  pubkey: {
    maxWidth: '70%',
    fontFamily: 'monospace'
  },
  hash: {
    maxWidth: '70%',
    fontFamily: 'monospace'
  },
  actions: {
    gap: 8,
    marginTop: 16
  },
  button: {
    minHeight: 40
  },
  error: {
    textAlign: 'center',
    marginTop: 16
  },
  channelsList: {
    gap: 16
  },
  channelItem: {
    backgroundColor: '#242424',
    borderRadius: 2,
    padding: 12,
    gap: 12
  },
  channelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  channelAlias: {
    flex: 1,
    marginRight: 8
  },
  channelDetails: {
    gap: 8
  },
  channelDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  channelId: {
    maxWidth: '70%',
    fontFamily: 'monospace',
    fontSize: 12
  },
  placeholderText: {
    textAlign: 'center',
    padding: 24
  },
  transactionItem: {
    backgroundColor: '#242424',
    borderRadius: 2,
    padding: 12,
    marginBottom: 8
  },
  transactionHeader: {
    marginBottom: 8
  },
  transactionDetails: {
    borderTopWidth: 1,
    borderTopColor: Colors.gray[800],
    paddingTop: 8
  },
  loadMoreButton: {
    marginTop: 16,
    marginBottom: 8
  }
})
