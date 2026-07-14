import { FlashList, type ListRenderItem } from '@shopify/flash-list'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { type ReactNode, useState } from 'react'
import {
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
  View
} from 'react-native'
import { type SceneRendererProps, TabView } from 'react-native-tab-view'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import {
  SSIconArrowLineDown,
  SSIconArrowsClockwise,
  SSIconCollapse,
  SSIconExpand,
  SSIconRefresh,
  SSIconSignOut,
  SSIconTriangle
} from '@/components/icons'
import SSIconTime from '@/components/icons/SSIconTime'
import SSActionButton from '@/components/SSActionButton'
import SSArkAddressesView from '@/components/SSArkAddressesView'
import SSArkMovementCard from '@/components/SSArkMovementCard'
import SSArkRefreshCard from '@/components/SSArkRefreshCard'
import SSArkVtxoCard from '@/components/SSArkVtxoCard'
import SSButton from '@/components/SSButton'
import SSButtonActionsGroup from '@/components/SSButtonActionsGroup'
import SSCameraModal from '@/components/SSCameraModal'
import SSIconButton from '@/components/SSIconButton'
import SSLoader from '@/components/SSLoader'
import SSModal from '@/components/SSModal'
import SSSelectionActionBar from '@/components/SSSelectionActionBar'
import SSSortDirectionToggle from '@/components/SSSortDirectionToggle'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import {
  HEADER_CHROME_EDGE_NUDGE,
  HEADER_CHROME_HIT_BOX,
  HEADER_CHROME_SETTINGS_ICON_SIZE
} from '@/constants/headerChrome'
import { PRIVACY_MASK } from '@/constants/privacy'
import { useArkAddresses } from '@/hooks/useArkAddresses'
import { useArkBalance } from '@/hooks/useArkBalance'
import { useArkExit } from '@/hooks/useArkExit'
import { useArkExitFeeEstimate } from '@/hooks/useArkExitFeeEstimate'
import { useArkLabels } from '@/hooks/useArkLabels'
import { useArkMovements } from '@/hooks/useArkMovements'
import { useArkRefresh } from '@/hooks/useArkRefresh'
import { useArkRefreshFeeEstimate } from '@/hooks/useArkRefreshFeeEstimate'
import { useArkSendNavigation } from '@/hooks/useArkSendNavigation'
import { useArkSync } from '@/hooks/useArkSync'
import { useArkVtxos } from '@/hooks/useArkVtxos'
import { useArkWallet } from '@/hooks/useArkWallet'
import { useFetchBitcoinPrice } from '@/hooks/useFetchBitcoinPrice'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useArkStore } from '@/store/ark'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors, Layout, Sizes } from '@/styles'
import { type Direction } from '@/types/logic/sort'
import type { ArkMovement } from '@/types/models/Ark'
import { getArkPendingSats, getArkTotalSats } from '@/utils/ark'
import { countUsedArkAddresses } from '@/utils/arkAddress'
import {
  getArkMovementLabelRef,
  selectArkRefreshes,
  selectArkTransactions,
  sortArkMovements
} from '@/utils/arkMovement'
import {
  type ArkVtxoListItem,
  buildArkVtxoSections,
  filterSelectableVtxoIds,
  getArkNextExpiryHeight
} from '@/utils/arkVtxo'
import { type DetectedContent } from '@/utils/contentDetector'
import { formatFiatPrice, formatNumber } from '@/utils/format'

const HEADER_ICON_STROKE = '#828282'
const CONTENT_PADDING_HORIZONTAL = Layout.mainContainer.paddingHorizontal
const TAB_WIDTH = '25%'
const VTXOS_TAB_INDEX = 2
const SCENE_LOADER_SIZE = 32
const REFRESH_PROGRESS_VIEW_OFFSET = 9999
const SELECTION_ICON_SIZE = 15

type ArkTabKey = 'transactions' | 'addresses' | 'vtxos' | 'refreshes'
type ArkTabRoute = { key: ArkTabKey }

export default function ArkAccountDetailPage() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { width } = useWindowDimensions()
  const [accounts, cachedBalance] = useArkStore(
    useShallow((state) => [state.accounts, state.balances[id]])
  )
  const account = accounts.find((a) => a.id === id)

  const walletQuery = useArkWallet(id)
  const balanceQuery = useArkBalance(id)
  const movementsQuery = useArkMovements(id)
  const vtxosQuery = useArkVtxos(id)
  const addressesResult = useArkAddresses(id)
  const labelsQuery = useArkLabels(id)
  const { handleContentReady } = useArkSendNavigation(id)
  useFetchBitcoinPrice()

  const [cameraVisible, setCameraVisible] = useState(false)
  const [tabIndex, setTabIndex] = useState(0)
  const [expand, setExpand] = useState(false)
  const [transactionsSortDirection, setTransactionsSortDirection] =
    useState<Direction>('desc')
  const [refreshesSortDirection, setRefreshesSortDirection] =
    useState<Direction>('desc')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [refreshModalVisible, setRefreshModalVisible] = useState(false)
  const [exitModalVisible, setExitModalVisible] = useState(false)

  const refreshMutation = useArkRefresh(id)
  const exitMutation = useArkExit(id)
  const syncMutation = useArkSync(id)

  const [currencyUnit, privacyMode, useZeroPadding] = useSettingsStore(
    useShallow((state) => [
      state.currencyUnit,
      state.privacyMode,
      state.useZeroPadding
    ])
  )
  const [fiatCurrency, btcPrice] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.btcPrice])
  )

  const balance = balanceQuery.data ?? cachedBalance
  const total = balance ? getArkTotalSats(balance) : 0
  const pending = balance ? getArkPendingSats(balance) : 0
  const totalSize = total > 1_000_000_000 ? '4xl' : '6xl'
  const isLoading =
    (walletQuery.isLoading || balanceQuery.isLoading) && !balance
  const loadError = walletQuery.error ?? balanceQuery.error

  const allMovements = movementsQuery.data ?? []
  const transactions = selectArkTransactions(allMovements)
  const refreshes = selectArkRefreshes(allMovements)
  const vtxos = vtxosQuery.data ?? []
  const vtxoItems = buildArkVtxoSections(vtxos)
  const { addresses } = addressesResult
  const labels = labelsQuery.data ?? {}

  const selectedSpendableIds = filterSelectableVtxoIds(vtxos, selectedIds)
  const selectedVtxos = vtxos.filter((vtxo) =>
    selectedSpendableIds.includes(vtxo.id)
  )
  const hasSelection = selectedSpendableIds.length > 0
  const spendableVtxoIds = vtxos
    .filter((vtxo) => vtxo.spendable)
    .map((vtxo) => vtxo.id)
  const allSpendableSelected =
    spendableVtxoIds.length > 0 &&
    selectedSpendableIds.length === spendableVtxoIds.length
  const refreshFeeQuery = useArkRefreshFeeEstimate({
    accountId: id,
    enabled: refreshModalVisible,
    vtxoIds: selectedSpendableIds
  })
  const exitFeeQuery = useArkExitFeeEstimate({
    accountId: id,
    enabled: exitModalVisible,
    vtxos: selectedVtxos
  })

  const tabConfig: {
    key: ArkTabKey
    label: string
    count: number
  }[] = [
    {
      count: transactions.length,
      key: 'transactions',
      label: t('accounts.totalTransactions')
    },
    {
      count: countUsedArkAddresses(addresses),
      key: 'addresses',
      label: t('ark.tab.addresses')
    },
    { count: vtxos.length, key: 'vtxos', label: t('ark.tab.vtxos') },
    {
      count: refreshes.length,
      key: 'refreshes',
      label: t('ark.tab.refreshes')
    }
  ]
  const routes: ArkTabRoute[] = tabConfig.map((tab) => ({ key: tab.key }))

  function syncAccount() {
    syncMutation.mutate()
  }

  function handleSend() {
    router.navigate({
      params: { id },
      pathname: '/signer/ark/account/[id]/send'
    })
  }

  function handleReceive() {
    router.navigate({
      params: { id },
      pathname: '/signer/ark/account/[id]/receive'
    })
  }

  function handleCamera() {
    setCameraVisible(true)
  }

  async function handleScanned(content: DetectedContent) {
    setCameraVisible(false)
    await handleContentReady(content)
  }

  function handleTabChange(index: number) {
    setTabIndex(index)
    setExpand(false)
    if (index !== VTXOS_TAB_INDEX) {
      setSelectedIds([])
    }
  }

  function handleToggleExpand() {
    setExpand((prev) => !prev)
  }

  function handleToggleVtxo(vtxoId: string) {
    setSelectedIds((prev) =>
      prev.includes(vtxoId)
        ? prev.filter((selectedId) => selectedId !== vtxoId)
        : [...prev, vtxoId]
    )
  }

  function handleClearSelection() {
    setSelectedIds([])
  }

  function handleToggleSelectAllVtxos() {
    setSelectedIds(allSpendableSelected ? [] : spendableVtxoIds)
  }

  function handleEditAddressLabel(address: string) {
    router.navigate({
      params: { addr: address, id },
      pathname: '/signer/ark/account/[id]/address/[addr]/label'
    })
  }

  function handleOffboardSelected() {
    router.navigate(
      `/signer/ark/account/${id}/settings/offboard?vtxoIds=${encodeURIComponent(
        selectedSpendableIds.join(',')
      )}`
    )
  }

  function handleRefreshSelected() {
    setRefreshModalVisible(true)
  }

  function handleConfirmRefresh() {
    if (selectedSpendableIds.length === 0) {
      toast.error(t('ark.vtxo.emptySpendable'))
      setRefreshModalVisible(false)
      return
    }
    refreshMutation.mutate(selectedSpendableIds, {
      onError: (error) => {
        toast.error(error.message || t('ark.refresh.error'))
      },
      onSuccess: () => {
        toast.success(t('ark.refresh.success'))
      }
    })
    setRefreshModalVisible(false)
    setSelectedIds([])
  }

  function handleEmergencyExitSelected() {
    setExitModalVisible(true)
  }

  function handleConfirmEmergencyExit() {
    if (selectedSpendableIds.length === 0) {
      toast.error(t('ark.vtxo.emptySpendable'))
      setExitModalVisible(false)
      return
    }
    exitMutation.mutate(selectedSpendableIds, {
      onError: (error) => {
        toast.error(error.message || t('ark.exit.error'))
      },
      onSuccess: () => {
        toast.success(t('ark.exit.success'))
        setSelectedIds([])
        setExitModalVisible(false)
      }
    })
  }

  function renderHeaderRight() {
    return (
      <SSIconButton
        style={[
          HEADER_CHROME_HIT_BOX,
          { marginRight: -HEADER_CHROME_EDGE_NUDGE }
        ]}
        onPress={() =>
          router.navigate({
            params: { id },
            pathname: '/signer/ark/account/[id]/settings'
          })
        }
      >
        <SSIconTriangle
          height={HEADER_CHROME_SETTINGS_ICON_SIZE}
          width={HEADER_CHROME_SETTINGS_ICON_SIZE}
          color={HEADER_ICON_STROKE}
          strokeWidth={0.9}
        />
      </SSIconButton>
    )
  }

  function renderMovementItem({ item }: { item: ArkMovement }) {
    return (
      <SSArkMovementCard
        movement={item}
        link={`/signer/ark/account/${id}/movement/${item.id}`}
        label={labels[getArkMovementLabelRef(item)]?.label ?? ''}
      />
    )
  }

  function renderRefreshItem({ item }: { item: ArkMovement }) {
    return (
      <SSArkRefreshCard
        movement={item}
        link={`/signer/ark/account/${id}/movement/${item.id}`}
        label={labels[getArkMovementLabelRef(item)]?.label ?? ''}
      />
    )
  }

  function renderVtxoItem({ item }: { item: ArkVtxoListItem }) {
    if (item.type === 'header') {
      if (item.group === 'spendable') {
        return (
          <SSHStack justifyBetween style={styles.vtxoSectionHeaderRow}>
            <SSText color="muted" size="xs" uppercase>
              {t('ark.vtxo.spendable')} ({item.count})
            </SSText>
            <SSIconButton
              style={styles.vtxoSelectAllButton}
              onPress={handleToggleSelectAllVtxos}
            >
              <SSText
                size="xs"
                uppercase
                numberOfLines={1}
                style={styles.vtxoSelectAllText}
              >
                {allSpendableSelected
                  ? t('common.deselectAll')
                  : t('common.selectAll')}
              </SSText>
            </SSIconButton>
          </SSHStack>
        )
      }
      return (
        <SSText
          color="muted"
          size="xs"
          uppercase
          style={styles.vtxoSectionHeader}
        >
          {t('ark.vtxo.locked')} ({item.count})
        </SSText>
      )
    }
    return (
      <SSArkVtxoCard
        vtxo={item.vtxo}
        selected={selectedSpendableIds.includes(item.vtxo.id)}
        onToggle={item.vtxo.spendable ? handleToggleVtxo : undefined}
      />
    )
  }

  function renderRefreshControl(refreshing: boolean) {
    return (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={syncAccount}
        tintColor={Colors.transparent}
        colors={[Colors.transparent]}
        progressBackgroundColor={Colors.transparent}
        progressViewOffset={REFRESH_PROGRESS_VIEW_OFFSET}
      />
    )
  }

  function renderListWithLoader(list: ReactNode, refreshing: boolean) {
    return (
      <View style={styles.sceneContainer}>
        {list}
        {refreshing && (
          <View style={styles.loaderOverlay} pointerEvents="none">
            <SSLoader size={SCENE_LOADER_SIZE} />
          </View>
        )}
      </View>
    )
  }

  function renderMovementList(
    data: ArkMovement[],
    emptyLabel: string,
    controls?: ReactNode,
    renderItem: ListRenderItem<ArkMovement> = renderMovementItem
  ) {
    const refreshing = syncMutation.isPending || movementsQuery.isFetching
    return renderListWithLoader(
      <>
        {controls}
        <FlashList
          data={data}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={renderRefreshControl(refreshing)}
          renderItem={renderItem}
          ItemSeparatorComponent={renderSeparator}
          ListEmptyComponent={
            movementsQuery.isLoading ? null : (
              <SSVStack style={styles.emptyContainer}>
                <SSText color="muted">{emptyLabel}</SSText>
              </SSVStack>
            )
          }
        />
      </>,
      refreshing
    )
  }

  function renderTransactionsControls() {
    return (
      <SSHStack justifyBetween style={styles.movementControls}>
        <SSHStack>
          <SSIconButton onPress={syncAccount}>
            <SSIconRefresh height={18} width={22} />
          </SSIconButton>
          <SSIconButton onPress={handleToggleExpand}>
            {expand ? (
              <SSIconCollapse height={15} width={15} />
            ) : (
              <SSIconExpand height={15} width={16} />
            )}
          </SSIconButton>
        </SSHStack>
        <SSSortDirectionToggle
          onDirectionChanged={(direction) =>
            setTransactionsSortDirection(direction)
          }
        />
      </SSHStack>
    )
  }

  function renderRefreshesControls() {
    const nextExpiryHeight = getArkNextExpiryHeight(vtxos)
    return (
      <SSHStack justifyBetween style={styles.refreshesControls}>
        <SSIconButton onPress={syncAccount}>
          <SSIconRefresh height={18} width={22} />
        </SSIconButton>
        {nextExpiryHeight !== null && (
          <SSText color="muted" size="xs">
            {t('ark.refresh.nextExpiry', { height: nextExpiryHeight })}
          </SSText>
        )}
        <SSSortDirectionToggle
          onDirectionChanged={(direction) =>
            setRefreshesSortDirection(direction)
          }
        />
      </SSHStack>
    )
  }

  function renderScene({ route }: SceneRendererProps & { route: ArkTabRoute }) {
    if (route.key === 'vtxos') {
      const refreshing = syncMutation.isPending || vtxosQuery.isFetching
      return renderListWithLoader(
        <FlashList
          data={vtxoItems}
          keyExtractor={(item) => item.key}
          getItemType={(item) => item.type}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={renderRefreshControl(refreshing)}
          renderItem={renderVtxoItem}
          ListEmptyComponent={
            vtxosQuery.isLoading ? null : (
              <SSVStack style={styles.emptyContainer}>
                <SSText color="muted">{t('ark.vtxo.empty')}</SSText>
              </SSVStack>
            )
          }
        />,
        refreshing
      )
    }

    if (route.key === 'addresses') {
      const refreshing = syncMutation.isPending || addressesResult.isLoading
      return renderListWithLoader(
        <SSArkAddressesView
          addresses={addresses}
          labels={labels}
          expand={expand}
          onToggleExpand={handleToggleExpand}
          onRefresh={syncAccount}
          onPressAddress={handleEditAddressLabel}
          emptyComponent={
            addressesResult.isLoading ? null : (
              <SSVStack style={styles.emptyContainer}>
                {addressesResult.error ? (
                  <SSText style={{ color: Colors.warning }}>
                    {t('ark.error.addressList')}
                  </SSText>
                ) : (
                  <SSText color="muted">{t('ark.address.empty')}</SSText>
                )}
              </SSVStack>
            )
          }
        />,
        refreshing
      )
    }

    if (route.key === 'refreshes') {
      return renderMovementList(
        sortArkMovements(refreshes, refreshesSortDirection),
        t('ark.refresh.empty'),
        renderRefreshesControls(),
        renderRefreshItem
      )
    }

    return renderMovementList(
      sortArkMovements(transactions, transactionsSortDirection),
      t('ark.movement.empty'),
      renderTransactionsControls()
    )
  }

  function renderTabBar() {
    if (expand) {
      return null
    }
    return (
      <SSHStack gap="none" style={styles.tabBar}>
        {tabConfig.map((tab, index) => (
          <SSActionButton
            key={tab.key}
            style={styles.tab}
            onPress={() => handleTabChange(index)}
          >
            <SSVStack gap="none">
              <SSText center size="lg">
                {tab.count}
              </SSText>
              <SSText center color="muted" style={styles.tabLabel}>
                {tab.label}
              </SSText>
              {tabIndex === index && <View style={styles.tabIndicator} />}
            </SSVStack>
          </SSActionButton>
        ))}
      </SSHStack>
    )
  }

  return (
    <SSMainLayout style={styles.layout}>
      <Stack.Screen
        options={{
          headerRight: renderHeaderRight,
          headerTitle: () => (
            <SSText uppercase>
              {account?.name ?? t('navigation.item.ark')}
            </SSText>
          )
        }}
      />
      {!expand && (
        <SSVStack itemsCenter gap="none" style={styles.header}>
          <SSVStack style={styles.balanceContainer} gap="xs">
            <SSText color="muted" size="xs" uppercase>
              {t('ark.balance.title')}
            </SSText>
            <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
              {privacyMode ? (
                <SSText
                  color="white"
                  size={totalSize}
                  weight="ultralight"
                  style={{
                    letterSpacing: -1,
                    lineHeight: Sizes.text.fontSize[totalSize]
                  }}
                >
                  {PRIVACY_MASK}
                </SSText>
              ) : (
                <SSStyledSatText
                  amount={total}
                  decimals={0}
                  useZeroPadding={useZeroPadding}
                  currency={currencyUnit}
                  textSize={totalSize}
                  weight="ultralight"
                  letterSpacing={-1}
                />
              )}
              <SSText size="xl" color="muted">
                {currencyUnit === 'btc' ? t('bitcoin.btc') : t('bitcoin.sats')}
              </SSText>
            </SSHStack>
            {btcPrice > 0 && (
              <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                <SSText color="muted">
                  {privacyMode
                    ? PRIVACY_MASK
                    : formatFiatPrice(total, btcPrice)}
                </SSText>
                <SSText size="xs" style={{ color: Colors.gray[500] }}>
                  {fiatCurrency}
                </SSText>
              </SSHStack>
            )}
            {pending > 0 && !privacyMode && (
              <SSHStack gap="xs" style={{ alignItems: 'center' }}>
                <SSIconTime width={13} height={13} />
                <SSText color="muted" size="xs">
                  {t('ark.balance.pending', { amount: formatNumber(pending) })}
                </SSText>
              </SSHStack>
            )}
            {isLoading && (
              <SSText color="muted" size="xs">
                {t('common.loading')}
              </SSText>
            )}
            {!!loadError && !isLoading && (
              <SSText style={{ color: Colors.warning }} size="xs" center>
                {t('ark.error.walletLoad')}
              </SSText>
            )}
          </SSVStack>
          <View style={styles.actionRow}>
            <SSButtonActionsGroup
              compact
              context="ark"
              onSend={handleSend}
              onCamera={handleCamera}
              onReceive={handleReceive}
            />
          </View>
        </SSVStack>
      )}
      <TabView
        swipeEnabled={false}
        navigationState={{ index: tabIndex, routes }}
        renderScene={renderScene}
        renderTabBar={renderTabBar}
        onIndexChange={handleTabChange}
        initialLayout={{ width }}
        style={styles.tabView}
      />
      <SSSelectionActionBar
        visible={tabIndex === VTXOS_TAB_INDEX && hasSelection}
        summary={t('ark.vtxo.selectedCount', {
          count: selectedSpendableIds.length
        })}
        actions={[
          {
            icon: (
              <SSIconArrowsClockwise
                width={SELECTION_ICON_SIZE}
                height={SELECTION_ICON_SIZE}
                stroke={Colors.white}
              />
            ),
            label: t('ark.refresh.action'),
            onPress: handleRefreshSelected
          },
          {
            icon: (
              <SSIconArrowLineDown
                width={SELECTION_ICON_SIZE}
                height={SELECTION_ICON_SIZE}
                stroke={Colors.white}
              />
            ),
            label: t('ark.offboard.title'),
            onPress: handleOffboardSelected
          },
          {
            destructive: true,
            icon: (
              <SSIconSignOut
                width={SELECTION_ICON_SIZE}
                height={SELECTION_ICON_SIZE}
                stroke={Colors.error}
              />
            ),
            label: t('ark.exit.action'),
            onPress: handleEmergencyExitSelected
          }
        ]}
        onClear={handleClearSelection}
      />
      <SSCameraModal
        visible={cameraVisible}
        onClose={() => setCameraVisible(false)}
        onContentScanned={handleScanned}
        context="ark"
        title={t('ark.send.scanTitle')}
      />
      <SSModal
        visible={refreshModalVisible}
        onClose={() => setRefreshModalVisible(false)}
        label={t('common.cancel')}
        closeButtonVariant="ghost"
        fullOpacity
      >
        <SSVStack gap="lg" style={styles.modalContent}>
          <SSVStack gap="sm" itemsCenter>
            <SSText center uppercase size="md" weight="medium">
              {t('ark.refresh.confirmTitle')}
            </SSText>
            <SSText center color="muted">
              {t('ark.refresh.confirmDescription', {
                count: selectedSpendableIds.length
              })}
            </SSText>
            {refreshFeeQuery.isLoading && (
              <SSText color="muted" size="sm">
                {t('common.loading')}
              </SSText>
            )}
            {refreshFeeQuery.data ? (
              <SSText color="muted" size="sm">
                {t('ark.refresh.feeLabel', {
                  amount: formatNumber(refreshFeeQuery.data.feeSats),
                  unit: t('bitcoin.sats')
                })}
              </SSText>
            ) : null}
            {refreshFeeQuery.error ? (
              <SSText
                size="sm"
                style={{ color: Colors.warning }}
                onPress={() => refreshFeeQuery.refetch()}
              >
                {t('ark.refresh.feeUnavailable')}
              </SSText>
            ) : null}
          </SSVStack>
          <SSButton
            label={t('ark.refresh.action')}
            variant="secondary"
            loading={refreshMutation.isPending}
            disabled={refreshMutation.isPending || refreshFeeQuery.isLoading}
            onPress={handleConfirmRefresh}
          />
        </SSVStack>
      </SSModal>
      <SSModal
        visible={exitModalVisible}
        onClose={() => setExitModalVisible(false)}
        label={t('common.cancel')}
        closeButtonVariant="ghost"
        fullOpacity
      >
        <SSVStack gap="lg" style={styles.modalContent}>
          <SSVStack gap="sm" itemsCenter>
            <SSText center uppercase size="md" weight="medium">
              {t('ark.exit.confirmTitle', {
                count: selectedSpendableIds.length
              })}
            </SSText>
            <SSText center color="muted">
              {t('ark.exit.confirmDescription')}
            </SSText>
            {exitFeeQuery.isLoading && (
              <SSText color="muted" size="sm">
                {t('common.loading')}
              </SSText>
            )}
            {exitFeeQuery.data ? (
              <SSVStack gap="xxs" itemsCenter>
                <SSText color="muted" size="sm">
                  {t('ark.exit.feeLabel', {
                    amount: formatNumber(exitFeeQuery.data.feeSats),
                    feeRate: exitFeeQuery.data.feeRateSatPerVb,
                    unit: t('bitcoin.sats')
                  })}
                </SSText>
                <SSText color="muted" size="xs" center>
                  {t('ark.exit.feeHint')}
                </SSText>
              </SSVStack>
            ) : null}
            {exitFeeQuery.error ? (
              <SSText
                size="sm"
                style={{ color: Colors.warning }}
                onPress={() => exitFeeQuery.refetch()}
              >
                {t('ark.exit.feeUnavailable')}
              </SSText>
            ) : null}
          </SSVStack>
          <SSButton
            label={t('ark.exit.confirm')}
            variant="danger"
            loading={exitMutation.isPending}
            disabled={exitMutation.isPending || exitFeeQuery.isLoading}
            onPress={handleConfirmEmergencyExit}
          />
        </SSVStack>
      </SSModal>
    </SSMainLayout>
  )
}

function renderSeparator() {
  return <View style={styles.separator} />
}

const styles = StyleSheet.create({
  actionRow: {
    marginBottom: 8,
    paddingVertical: 12,
    width: '100%'
  },
  balanceContainer: {
    alignItems: 'center',
    paddingBottom: 12,
    paddingTop: 24
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 32
  },
  header: {
    paddingHorizontal: CONTENT_PADDING_HORIZONTAL
  },
  layout: {
    paddingHorizontal: 0
  },
  listContent: {
    paddingHorizontal: CONTENT_PADDING_HORIZONTAL
  },
  loaderOverlay: {
    alignItems: 'center',
    backgroundColor: Colors.transparent,
    inset: 0,
    justifyContent: 'flex-start',
    paddingTop: 16,
    position: 'absolute'
  },
  modalContent: {
    paddingVertical: 8,
    width: '100%'
  },
  movementControls: {
    paddingHorizontal: CONTENT_PADDING_HORIZONTAL,
    paddingVertical: 16
  },
  refreshesControls: {
    paddingHorizontal: CONTENT_PADDING_HORIZONTAL,
    paddingVertical: 16
  },
  sceneContainer: {
    flex: 1
  },
  separator: {
    backgroundColor: Colors.gray[800],
    height: StyleSheet.hairlineWidth
  },
  tab: {
    width: TAB_WIDTH
  },
  tabBar: {
    paddingHorizontal: CONTENT_PADDING_HORIZONTAL,
    paddingVertical: 8
  },
  tabIndicator: {
    alignSelf: 'center',
    backgroundColor: Colors.white,
    bottom: -12,
    height: 2,
    position: 'absolute',
    width: '100%'
  },
  tabLabel: {
    lineHeight: 12
  },
  tabView: {
    flex: 1
  },
  vtxoSectionHeader: {
    paddingBottom: 4,
    paddingTop: 16
  },
  vtxoSectionHeaderRow: {
    alignItems: 'center',
    paddingBottom: 4,
    paddingTop: 16
  },
  vtxoSelectAllButton: {
    flexShrink: 0
  },
  vtxoSelectAllText: {
    color: Colors.gray[75],
    textDecorationLine: 'underline'
  }
})
