import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View
} from 'react-native'
import { type SceneRendererProps, TabView } from 'react-native-tab-view'
import { useShallow } from 'zustand/react/shallow'

import {
  SSIconBubbles,
  SSIconChevronRight,
  SSIconCollapse,
  SSIconExpand,
  SSIconLightning,
  SSIconList,
  SSIconRefresh
} from '@/components/icons'
import SSActionButton from '@/components/SSActionButton'
import SSButton from '@/components/SSButton'
import SSButtonActionsGroup from '@/components/SSButtonActionsGroup'
import SSCameraModal from '@/components/SSCameraModal'
import SSIconButton from '@/components/SSIconButton'
import SSLightningChannelLiquidityBar from '@/components/SSLightningChannelLiquidityBar'
import SSLightningChannelsBubbleChart from '@/components/SSLightningChannelsBubbleChart'
import SSLoader from '@/components/SSLoader'
import SSNFCModal from '@/components/SSNFCModal'
import SSPaste from '@/components/SSPaste'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import {
  LIGHTNING_BUBBLE_CHART_BLEED_MARGIN_FRAC,
  LIGHTNING_BUBBLE_CHART_LAYOUT_MAX_SIZE_PX,
  LIGHTNING_BUBBLE_CHART_LAYOUT_MIN_SIZE_PX
} from '@/constants/lightningChannelsBubbleChart'
import { useContentHandler } from '@/hooks/useContentHandler'
import { useLightningContentHandler } from '@/hooks/useLightningContentHandler'
import { useLND } from '@/hooks/useLND'
import { useLndNodeDashboard } from '@/hooks/useLndNodeDashboard'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors, Sizes } from '@/styles'
import { type LndCombinedTransaction } from '@/types/lndNodeDashboard'
import { formatNumber, formatShortPubkey } from '@/utils/format'
import { type LightningBubbleChannelRow } from '@/utils/lightningChannelsBubbleLayout'
import { lightningChannelHref } from '@/utils/lightningNavigation'
import {
  getLndChannelPeerAlias,
  getLndChannelRemotePubkey,
  liquidityBarSegmentFlexParts,
  readLndChannelSatsField,
  readLndChannelStringField
} from '@/utils/lndChannelDetail'
import {
  formatLightningTxTimeAgo,
  getTxDisplayInfo,
  getTxLightningSendFeeSatString
} from '@/utils/lndTransactionDisplay'

const PRIVACY_MASK = '••••'

const DASHBOARD_OVERLAY_LOADER_SIZE = 48

type ChannelsViewMode = 'bubbles' | 'list'
const TRANSACTIONS_PER_PAGE = 30

export default function NodeDetailPage() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const params = useLocalSearchParams<{ alias: string; pubkey: string }>()
  const { channels, isConnecting, isConnected } = useLND()
  const privacyMode = useSettingsStore((state) => state.privacyMode)

  const lightningContentHandler = useLightningContentHandler()

  const contentHandler = useContentHandler({
    context: 'lightning',
    onContentScanned: lightningContentHandler.handleContentScanned,
    onReceive: lightningContentHandler.handleReceive,
    onSend: lightningContentHandler.handleSend
  })

  const [currentPage, setCurrentPage] = useState(0)
  const [onchainListPage, setOnchainListPage] = useState(0)
  const [includeOpenInvoices, setIncludeOpenInvoices] = useState(false)
  const [tabIndex, setTabIndex] = useState(0)
  const [expand, setExpand] = useState(false)
  const [channelsViewMode, setChannelsViewMode] =
    useState<ChannelsViewMode>('list')

  const {
    data: dashboard,
    error: dashboardError,
    isError: isDashboardError,
    isFetching: isDashboardFetching,
    isPending: isDashboardPending,
    refetch: refetchDashboard
  } = useLndNodeDashboard(includeOpenInvoices)

  const animationValue = useRef(new Animated.Value(0)).current

  const tabs = [
    { key: 'transactions' },
    { key: 'channels' },
    { key: 'onchain' }
  ]

  const [satsToFiat, btcPrice, fiatCurrency] = usePriceStore(
    useShallow((state) => [
      state.satsToFiat,
      state.btcPrice,
      state.fiatCurrency
    ])
  )

  const balance = dashboard?.balance ?? null
  const transactions = dashboard?.transactions ?? []

  const animateTransition = (expandState: boolean) => {
    Animated.timing(animationValue, {
      duration: 300,
      easing: Easing.inOut(Easing.ease),
      toValue: expandState ? 1 : 0,
      useNativeDriver: false
    }).start()
  }

  const handleOnExpand = (state: boolean) => {
    setExpand(state)
    animateTransition(state)
  }

  const handleTabChange = (index: number) => {
    setTabIndex(index)
  }

  const runRefresh = () => {
    setCurrentPage(0)
    setOnchainListPage(0)
    void refetchDashboard()
  }

  const handleLoadMore = () => {
    setCurrentPage((prev) => prev + 1)
  }

  const handleLoadMoreOnchain = () => {
    setOnchainListPage((prev) => prev + 1)
  }

  const showBalanceSkeleton =
    isConnected && isDashboardPending && balance === null
  const showBalanceError =
    isConnected && isDashboardError && balance === null && !isDashboardFetching
  const showHeroBalances = Boolean(balance)
  const reserveHeroMinHeight =
    isConnected && (showBalanceSkeleton || showBalanceError || showHeroBalances)

  function renderBalances() {
    if (!isConnected) {
      return (
        <SSVStack itemsCenter gap="none" style={{ paddingBottom: 8 }}>
          <SSText color="muted" size="sm">
            {t('lightning.node.notConnected')}
          </SSText>
        </SSVStack>
      )
    }

    if (showBalanceSkeleton) {
      return (
        <SSVStack itemsCenter gap="none" style={{ paddingBottom: 8 }}>
          <SSText color="muted" size="sm">
            {t('lightning.node.balancesLoading')}
          </SSText>
        </SSVStack>
      )
    }

    if (showBalanceError) {
      return (
        <SSVStack itemsCenter gap="xs" style={{ paddingBottom: 8 }}>
          <SSText color="muted" size="sm" center>
            {t('lightning.node.balancesFailed')}
          </SSText>
          {dashboardError instanceof Error && dashboardError.message ? (
            <SSText color="muted" size="xs" center>
              {dashboardError.message}
            </SSText>
          ) : null}
        </SSVStack>
      )
    }

    if (!balance) {
      return null
    }

    const onchainBalance = Number(balance.onchain_balance) || 0
    const channelBalance = Number(balance.channel_balance) || 0
    const totalBalance = onchainBalance + channelBalance

    const totalFiat = satsToFiat(totalBalance, btcPrice)
    const onchainFiat = satsToFiat(onchainBalance, btcPrice)
    const channelFiat = satsToFiat(channelBalance, btcPrice)

    const channelList = channels ?? []
    const nodeTotalCapacity = channelList.reduce((sum, channel) => {
      if (!channel || typeof channel !== 'object') {
        return sum
      }
      return sum + readLndChannelSatsField(channel, ['capacity'])
    }, 0)
    const totalLocalSats = channelList.reduce((sum, channel) => {
      if (!channel || typeof channel !== 'object') {
        return sum
      }
      return (
        sum +
        readLndChannelSatsField(channel, ['local_balance', 'localBalance'])
      )
    }, 0)
    const totalRemoteSats = channelList.reduce((sum, channel) => {
      if (!channel || typeof channel !== 'object') {
        return sum
      }
      return (
        sum +
        readLndChannelSatsField(channel, ['remote_balance', 'remoteBalance'])
      )
    }, 0)
    const nodeTotalCap = Math.max(0, nodeTotalCapacity)
    const loc =
      nodeTotalCap > 0 ? Math.max(0, Math.min(totalLocalSats, nodeTotalCap)) : 0
    const rem =
      nodeTotalCap > 0
        ? Math.max(0, Math.min(totalRemoteSats, nodeTotalCap - loc))
        : 0
    const {
      black: heroBarFlexBlack,
      local: heroBarFlexLocal,
      remote: heroBarFlexRemote
    } = liquidityBarSegmentFlexParts(nodeTotalCap, loc, rem)
    const fmtNodeLiquidity = (n: number) =>
      privacyMode ? PRIVACY_MASK : formatNumber(n)

    function renderFiatValue(value: number, darkerFiat?: boolean) {
      const fiatStyle = darkerFiat ? styles.heroFiatDeeper : undefined
      if (privacyMode) {
        return (
          <SSText color="muted" size="xs" style={fiatStyle}>
            {PRIVACY_MASK}
          </SSText>
        )
      }
      return (
        <SSText color="muted" size="xs" style={fiatStyle}>
          {formatNumber(value, 2)} {fiatCurrency}
        </SSText>
      )
    }

    return (
      <SSVStack gap="none" widthFull style={{ paddingBottom: 8 }}>
        <SSHStack gap="md" style={styles.heroBalanceColumns}>
          <SSVStack itemsCenter gap="none" style={styles.heroSideColumn}>
            <SSText color="muted" center size="xs">
              {t('lightning.node.totalColumn')}
            </SSText>
            {privacyMode ? (
              <SSText color="white" size="md" weight="light">
                {PRIVACY_MASK}
              </SSText>
            ) : (
              <SSStyledSatText
                amount={totalBalance}
                decimals={0}
                textSize="md"
                weight="light"
              />
            )}
            {btcPrice > 0 && renderFiatValue(totalFiat, true)}
          </SSVStack>

          <SSVStack itemsCenter gap="none" style={{ flex: 0.6 }}>
            <SSText color="muted" center size="xs">
              {t('lightning.node.spendableLightning')}
            </SSText>
            {privacyMode ? (
              <SSText
                color="white"
                size="5xl"
                weight="light"
                style={{
                  letterSpacing: -1,
                  lineHeight: Sizes.text.fontSize['5xl']
                }}
              >
                {PRIVACY_MASK}
              </SSText>
            ) : (
              <SSStyledSatText
                amount={channelBalance}
                decimals={0}
                textSize="5xl"
                weight="light"
              />
            )}
            {btcPrice > 0 && renderFiatValue(channelFiat)}
          </SSVStack>

          <SSVStack itemsCenter gap="none" style={styles.heroSideColumn}>
            <SSText color="muted" center size="xs">
              {t('lightning.node.onchainColumn')}
            </SSText>
            {privacyMode ? (
              <SSText color="white" size="md" weight="light">
                {PRIVACY_MASK}
              </SSText>
            ) : (
              <SSStyledSatText
                amount={onchainBalance}
                decimals={0}
                textSize="md"
                weight="light"
              />
            )}
            {btcPrice > 0 && renderFiatValue(onchainFiat, true)}
          </SSVStack>
        </SSHStack>

        <SSVStack gap="xs" style={styles.heroLiquidityBlock}>
          <SSHStack gap="md" justifyBetween style={styles.channelCapacityRow}>
            <SSText color="muted" size="xs" weight="medium">
              {t('lightning.landing.totalCapacity')}
            </SSText>
            <SSText color="white" size="sm" weight="medium">
              {privacyMode ? PRIVACY_MASK : formatNumber(nodeTotalCapacity)}
            </SSText>
          </SSHStack>
          <View style={styles.channelBalanceBarTrack}>
            {privacyMode ? (
              <View style={styles.channelBalanceBarPrivacyFill} />
            ) : nodeTotalCap > 0 ? (
              <View style={styles.channelBalanceBarSegments}>
                {heroBarFlexLocal > 0 ? (
                  <View
                    style={[
                      styles.channelBalanceSegment,
                      styles.channelBalanceSegmentMin,
                      {
                        backgroundColor: Colors.white,
                        flex: heroBarFlexLocal
                      }
                    ]}
                  />
                ) : null}
                {heroBarFlexRemote > 0 ? (
                  <View
                    style={[
                      styles.channelBalanceSegment,
                      styles.channelBalanceSegmentMin,
                      {
                        backgroundColor: Colors.gray[200],
                        flex: heroBarFlexRemote
                      }
                    ]}
                  />
                ) : null}
                {heroBarFlexBlack > 0 ? (
                  <View
                    style={[
                      styles.channelBalanceSegment,
                      {
                        backgroundColor: Colors.black,
                        flex: heroBarFlexBlack
                      }
                    ]}
                  />
                ) : null}
              </View>
            ) : (
              <View style={styles.channelBalanceBarEmpty} />
            )}
          </View>
          <SSHStack gap="md" justifyBetween style={styles.channelLegendRow}>
            <SSHStack gap="xs" style={styles.channelLegendCluster}>
              <SSText size="sm" weight="medium">
                {fmtNodeLiquidity(totalLocalSats)}
              </SSText>
              <SSText color="muted" size="xxs" weight="medium">
                {t('lightning.node.channelLiquidityLocal')}
              </SSText>
            </SSHStack>
            <SSHStack gap="xs" style={styles.channelLegendClusterEnd}>
              <SSText color="muted" size="xxs" weight="medium">
                {t('lightning.node.channelLiquidityRemote')}
              </SSText>
              <SSText size="sm" weight="medium">
                {fmtNodeLiquidity(totalRemoteSats)}
              </SSText>
            </SSHStack>
          </SSHStack>
        </SSVStack>
      </SSVStack>
    )
  }

  function renderTxRow(tx: LndCombinedTransaction) {
    const nowMs = Date.now()
    const timestamp = new Date(tx.timestamp * 1000)
    const fiatAmount = satsToFiat(Math.abs(tx.amount), btcPrice)
    const isReceive = tx.amount > 0

    const { transactionType } = getTxDisplayInfo(tx, isReceive)
    const feeSatString = getTxLightningSendFeeSatString(tx, privacyMode)
    const hasDescription = Boolean(tx.description?.trim())

    return (
      <View key={tx.id} style={styles.transactionItem}>
        <SSHStack gap="xs" justifyBetween style={styles.transactionHeader}>
          <SSHStack
            gap="xs"
            style={{
              alignItems: 'baseline',
              flex: 1,
              flexShrink: 1,
              flexWrap: 'wrap',
              minWidth: 0
            }}
          >
            {privacyMode ? (
              <SSText color="white" size="md" weight="light">
                {PRIVACY_MASK}
              </SSText>
            ) : (
              <SSStyledSatText
                amount={Math.abs(tx.amount)}
                decimals={0}
                textSize="md"
                weight="light"
                type={transactionType}
                noColor={false}
              />
            )}
            <SSText
              color="muted"
              size="xs"
              style={styles.transactionSatsSuffix}
            >
              {t('bitcoin.sats').toLowerCase()}
            </SSText>
            <SSText
              color="muted"
              size="xs"
              style={styles.transactionFiatInline}
            >
              {privacyMode
                ? PRIVACY_MASK
                : `≈ ${formatNumber(fiatAmount, 2)} ${fiatCurrency}`}
            </SSText>
          </SSHStack>
          <SSHStack gap="xs" style={styles.transactionTimestampRow}>
            <SSText color="muted" size="xs" style={styles.transactionTimestamp}>
              {timestamp.toLocaleString('en-US', {
                day: 'numeric',
                hour: 'numeric',
                hour12: true,
                minute: 'numeric',
                month: 'long',
                second: 'numeric',
                year: 'numeric'
              })}
            </SSText>
            <SSText color="muted" size="xs" style={styles.transactionTimeAgo}>
              {formatLightningTxTimeAgo(tx.timestamp, nowMs)}
            </SSText>
          </SSHStack>
        </SSHStack>
        <SSHStack gap="md" style={styles.transactionDetails}>
          <SSText
            color={hasDescription ? 'white' : 'muted'}
            numberOfLines={2}
            size="xs"
            style={styles.transactionDescription}
          >
            {privacyMode
              ? PRIVACY_MASK
              : hasDescription
                ? `${tx.description}${
                    tx.type === 'lightning_receive' &&
                    (tx.status === 'canceled' || tx.status === 'open') &&
                    tx.originalAmount
                      ? ` (${t('lightning.node.originalSats', {
                          amount: String(tx.originalAmount)
                        })})`
                      : ''
                  }`
                : t('lightning.node.txNoDescription')}
          </SSText>
          {feeSatString ? (
            <SSText
              color="muted"
              numberOfLines={2}
              size="xs"
              style={[
                styles.transactionTypeLine,
                styles.transactionTypeLineEnd
              ]}
            >
              <SSText size="xs" style={styles.transactionFeeWord}>
                {t('lightning.node.txFeeLabel')}{' '}
              </SSText>
              {t('lightning.node.txFeeAmount', { fee: feeSatString })}
            </SSText>
          ) : null}
        </SSHStack>
      </View>
    )
  }

  function renderTransactions() {
    const listLoading =
      isConnected && isDashboardPending && transactions.length === 0

    if (listLoading) {
      return (
        <SSVStack itemsCenter gap="none" style={{ paddingVertical: 16 }}>
          <SSText color="muted" size="sm">
            {t('lightning.node.transactionsLoading')}
          </SSText>
        </SSVStack>
      )
    }

    if (transactions.length === 0) {
      return (
        <SSVStack itemsCenter gap="none" style={{ paddingVertical: 16 }}>
          <SSText color="muted" size="sm">
            {t('lightning.node.noTransactions')}
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
          {displayedTxs.map((tx) => renderTxRow(tx))}

          {transactions.length > end ? (
            <SSButton
              label={t('lightning.node.loadMore')}
              onPress={handleLoadMore}
              variant="outline"
              style={styles.loadMoreButton}
            />
          ) : null}
        </ScrollView>
      </SSVStack>
    )
  }

  function renderOnchain() {
    const onchainTxs = transactions.filter((tx) => tx.type === 'onchain')
    const listLoading =
      isConnected && isDashboardPending && transactions.length === 0

    if (listLoading) {
      return (
        <SSVStack itemsCenter gap="none" style={{ paddingVertical: 16 }}>
          <SSText color="muted" size="sm">
            {t('lightning.node.onchainLoading')}
          </SSText>
        </SSVStack>
      )
    }

    if (onchainTxs.length === 0) {
      return (
        <SSVStack itemsCenter gap="none" style={{ paddingVertical: 16 }}>
          <SSText color="muted" size="sm">
            {t('lightning.node.noOnchainTransactions')}
          </SSText>
        </SSVStack>
      )
    }

    const maxOnchainPage = Math.max(
      0,
      Math.ceil(onchainTxs.length / TRANSACTIONS_PER_PAGE) - 1
    )
    const onchainPage = Math.min(onchainListPage, maxOnchainPage)
    const start = onchainPage * TRANSACTIONS_PER_PAGE
    const end = start + TRANSACTIONS_PER_PAGE
    const displayedOnchain = onchainTxs.slice(start, end)

    return (
      <SSVStack style={styles.section}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {displayedOnchain.map((tx) => renderTxRow(tx))}

          {onchainTxs.length > end ? (
            <SSButton
              label={t('lightning.node.loadMore')}
              onPress={handleLoadMoreOnchain}
              variant="outline"
              style={styles.loadMoreButton}
            />
          ) : null}
        </ScrollView>
      </SSVStack>
    )
  }

  function renderChannels() {
    if (!channels?.length) {
      return (
        <SSVStack itemsCenter gap="none" style={{ paddingVertical: 16 }}>
          <SSText color="muted" size="sm">
            {t('lightning.node.channelsEmpty')}
          </SSText>
        </SSVStack>
      )
    }

    if (channelsViewMode === 'bubbles') {
      const rows: LightningBubbleChannelRow[] = []
      for (const channel of channels) {
        if (!channel || typeof channel !== 'object') {
          continue
        }
        const chan_id =
          readLndChannelStringField(channel, ['chan_id', 'chanId']) || ''
        if (!chan_id) {
          continue
        }
        const peerAlias = getLndChannelPeerAlias(channel)
        const remote_pubkey = getLndChannelRemotePubkey(channel) || ''
        const peerLabel =
          peerAlias ||
          (privacyMode
            ? PRIVACY_MASK
            : formatShortPubkey(
                typeof remote_pubkey === 'string' ? remote_pubkey : ''
              ))
        rows.push({
          chanId: chan_id,
          localSats: readLndChannelSatsField(channel, [
            'local_balance',
            'localBalance'
          ]),
          peerLabel,
          remoteSats: readLndChannelSatsField(channel, [
            'remote_balance',
            'remoteBalance'
          ])
        })
      }

      const padFrac = LIGHTNING_BUBBLE_CHART_BLEED_MARGIN_FRAC
      const chartMaxSide = Math.max(0, width * (1 - 2 * padFrac))
      const bubbleSize = Math.min(
        LIGHTNING_BUBBLE_CHART_LAYOUT_MAX_SIZE_PX,
        Math.max(
          chartMaxSide,
          Math.min(LIGHTNING_BUBBLE_CHART_LAYOUT_MIN_SIZE_PX, chartMaxSide)
        )
      )

      return (
        <SSVStack gap="none" itemsCenter style={styles.section} widthFull>
          <SSLightningChannelsBubbleChart
            height={bubbleSize}
            onChannelPress={(chanId) =>
              router.push(lightningChannelHref(chanId))
            }
            privacyMode={privacyMode}
            rows={rows}
            width={bubbleSize}
          />
        </SSVStack>
      )
    }

    const nodeTotalCapacity = channels.reduce((sum, channel) => {
      if (!channel || typeof channel !== 'object') {
        return sum
      }
      return sum + readLndChannelSatsField(channel, ['capacity'])
    }, 0)

    return (
      <SSVStack style={styles.section}>
        <SSVStack style={styles.channelsList}>
          {channels.map((channel) => {
            if (!channel || typeof channel !== 'object') {
              return null
            }

            const { active = false } = channel

            const chan_id =
              readLndChannelStringField(channel, ['chan_id', 'chanId']) ||
              'Unknown'
            const peerAlias = getLndChannelPeerAlias(channel)
            const remote_pubkey =
              getLndChannelRemotePubkey(channel) || 'Unknown'
            const channelCapacity = readLndChannelSatsField(channel, [
              'capacity'
            ])
            const localSats = readLndChannelSatsField(channel, [
              'local_balance',
              'localBalance'
            ])
            const remoteSats = readLndChannelSatsField(channel, [
              'remote_balance',
              'remoteBalance'
            ])

            return (
              <Pressable
                key={chan_id}
                accessibilityRole="button"
                onPress={() => router.push(lightningChannelHref(chan_id))}
                style={({ pressed }) => [
                  styles.channelCard,
                  pressed && styles.channelCardPressed,
                  !active && styles.channelCardInactive
                ]}
              >
                <SSVStack style={styles.channelCardContent}>
                  <SSHStack
                    gap="md"
                    justifyBetween
                    style={styles.channelCardHeader}
                  >
                    <SSVStack gap="xs" style={styles.channelCardTitleCol}>
                      {peerAlias ? (
                        <SSText numberOfLines={2} size="lg" weight="light">
                          {peerAlias}
                        </SSText>
                      ) : (
                        <SSText
                          numberOfLines={1}
                          size="lg"
                          type="mono"
                          weight="light"
                        >
                          {privacyMode
                            ? PRIVACY_MASK
                            : formatShortPubkey(
                                typeof remote_pubkey === 'string'
                                  ? remote_pubkey
                                  : ''
                              )}
                        </SSText>
                      )}
                    </SSVStack>
                    <SSHStack gap="sm" style={styles.channelCardHeaderRight}>
                      <View
                        style={[
                          styles.channelStatusPill,
                          active
                            ? styles.channelStatusPillOn
                            : styles.channelStatusPillOff
                        ]}
                      >
                        <SSText
                          color={active ? 'white' : 'muted'}
                          size="xs"
                          weight="medium"
                        >
                          {active
                            ? t('lightning.node.active')
                            : t('lightning.node.inactive')}
                        </SSText>
                      </View>
                      <SSIconChevronRight
                        height={14}
                        stroke={Colors.gray[100]}
                        strokeWidth={1}
                        width={10}
                      />
                    </SSHStack>
                  </SSHStack>

                  <SSLightningChannelLiquidityBar
                    channelCapacity={channelCapacity}
                    localSats={localSats}
                    nodeTotalCapacity={nodeTotalCapacity}
                    privacyMode={privacyMode}
                    remoteSats={remoteSats}
                  />
                </SSVStack>
              </Pressable>
            )
          })}
        </SSVStack>
      </SSVStack>
    )
  }

  function renderRefreshControl() {
    return <RefreshControl refreshing={false} onRefresh={runRefresh} />
  }

  function renderTab() {
    if (expand) {
      return null
    }

    const tabWidth = '33.333%'
    const activeChannels =
      channels?.filter((channel) => channel.active).length || 0
    const totalChannels = channels?.length || 0
    const onchainTxCount = transactions.filter(
      (tx) => tx.type === 'onchain'
    ).length

    return (
      <SSHStack
        gap="none"
        style={{
          borderBottomColor: Colors.gray[800],
          borderBottomWidth: 1,
          paddingHorizontal: '5%',
          paddingTop: 8
        }}
      >
        <SSActionButton
          style={{ width: tabWidth }}
          onPress={() => handleTabChange(0)}
        >
          <View style={styles.tabItem}>
            <SSText center size="lg">
              {privacyMode ? PRIVACY_MASK : transactions.length}
            </SSText>
            <SSText center color="muted" style={{ lineHeight: 12 }}>
              {t('lightning.node.transactionsTab')}
            </SSText>
            {tabIndex === 0 && <View style={styles.tabIndicator} />}
          </View>
        </SSActionButton>
        <SSActionButton
          style={{ width: tabWidth }}
          onPress={() => handleTabChange(1)}
        >
          <View style={styles.tabItem}>
            <SSText center size="lg">
              {privacyMode
                ? PRIVACY_MASK
                : `${activeChannels}/${totalChannels}`}
            </SSText>
            <SSText center color="muted" style={{ lineHeight: 12 }}>
              {t('lightning.node.channelsTab')}
            </SSText>
            {tabIndex === 1 && <View style={styles.tabIndicator} />}
          </View>
        </SSActionButton>
        <SSActionButton
          style={{ width: tabWidth }}
          onPress={() => handleTabChange(2)}
        >
          <View style={styles.tabItem}>
            <SSText center size="lg">
              {privacyMode ? PRIVACY_MASK : onchainTxCount}
            </SSText>
            <SSText center color="muted" style={{ lineHeight: 12 }}>
              {t('lightning.node.onchainTab')}
            </SSText>
            {tabIndex === 2 && <View style={styles.tabIndicator} />}
          </View>
        </SSActionButton>
      </SSHStack>
    )
  }

  function renderScene({
    route
  }: SceneRendererProps & { route: { key: string } }) {
    switch (route.key) {
      case 'transactions':
        return (
          <View style={[styles.section, styles.tabContent]}>
            <SSHStack justifyBetween style={styles.tabSceneToolbar}>
              <SSHStack>
                <SSIconButton onPress={runRefresh}>
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
                    ? t('lightning.node.hideOpenInvoices')
                    : t('lightning.node.showOpenInvoices')}
                </SSText>
              </SSHStack>
            </SSHStack>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              refreshControl={renderRefreshControl()}
              showsVerticalScrollIndicator={false}
            >
              {renderTransactions()}
            </ScrollView>
          </View>
        )
      case 'onchain':
        return (
          <View style={[styles.section, styles.tabContent]}>
            <SSHStack justifyBetween style={styles.tabSceneToolbar}>
              <SSHStack>
                <SSIconButton onPress={runRefresh}>
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
              <View style={{ width: 40 }} />
            </SSHStack>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              refreshControl={renderRefreshControl()}
              showsVerticalScrollIndicator={false}
            >
              {renderOnchain()}
            </ScrollView>
          </View>
        )
      case 'channels':
        return (
          <View style={[styles.section, styles.tabContent]}>
            <SSHStack justifyBetween style={styles.tabSceneToolbar}>
              <SSHStack>
                <SSIconButton onPress={runRefresh}>
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
              <SSIconButton
                accessibilityLabel={
                  channelsViewMode === 'list'
                    ? t('lightning.node.channelsToggleBubbleA11y')
                    : t('lightning.node.channelsToggleListA11y')
                }
                accessibilityRole="switch"
                accessibilityState={{ checked: channelsViewMode === 'bubbles' }}
                onPress={() =>
                  setChannelsViewMode((m) =>
                    m === 'list' ? 'bubbles' : 'list'
                  )
                }
              >
                {channelsViewMode === 'list' ? (
                  <SSIconBubbles height={18} width={20} />
                ) : (
                  <SSIconList height={18} width={20} />
                )}
              </SSIconButton>
            </SSHStack>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              refreshControl={renderRefreshControl()}
              showsVerticalScrollIndicator={false}
            >
              {renderChannels()}
            </ScrollView>
          </View>
        )
      default:
        return null
    }
  }

  const showSoftErrorBanner =
    isDashboardError && Boolean(balance) && !isDashboardFetching

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <SSIconButton
              style={{ marginRight: 16 }}
              onPress={() =>
                router.push({
                  params: { alias: params.alias },
                  pathname: '/signer/lightning/node/settings'
                })
              }
            >
              <SSIconLightning
                height={17}
                stroke="#828282"
                strokeWidth={1}
                width={12}
              />
            </SSIconButton>
          ),
          headerTitle: () => (
            <SSText uppercase style={{ letterSpacing: 1 }}>
              {params.alias}
            </SSText>
          )
        }}
      />
      <View style={styles.screenRoot}>
        <SSMainLayout style={styles.mainLayout}>
          {!expand ? (
            <Animated.View>
              <SSVStack gap="md" widthFull>
                {showSoftErrorBanner ? (
                  <SSVStack gap="xs" style={{ alignSelf: 'stretch' }}>
                    <SSText color="muted" size="xs" center>
                      {t('lightning.node.balancesFailed')}
                    </SSText>
                    <SSButton
                      label={t('lightning.node.retry')}
                      onPress={() => {
                        void refetchDashboard()
                      }}
                      variant="outline"
                      style={styles.button}
                    />
                  </SSVStack>
                ) : null}
                {reserveHeroMinHeight ? (
                  <View style={styles.heroShell}>{renderBalances()}</View>
                ) : (
                  renderBalances()
                )}
                {showBalanceError ? (
                  <SSHStack style={styles.actions}>
                    <SSButton
                      label={t('lightning.node.retry')}
                      onPress={() => {
                        void refetchDashboard()
                      }}
                      variant="outline"
                      loading={isConnecting}
                      style={styles.button}
                    />
                  </SSHStack>
                ) : null}
                {showHeroBalances ? (
                  <SSVStack gap="none">
                    <SSButtonActionsGroup
                      context="lightning"
                      nfcAvailable={contentHandler.nfcAvailable}
                      onSend={contentHandler.handleSend}
                      onPaste={contentHandler.handlePaste}
                      onCamera={contentHandler.handleCamera}
                      onNFC={contentHandler.handleNFC}
                      onReceive={contentHandler.handleReceive}
                    />
                  </SSVStack>
                ) : null}
              </SSVStack>
            </Animated.View>
          ) : null}
          <TabView
            swipeEnabled={false}
            navigationState={{ index: tabIndex, routes: tabs }}
            renderScene={renderScene}
            renderTabBar={renderTab}
            onIndexChange={handleTabChange}
            initialLayout={{ width }}
          />
        </SSMainLayout>
        {isDashboardFetching && showHeroBalances ? (
          <View
            accessibilityLabel={t('lightning.node.refreshing')}
            accessibilityRole="progressbar"
            pointerEvents="none"
            style={styles.dashboardRefreshingOverlay}
          >
            <SSLoader size={DASHBOARD_OVERLAY_LOADER_SIZE} />
          </View>
        ) : null}
      </View>
      <SSCameraModal
        visible={contentHandler.cameraModalVisible}
        onClose={contentHandler.closeCameraModal}
        onContentScanned={contentHandler.handleContentScanned}
        context="lightning"
        title="Scan Lightning Content"
      />
      <SSNFCModal
        visible={contentHandler.nfcModalVisible}
        onClose={contentHandler.closeNFCModal}
        onContentRead={contentHandler.handleNFCContentRead}
        mode="read"
      />
      <SSPaste
        visible={contentHandler.pasteModalVisible}
        onClose={contentHandler.closePasteModal}
        onContentPasted={contentHandler.handleContentPasted}
        context="lightning"
      />
    </>
  )
}

const styles = StyleSheet.create({
  actions: {
    gap: 8,
    marginTop: 16
  },
  button: {
    minHeight: 40
  },
  channelBalanceBarEmpty: {
    alignSelf: 'stretch',
    backgroundColor: Colors.gray[800],
    flex: 1,
    minHeight: 12
  },
  channelBalanceBarPrivacyFill: {
    alignSelf: 'stretch',
    backgroundColor: Colors.gray[600],
    flex: 1,
    minHeight: 12
  },
  channelBalanceBarSegments: {
    alignSelf: 'stretch',
    flex: 1,
    flexDirection: 'row',
    minHeight: 12
  },
  channelBalanceBarTrack: {
    alignSelf: 'stretch',
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[800],
    borderRadius: 3,
    borderWidth: 1,
    height: 12,
    overflow: 'hidden',
    width: '100%'
  },
  channelBalanceSegment: {
    minWidth: 0
  },
  channelBalanceSegmentMin: {
    minWidth: 4
  },
  channelCapacityRow: {
    alignItems: 'baseline'
  },
  channelCard: {
    backgroundColor: Colors.gray[875],
    borderColor: Colors.gray[700],
    borderRadius: 3,
    borderWidth: 1,
    elevation: 6,
    overflow: 'visible',
    shadowColor: '#000000',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    width: '100%'
  },
  channelCardContent: {
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14
  },
  channelCardHeader: {
    alignItems: 'flex-start'
  },
  channelCardHeaderRight: {
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 2
  },
  channelCardInactive: {
    borderColor: Colors.gray[600]
  },
  channelCardPressed: {
    borderColor: Colors.gray[500],
    opacity: 0.92,
    transform: [{ scale: 0.992 }]
  },
  channelCardTitleCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8
  },
  channelLegendCluster: {
    alignItems: 'baseline',
    flexShrink: 1,
    minWidth: 0
  },
  channelLegendClusterEnd: {
    alignItems: 'baseline',
    flexShrink: 1,
    minWidth: 0
  },
  channelLegendRow: {
    alignItems: 'baseline'
  },
  channelStatusPill: {
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  channelStatusPillOff: {
    backgroundColor: Colors.gray[800]
  },
  channelStatusPillOn: {
    backgroundColor: Colors.gray[700]
  },
  channelsList: {
    gap: 12
  },
  dashboardRefreshingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10
  },
  error: {
    marginTop: 16,
    textAlign: 'center'
  },
  heroBalanceColumns: {
    alignSelf: 'stretch',
    width: '100%'
  },
  heroFiatDeeper: {
    color: Colors.gray[400]
  },
  heroLiquidityBlock: {
    alignSelf: 'stretch',
    marginTop: 12,
    width: '100%'
  },
  heroShell: {
    alignSelf: 'stretch',
    justifyContent: 'flex-start',
    minHeight:
      Sizes.text.fontSize.xs * 4 +
      Sizes.text.fontSize.sm * 2 +
      Sizes.text.fontSize['5xl'] +
      Sizes.text.fontSize.md * 2 +
      12
  },
  heroSideColumn: {
    flex: 0.2,
    minWidth: 0
  },
  infoGrid: {
    gap: 12
  },
  infoItem: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  loadMoreButton: {
    marginBottom: 8,
    marginTop: 16
  },
  mainLayout: {
    flex: 1,
    paddingTop: 10
  },
  placeholderText: {
    padding: 24,
    textAlign: 'center'
  },
  screenRoot: {
    flex: 1,
    position: 'relative'
  },
  scrollContent: {
    flexGrow: 1,
    gap: 10,
    paddingBottom: 32
  },
  scrollView: {
    flex: 1
  },
  section: {
    flex: 1,
    gap: 16
  },
  sectionTitle: {
    marginBottom: 1
  },
  tabContent: {
    flex: 1,
    marginTop: -4,
    paddingHorizontal: 0
  },
  tabIndicator: {
    backgroundColor: Colors.white,
    bottom: 0,
    height: 2,
    left: 0,
    position: 'absolute',
    right: 0
  },
  tabItem: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    paddingBottom: 8
  },
  tabSceneToolbar: {
    paddingBottom: 0,
    paddingTop: 16
  },
  transactionDescription: {
    flexBasis: 0,
    flexGrow: 3,
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'left'
  },
  transactionDetails: {
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    marginTop: 6,
    width: '100%'
  },
  transactionFeeWord: {
    color: Colors.gray[300]
  },
  transactionFiatInline: {
    flexShrink: 1,
    opacity: 0.68
  },
  transactionHeader: {
    marginBottom: 8
  },
  transactionItem: {
    borderTopColor: Colors.gray[800],
    borderTopWidth: 1,
    paddingHorizontal: 0,
    paddingVertical: 12
  },
  transactionSatsSuffix: {
    opacity: 0.68
  },
  transactionTimeAgo: {
    flexShrink: 0
  },
  transactionTimestamp: {
    flexShrink: 1,
    opacity: 0.52,
    textAlign: 'right'
  },
  transactionTimestampRow: {
    alignItems: 'baseline',
    flexShrink: 0,
    justifyContent: 'flex-end',
    marginLeft: 8,
    maxWidth: '52%'
  },
  transactionTypeLine: {
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0
  },
  transactionTypeLineEnd: {
    textAlign: 'right'
  }
})
