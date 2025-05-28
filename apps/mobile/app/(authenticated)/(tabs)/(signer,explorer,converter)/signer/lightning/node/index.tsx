import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View
} from 'react-native'
import { type SceneRendererProps, TabView } from 'react-native-tab-view'

import {
  SSIconCollapse,
  SSIconExpand,
  SSIconLNSettings,
  SSIconRefresh
} from '@/components/icons'
import SSActionButton from '@/components/SSActionButton'
import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import { useLND } from '@/hooks/useLND'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { Colors } from '@/styles'
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
  htlcs: {
    status: string
    route: {
      hops: {
        chan_id: string
        chan_capacity: string
        amt_to_forward: string
        fee: string
        expiry: number
        amt_to_forward_msat: string
        fee_msat: string
        pub_key: string
      }[]
      total_time_lock: number
      total_amt: string
      total_amt_msat: string
      total_fees: string
      total_fees_msat: string
    }
  }[]
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
  const {
    getBalance,
    channels,
    lastError,
    isConnecting,
    isConnected,
    makeRequest
  } = useLND()

  // All hooks must be declared at the top level, in a consistent order
  const [balance, setBalance] = useState<ProcessedBalance | null>(null)
  const [transactions, setTransactions] = useState<CombinedTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(0)
  const [includeOpenInvoices, setIncludeOpenInvoices] = useState(false)
  const [tabIndex, setTabIndex] = useState(0)
  const [expand, setExpand] = useState(false)

  // Refs
  const animationValue = useRef(new Animated.Value(0)).current

  // Constants
  const tabs = [{ key: 'transactions' }, { key: 'channels' }]
  const TRANSACTIONS_PER_PAGE = 10

  // Store hooks
  const satsToFiat = usePriceStore((state) => state.satsToFiat)
  const btcPrice = usePriceStore((state) => state.btcPrice)
  const fiatCurrency = usePriceStore((state) => state.fiatCurrency)

  // Memoized values
  const gradientHeight = useMemo(
    () =>
      animationValue.interpolate({
        inputRange: [0, 1],
        outputRange: [190, 0]
      }),
    [animationValue]
  )

  // Memoized callbacks
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

  const handleOnExpand = useCallback(
    (state: boolean) => {
      setExpand(state)
      animateTransition(state)
    },
    [animateTransition]
  )

  const handleTabChange = useCallback((index: number) => {
    setTabIndex(index)
  }, [])

  const handleRefresh = useCallback(() => {
    if (isConnected) {
      setIsLoading(true)
      setBalance(null)
      setTransactions([])
      setCurrentPage(0)
      // Trigger the load effect again
      setIsLoading(false)
    }
  }, [isConnected])

  const handleLoadMore = useCallback(() => {
    setCurrentPage((prev) => prev + 1)
  }, [])

  // const handleDisconnect = useCallback(() => {
  //   clearConfig()
  //   router.back()
  // }, [clearConfig, router])

  // Memoized render functions
  const renderBalances = useCallback(() => {
    if (isLoading || !balance) {
      return (
        <SSVStack itemsCenter gap="none" style={{ paddingBottom: 8 }}>
          <SSText color="muted" size="sm">
            {isLoading ? 'Loading balances...' : 'Failed to load balances'}
          </SSText>
          {!isLoading && !balance && (
            <SSButton
              label="Retry"
              onPress={handleRefresh}
              variant="outline"
              style={{ marginTop: 8 }}
            />
          )}
        </SSVStack>
      )
    }

    const onchainBalance = Number(balance.onchain_balance) || 0
    const channelBalance = Number(balance.channel_balance) || 0
    const totalBalance = onchainBalance + channelBalance

    const totalFiat = satsToFiat(totalBalance, btcPrice)
    const onchainFiat = satsToFiat(onchainBalance, btcPrice)
    const channelFiat = satsToFiat(channelBalance, btcPrice)

    const renderFiatValue = (value: number) => (
      <SSText color="muted" size="xs">
        {formatNumber(value, 2)} {fiatCurrency}
      </SSText>
    )

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
            {btcPrice > 0 && renderFiatValue(totalFiat)}
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
            {btcPrice > 0 && renderFiatValue(channelFiat)}
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
            {btcPrice > 0 && renderFiatValue(onchainFiat)}
          </SSVStack>
        </SSHStack>
      </SSVStack>
    )
  }, [balance, isLoading, handleRefresh, satsToFiat, btcPrice, fiatCurrency])

  const renderTransactions = useCallback(() => {
    if (isLoading && transactions.length === 0) {
      return (
        <SSVStack itemsCenter gap="none" style={{ paddingVertical: 16 }}>
          <SSText color="muted" size="sm">
            Loading transactions...
          </SSText>
        </SSVStack>
      )
    }

    if (transactions.length === 0) {
      return (
        <SSVStack itemsCenter gap="none" style={{ paddingVertical: 16 }}>
          <SSText color="muted" size="sm">
            No recent transactions
          </SSText>
        </SSVStack>
      )
    }

    const start = currentPage * TRANSACTIONS_PER_PAGE
    const end = start + TRANSACTIONS_PER_PAGE
    const displayedTxs = transactions.slice(start, end)

    return (
      <SSVStack style={styles.section}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {displayedTxs.map((tx) => {
            const timestamp = new Date(tx.timestamp * 1000)
            const fiatAmount = satsToFiat(Math.abs(tx.amount), btcPrice)
            const isReceive = tx.amount > 0

            let typeLabel = ''
            let typeColor = Colors.white
            let transactionType: 'send' | 'receive' = 'send'

            if (tx.type === 'onchain') {
              typeLabel = 'On-chain'
              typeColor = Colors.white
              transactionType = isReceive ? 'receive' : 'send'
            } else if (tx.type === 'lightning_send') {
              typeLabel = 'Lightning Payment'
              typeColor = Colors.mainRed
              transactionType = 'send'
            } else if (tx.type === 'lightning_receive') {
              typeLabel = 'Lightning Invoice'
              if (tx.status === 'settled') {
                typeColor = Colors.mainGreen
                transactionType = 'receive'
              } else if (tx.status === 'open') {
                typeColor = Colors.warning
                transactionType = 'receive'
              } else {
                typeColor = Colors.white
                transactionType = 'receive'
              }
            }

            let statusText = ''
            if (tx.type === 'lightning_receive') {
              switch (tx.status) {
                case 'settled':
                  statusText = '• Settled'
                  break
                case 'canceled':
                  statusText = '• Canceled'
                  break
                case 'open':
                  statusText = '• Open'
                  break
                default:
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

            return (
              <View key={tx.id} style={styles.transactionItem}>
                <SSHStack
                  gap="xs"
                  justifyBetween
                  style={styles.transactionHeader}
                >
                  <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                    <SSStyledSatText
                      amount={Math.abs(tx.amount)}
                      decimals={0}
                      textSize="md"
                      weight="light"
                      type={transactionType}
                      noColor={false}
                    />
                    <SSText size="xs" color="muted">
                      {t('bitcoin.sats').toLowerCase()}
                    </SSText>
                  </SSHStack>
                  <SSText color="muted" size="xs">
                    {timestamp.toLocaleString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: 'numeric',
                      second: 'numeric',
                      hour12: true
                    })}
                  </SSText>
                </SSHStack>
                <SSHStack justifyBetween style={styles.transactionDetails}>
                  <SSVStack gap="xs">
                    <SSVStack gap="xs">
                      <SSText style={{ color: typeColor }} size="xs">
                        {typeLabel} {statusText}
                      </SSText>
                      {tx.description && (
                        <SSText color="muted" size="xs" numberOfLines={2}>
                          {tx.description}
                          {tx.type === 'lightning_receive' &&
                            (tx.status === 'canceled' ||
                              tx.status === 'open') &&
                            tx.originalAmount &&
                            ` (Original: ${tx.originalAmount} sats)`}
                        </SSText>
                      )}
                    </SSVStack>
                  </SSVStack>
                  <SSText color="muted" size="xs">
                    {formatNumber(fiatAmount, 2)} {fiatCurrency}
                  </SSText>
                </SSHStack>
              </View>
            )
          })}

          {transactions.length > end && (
            <SSButton
              label="Load More"
              onPress={handleLoadMore}
              variant="outline"
              style={styles.loadMoreButton}
            />
          )}
        </ScrollView>
      </SSVStack>
    )
  }, [
    transactions,
    currentPage,
    isLoading,
    handleLoadMore,
    satsToFiat,
    btcPrice,
    fiatCurrency
  ])

  const renderChannels = useCallback(() => {
    if (!channels?.length) return null

    return (
      <SSVStack style={styles.section}>
        <SSVStack style={styles.channelsList}>
          {channels.map((channel) => {
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
                    <SSText>{formatNumber(capacity)} sats</SSText>
                  </View>

                  <View style={styles.channelDetailRow}>
                    <SSText color="muted">Local Balance:</SSText>
                    <SSText>{formatNumber(local_balance)} sats</SSText>
                  </View>

                  <View style={styles.channelDetailRow}>
                    <SSText color="muted">Remote Balance:</SSText>
                    <SSText>{formatNumber(remote_balance)} sats</SSText>
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
                    <SSText>{formatNumber(total_satoshis_sent)} sats</SSText>
                  </View>

                  <View style={styles.channelDetailRow}>
                    <SSText color="muted">Total Received:</SSText>
                    <SSText>
                      {formatNumber(total_satoshis_received)} sats
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

  const renderTab = useCallback(() => {
    if (expand) return null

    const tabWidth = '50%'
    const activeChannels =
      channels?.filter((channel) => channel.active).length || 0
    const totalChannels = channels?.length || 0

    return (
      <SSHStack
        gap="none"
        style={{ paddingVertical: 4, paddingHorizontal: '5%' }}
      >
        <SSActionButton
          style={{ width: tabWidth }}
          onPress={() => handleTabChange(0)}
        >
          <SSVStack gap="none">
            <SSText center size="lg">
              {transactions.length}
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
                  bottom: -8,
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
                  bottom: -8,
                  alignSelf: 'center',
                  backgroundColor: Colors.white
                }}
              />
            )}
          </SSVStack>
        </SSActionButton>
      </SSHStack>
    )
  }, [expand, channels, tabIndex, handleTabChange, transactions.length])

  const renderScene = useCallback(
    ({ route }: SceneRendererProps & { route: { key: string } }) => {
      switch (route.key) {
        case 'transactions':
          return (
            <SSMainLayout style={[styles.section, styles.tabContent]}>
              <SSHStack justifyBetween style={{ paddingVertical: 8 }}>
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
                <SSHStack gap="sm">
                  <SSText
                    onPress={() => setIncludeOpenInvoices(!includeOpenInvoices)}
                    style={{ textDecorationLine: 'underline' }}
                    color="muted"
                  >
                    {includeOpenInvoices
                      ? 'Hide open invoices'
                      : 'Show open invoices'}
                  </SSText>
                </SSHStack>
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
              <SSHStack justifyBetween style={{ paddingVertical: 8 }}>
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
    },
    [
      expand,
      handleRefresh,
      handleOnExpand,
      renderChannels,
      renderTransactions,
      includeOpenInvoices
    ]
  )

  // Effects
  useEffect(() => {
    const loadData = async () => {
      if (!isConnected) {
        return
      }

      setIsLoading(true)

      try {
        // Load balance
        const [blockchainBalance, channelBalance] = await Promise.all([
          getBalance() as Promise<LNDBalanceResponse>,
          (makeRequest as MakeRequest)<LNDChannelBalanceResponse>(
            '/v1/balance/channels'
          )
        ])

        const totalBalance = Number(blockchainBalance?.total_balance || 0)
        const onchainBalance = Number(blockchainBalance?.confirmed_balance || 0)
        const channelBalanceValue = Number(
          channelBalance?.local_balance?.sat || 0
        )

        setBalance({
          total_balance: isNaN(totalBalance) ? 0 : totalBalance,
          channel_balance: isNaN(channelBalanceValue) ? 0 : channelBalanceValue,
          onchain_balance: isNaN(onchainBalance) ? 0 : onchainBalance
        })

        // Load transactions
        const [onchainTxs, paymentTxs, invoiceTxs] = await Promise.all([
          (makeRequest as MakeRequest)<{ transactions: LNDTransaction[] }>(
            '/v1/transactions?start_height=0&end_height=-1&num_max_transactions=100'
          ).then((res) =>
            res.transactions.map((tx) => ({
              id: tx.tx_hash,
              type: 'onchain' as const,
              amount: Number(tx.amount),
              timestamp: Number(tx.time_stamp),
              status: tx.num_confirmations > 0 ? 'confirmed' : 'pending',
              hash: tx.tx_hash,
              num_confirmations: tx.num_confirmations
            }))
          ),
          (makeRequest as MakeRequest)<{ payments: LNDPayment[] }>(
            '/v1/payments?include_incomplete=true&num_max_payments=100'
          ).then((res) =>
            res.payments.map((payment) => {
              let description = 'Lightning Payment'
              if (payment.payment_request) {
                const match = payment.payment_request.match(/[?&]d=([^&]+)/)
                if (match && match[1]) {
                  try {
                    description = decodeURIComponent(match[1])
                  } catch {
                    // Silently fail if decoding fails
                  }
                }
              }
              return {
                id: payment.payment_hash,
                type: 'lightning_send' as const,
                amount: -Number(payment.value_sat),
                timestamp: Number(payment.creation_date),
                status: payment.status,
                hash: payment.payment_hash,
                fee: Number(payment.fee_sat),
                description
              }
            })
          ),
          (makeRequest as MakeRequest)<{ invoices: LNDInvoice[] }>(
            '/v1/invoices?num_max_invoices=100&reversed=true'
          ).then((res) =>
            res.invoices
              .map((invoice) => ({
                id: invoice.r_hash,
                type: 'lightning_receive' as const,
                amount: Number(
                  invoice.state === 'SETTLED'
                    ? invoice.amt_paid_sat ||
                        invoice.payment_sat ||
                        invoice.value ||
                        0
                    : invoice.value || 0
                ),
                timestamp: Number(
                  invoice.state === 'SETTLED' && invoice.settle_date !== '0'
                    ? invoice.settle_date
                    : invoice.creation_date
                ),
                status: invoice.state.toLowerCase(),
                hash: invoice.r_hash,
                description:
                  invoice.description || invoice.memo || 'Lightning Invoice',
                originalAmount: invoice.value ? Number(invoice.value) : 0
              }))
              .filter(
                (invoice) => includeOpenInvoices || invoice.status !== 'open'
              )
          )
        ])

        // Combine and deduplicate transactions
        const allTxs = [...onchainTxs, ...paymentTxs, ...invoiceTxs]
        const uniqueTxs = Array.from(
          new Map(allTxs.map((tx) => [tx.id, tx])).values()
        ).sort((a, b) => b.timestamp - a.timestamp)

        setTransactions(uniqueTxs)
      } catch {
        setBalance(null)
        setTransactions([])
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [isConnected, getBalance, makeRequest, includeOpenInvoices])

  // Effect to refresh data when includeOpenInvoices changes
  useEffect(() => {
    if (isConnected) {
      setIsLoading(true)
      setTransactions([])
      setCurrentPage(0)
      // Trigger the load effect again
      setIsLoading(false)
    }
  }, [isConnected, includeOpenInvoices])

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
                } as never)
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
                onPress={handleRefresh}
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
    paddingHorizontal: 0,
    marginTop: -4
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
    borderTopWidth: 1,
    borderTopColor: Colors.gray[800],
    paddingVertical: 12,
    paddingHorizontal: 0
  },
  transactionHeader: {
    marginBottom: 8
  },
  transactionDetails: {
    gap: 8
  },
  loadMoreButton: {
    marginTop: 16,
    marginBottom: 8
  }
})
