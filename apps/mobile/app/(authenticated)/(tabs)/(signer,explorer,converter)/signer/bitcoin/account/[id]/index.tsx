import { useFocusEffect } from '@react-navigation/native'
import { FlashList } from '@shopify/flash-list'
import { type Network } from 'bdk-rn/lib/lib/enums'
import {
  Redirect,
  router,
  Stack,
  useLocalSearchParams,
  useRouter
} from 'expo-router'
import {
  type Dispatch,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import {
  Animated,
  Dimensions,
  Easing,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native'
import { type SceneRendererProps, TabView } from 'react-native-tab-view'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { getLastUnusedAddressFromWallet, getWalletAddresses } from '@/api/bdk'
import {
  SSIconBlackIndicator,
  SSIconBubbles,
  SSIconChartSettings,
  SSIconChatBubble,
  SSIconCollapse,
  SSIconExpand,
  SSIconEyeOff,
  SSIconEyeOn,
  SSIconGreenIndicator,
  SSIconHistoryChart,
  SSIconKeys,
  SSIconList,
  SSIconMenu,
  SSIconOutgoing,
  SSIconRefresh,
  SSIconTable,
  SSIconYellowIndicator
} from '@/components/icons'
import SSActionButton from '@/components/SSActionButton'
import { AddressCard } from '@/components/SSAddressCard'
import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSBalanceChangeBar from '@/components/SSBalanceChangeBar'
import SSBlockFeePriceRow from '@/components/SSBlockFeePriceRow'
import SSBubbleChart from '@/components/SSBubbleChart'
import SSButton from '@/components/SSButton'
import SSButtonActionsGroup from '@/components/SSButtonActionsGroup'
import SSCameraModal from '@/components/SSCameraModal'
import SSHistoryChart from '@/components/SSHistoryChart'
import SSIconButton from '@/components/SSIconButton'
import SSLoader from '@/components/SSLoader'
import SSNFCModal from '@/components/SSNFCModal'
import SSPaste from '@/components/SSPaste'
import SSSeparator from '@/components/SSSeparator'
import SSSortDirectionToggle from '@/components/SSSortDirectionToggle'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import SSTransactionCard from '@/components/SSTransactionCard'
import SSUtxoCard from '@/components/SSUtxoCard'
import { useBitcoinContentHandler } from '@/hooks/useBitcoinContentHandler'
import { useContentHandler } from '@/hooks/useContentHandler'
import useGetAccountAddress from '@/hooks/useGetAccountAddress'
import useGetAccountWallet from '@/hooks/useGetAccountWallet'
import { useNetworkInfo } from '@/hooks/useNetworkInfo'
import useNostrSync from '@/hooks/useNostrSync'
import useSyncAccountWithAddress from '@/hooks/useSyncAccountWithAddress'
import useSyncAccountWithWallet from '@/hooks/useSyncAccountWithWallet'
import useVerifyConnection from '@/hooks/useVerifyConnection'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { Colors, Sizes } from '@/styles'
import { type Direction } from '@/types/logic/sort'
import { type Account } from '@/types/models/Account'
import { type Address } from '@/types/models/Address'
import { type Utxo } from '@/types/models/Utxo'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { formatAddress, formatNumber } from '@/utils/format'
import { parseAccountAddressesDetails } from '@/utils/parse'
import { compareTimestamp, sortTransactions } from '@/utils/sort'
import { time } from '@/utils/time'
import { getUtxoOutpoint } from '@/utils/utxo'

const TX_STAGGER_DELAY_MS = 70
const TX_STAGGER_DURATION_MS = 320

function DraftTransactionCard({ accountId }: { accountId: string }) {
  const router = useRouter()
  const [inputs, outputs, fee, clearTransaction] = useTransactionBuilderStore(
    useShallow((state) => [
      state.inputs,
      state.outputs,
      state.fee,
      state.clearTransaction
    ])
  )

  const totalOut = outputs.reduce((sum, o) => sum + o.amount, 0)

  return (
    <TouchableOpacity
      onPress={() =>
        router.navigate(
          `/signer/bitcoin/account/${accountId}/signAndSend/ioPreview`
        )
      }
      activeOpacity={0.7}
    >
      <SSVStack
        gap="none"
        style={{
          paddingHorizontal: 0,
          paddingTop: 4,
          paddingBottom: 12,
          opacity: 0.85
        }}
      >
        <SSHStack justifyBetween>
          <SSText color="muted" size="xs">
            {t('transaction.draft')}
          </SSText>
          <SSText size="xs" style={{ color: Colors.warning }}>
            {t('transaction.unsent')}
          </SSText>
        </SSHStack>
        <SSHStack
          justifyBetween
          style={{ alignItems: 'flex-end', marginTop: 5 }}
        >
          <SSHStack gap="sm" style={{ alignItems: 'center' }}>
            <SSIconOutgoing height={21} width={21} />
            <SSText
              size="4xl"
              weight="light"
              style={{ color: Colors.gray[400] }}
            >
              {totalOut > 0 ? totalOut.toLocaleString() : '--'}
            </SSText>
            <SSText color="muted" size="sm">
              {t('bitcoin.sats')}
            </SSText>
          </SSHStack>
        </SSHStack>
        <SSHStack justifyBetween style={{ marginTop: 2 }}>
          <SSText size="xs" color="muted">
            {inputs.size} {t('transaction.inputs')}
            {outputs.length > 0
              ? `, ${outputs.length} ${t('transaction.outputs')}`
              : ''}
            {fee > 0 ? `, ${fee.toLocaleString()} ${t('transaction.fee')}` : ''}
          </SSText>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation()
              clearTransaction()
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <SSText size="xs" style={{ color: Colors.gray[500] }}>
              {t('transaction.discard')}
            </SSText>
          </TouchableOpacity>
        </SSHStack>
      </SSVStack>
    </TouchableOpacity>
  )
}

function TransactionStaggerItem({
  index,
  children
}: {
  index: number
  children: React.ReactNode
}) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(12)).current

  useEffect(() => {
    const delay = index * TX_STAGGER_DELAY_MS
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: TX_STAGGER_DURATION_MS,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: TX_STAGGER_DURATION_MS,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true
        })
      ]).start()
    }, delay)
    return () => clearTimeout(timer)
  }, [index, opacity, translateY])

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }]
      }}
    >
      {children}
    </Animated.View>
  )
}

type TotalTransactionsProps = {
  account: Account
  handleOnRefresh: () => Promise<void>
  handleOnExpand: (state: boolean) => Promise<void>
  expand: boolean
  setSortDirection: Dispatch<React.SetStateAction<Direction>>
  refreshing: boolean
  sortDirection: Direction
  blockchainHeight: number
}

function TotalTransactions({
  account,
  handleOnRefresh,
  handleOnExpand,
  expand,
  setSortDirection,
  refreshing,
  blockchainHeight,
  sortDirection
}: TotalTransactionsProps) {
  const [draftAccountId, draftInputs, draftOutputs, draftBroadcasted] =
    useTransactionBuilderStore(
      useShallow((state) => [
        state.accountId,
        state.inputs,
        state.outputs,
        state.broadcasted
      ])
    )

  const hasDraft =
    draftAccountId === account.id &&
    !draftBroadcasted &&
    (draftInputs.size > 0 || draftOutputs.length > 0)
  const router = useRouter()

  const [btcPrice, fiatCurrency] = usePriceStore(
    useShallow((state) => [state.btcPrice, state.fiatCurrency])
  )

  const sortedTransactions = useMemo(() => {
    return sortTransactions([...account.transactions], sortDirection)
  }, [account.transactions, sortDirection])

  const chartTransactions = useMemo(() => {
    return sortTransactions([...account.transactions], 'desc')
  }, [account.transactions])

  const transactionBalances = useMemo(() => {
    let balance = 0
    const balances = sortedTransactions.map((tx) => {
      const received = tx.received || 0
      const sent = tx.sent || 0
      balance = balance + received - sent
      return balance
    })

    return balances.reverse()
  }, [sortedTransactions])

  const maxBalance = useMemo(() => {
    if (transactionBalances.length === 0) return 0
    return Math.max(...transactionBalances)
  }, [transactionBalances])

  const [showHistoryChart, setShowHistoryChart] = useState<boolean>(false)

  return (
    <SSMainLayout style={{ paddingTop: 0, paddingHorizontal: 0 }}>
      <SSHStack
        justifyBetween
        style={{ paddingVertical: 16, paddingHorizontal: 16 }}
      >
        <SSHStack>
          <SSIconButton onPress={() => handleOnRefresh()}>
            <SSIconRefresh height={18} width={22} />
          </SSIconButton>
          <SSIconButton onPress={() => handleOnExpand(!expand)}>
            {expand ? (
              <SSIconCollapse height={15} width={15} />
            ) : (
              <SSIconExpand height={15} width={16} />
            )}
          </SSIconButton>
          {showHistoryChart && (
            <SSIconButton
              onPress={() => router.navigate(`/settings/features/historyChart`)}
            >
              <SSIconChartSettings width={22} height={18} />
            </SSIconButton>
          )}
        </SSHStack>
        <SSText color="muted">{t('account.parentAccountActivity')}</SSText>
        <SSHStack>
          <SSIconButton onPress={() => setShowHistoryChart((prev) => !prev)}>
            {showHistoryChart ? (
              <SSIconMenu width={18} height={18} />
            ) : (
              <SSIconHistoryChart width={18} height={18} />
            )}
          </SSIconButton>
          <SSSortDirectionToggle
            onDirectionChanged={(direction) => setSortDirection(direction)}
          />
        </SSHStack>
      </SSHStack>
      {showHistoryChart && sortedTransactions.length > 0 ? (
        <View style={{ flex: 1, zIndex: -1 }}>
          <SSHistoryChart
            transactions={chartTransactions}
            utxos={account.utxos}
            blockchainHeight={blockchainHeight}
          />
        </View>
      ) : (
        <SSVStack
          style={{
            flex: 1,
            marginLeft: 16,
            marginRight: 2,
            paddingRight: 14,
            height: 400,
            minHeight: 200
          }}
          gap={expand ? 'sm' : 'md'}
        >
          <View style={styles.listWithLoader}>
            <FlashList
              data={sortedTransactions.slice().reverse()}
              ListHeaderComponent={
                hasDraft ? (
                  <DraftTransactionCard accountId={account.id} />
                ) : null
              }
              renderItem={({ item, index }) => (
                <TransactionStaggerItem index={index}>
                  <SSVStack gap="none">
                    <SSBalanceChangeBar
                      transaction={item}
                      balance={transactionBalances[index]}
                      maxBalance={maxBalance}
                    />
                    <SSTransactionCard
                      btcPrice={btcPrice}
                      fiatCurrency={fiatCurrency}
                      transaction={item}
                      expand={expand}
                      walletBalance={transactionBalances[index]}
                      blockHeight={blockchainHeight}
                      link={`/signer/bitcoin/account/${account.id}/transaction/${item.id}`}
                    />
                  </SSVStack>
                </TransactionStaggerItem>
              )}
              estimatedItemSize={120}
              ListEmptyComponent={
                <SSVStack style={{ alignItems: 'center', paddingTop: 50 }}>
                  <SSText color="muted">No transactions</SSText>
                </SSVStack>
              }
              keyExtractor={(item) => item.id}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleOnRefresh}
                  tintColor={Colors.transparent}
                  colors={[Colors.transparent]}
                  progressBackgroundColor={Colors.transparent}
                  progressViewOffset={9999}
                />
              }
            />
            {refreshing && (
              <View style={styles.loaderOverlay} pointerEvents="none">
                <SSLoader size={32} />
              </View>
            )}
          </View>
        </SSVStack>
      )}
    </SSMainLayout>
  )
}

type DerivedAddressesProps = {
  account: Account
  setSortDirection: Function
  sortDirection: Direction
  handleOnExpand: (state: boolean) => Promise<void>
  expand: boolean
  setChange: Function
  change: boolean
  perPage?: number
}

const SCREEN_WIDTH = Dimensions.get('window').width
const ADDRESS_TABLE_WIDTH = SCREEN_WIDTH * 1.2

function SSAddressTable({
  addresses,
  renderItem,
  isMultiAddressWatchOnly,
  isLoadingAddresses,
  onLoadMore
}: {
  addresses: Address[]
  renderItem: ({ item }: { item: Address }) => React.ReactElement
  isMultiAddressWatchOnly: boolean
  isLoadingAddresses: boolean
  onLoadMore: () => void
}) {
  return (
    <ScrollView style={{ marginTop: 10 }} horizontal>
      <SSVStack gap="none" style={{ width: ADDRESS_TABLE_WIDTH }}>
        <SSHStack style={addressListStyles.headerRow}>
          <SSText
            style={[
              addressListStyles.headerText,
              addressListStyles.columnIndex
            ]}
          >
            #
          </SSText>
          <SSText
            style={[
              addressListStyles.headerText,
              addressListStyles.columnAddress
            ]}
          >
            {t('bitcoin.address')}
          </SSText>
          <SSText
            style={[
              addressListStyles.headerText,
              addressListStyles.columnLabel
            ]}
          >
            {t('common.label')}
          </SSText>
          <SSText
            style={[addressListStyles.headerText, addressListStyles.columnSats]}
          >
            {t('address.list.table.balance')}
          </SSText>
          <SSText
            style={[addressListStyles.headerText, addressListStyles.columnTxs]}
          >
            {t('address.list.table.tx')}
          </SSText>
          <SSText
            style={[
              addressListStyles.headerText,
              addressListStyles.columnUtxos
            ]}
          >
            {t('address.list.table.utxo')}
          </SSText>
        </SSHStack>
        <FlashList
          data={addresses}
          renderItem={renderItem}
          estimatedItemSize={150}
          keyExtractor={(item) =>
            `${item.index || ''}:${item.address}:${item.keychain || ''}`
          }
          removeClippedSubviews
          ListFooterComponent={
            !isMultiAddressWatchOnly ? (
              <SSButton
                variant="outline"
                uppercase
                style={{
                  marginTop: 10,
                  width: SCREEN_WIDTH * 0.88
                }}
                label={t('common.loadMore')}
                disabled={isLoadingAddresses}
                onPress={onLoadMore}
              />
            ) : null
          }
        />
      </SSVStack>
    </ScrollView>
  )
}

function SSAddressList({
  addresses,
  accountId,
  isMultiAddressWatchOnly,
  isLoadingAddresses,
  onLoadMore
}: {
  addresses: Address[]
  accountId: string
  isMultiAddressWatchOnly: boolean
  isLoadingAddresses: boolean
  onLoadMore: () => void
}) {
  return (
    <ScrollView>
      <SSVStack style={{ paddingVertical: 10 }}>
        {addresses.map((address, index) => {
          const link = `/signer/bitcoin/account/${accountId}/address/${address.address}`
          return (
            <SSVStack key={address.address} gap="xs">
              {index > 0 && <SSSeparator color="gradient" />}
              <TouchableOpacity onPress={() => router.navigate(link)}>
                <AddressCard address={{ index, ...address }} />
              </TouchableOpacity>
            </SSVStack>
          )
        })}
        {!isMultiAddressWatchOnly && (
          <SSButton
            variant="outline"
            uppercase
            style={{ marginTop: 10, alignSelf: 'stretch' }}
            label={t('common.loadMore')}
            disabled={isLoadingAddresses}
            onPress={onLoadMore}
          />
        )}
      </SSVStack>
    </ScrollView>
  )
}

function DerivedAddresses({
  account,
  handleOnExpand,
  setChange,
  change,
  expand,
  setSortDirection,
  perPage = 10
}: DerivedAddressesProps) {
  const wallet = useGetAccountWallet(account.id!)
  const network = useBlockchainStore(
    (state) => state.selectedNetwork
  ) as Network
  const updateAccount = useAccountsStore((state) => state.updateAccount)

  const _windowDimensions = useWindowDimensions()

  const [addressPath, setAddressPath] = useState('')
  const [addressCount, setAddressCount] = useState(
    Math.max(1, Math.ceil(account.addresses.length / perPage)) * perPage
  )
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false)
  const [addressView, setAddressView] = useState<'table' | 'list'>('table')

  const isUpdatingAddresses = useRef(false)
  const isMultiAddressWatchOnly = useMemo(() => {
    return (
      account.keys.length > 1 &&
      account.keys[0].creationType === 'importAddress'
    )
  }, [account])

  function updateDerivationPath() {
    if (isMultiAddressWatchOnly) return
    if (account.keys[0].derivationPath)
      setAddressPath(`${account.keys[0].derivationPath}/${change ? 1 : 0}`)
  }

  function loadExactAccountAddresses() {
    setAddressCount(account.addresses.length)
  }

  function trimLabel(label: string | undefined): string {
    if (!label) return t('transaction.noLabel')
    return label.length > 14 ? `${label.substring(0, 14)}...` : label
  }

  async function refreshAddresses() {
    if (isMultiAddressWatchOnly) {
      loadExactAccountAddresses()
      return
    }

    let addresses = await getWalletAddresses(wallet!, network!, addressCount)
    addresses = parseAccountAddressesDetails({ ...account, addresses })
    updateAccount({ ...account, addresses })
  }

  async function loadMoreAddresses() {
    if (isMultiAddressWatchOnly) {
      loadExactAccountAddresses()
      return
    }

    const newAddressCount =
      account.addresses.length < addressCount
        ? addressCount
        : addressCount + perPage
    setAddressCount(newAddressCount)
    setIsLoadingAddresses(true)

    let addrList = await getWalletAddresses(wallet!, network!, newAddressCount)
    addrList = parseAccountAddressesDetails({
      ...account,
      addresses: addrList
    })
    setIsLoadingAddresses(false)
    updateAccount({ ...account, addresses: addrList })
  }

  async function updateAddresses() {
    if (!wallet || isLoadingAddresses || isUpdatingAddresses.current) return

    isUpdatingAddresses.current = true

    try {
      const result = await getLastUnusedAddressFromWallet(wallet!)

      if (!result) return
      const minItems = Math.max(1, Math.ceil(result.index / perPage)) * perPage

      if (minItems <= addressCount) return

      if (account.addresses.length >= addressCount) {
        let newAddresses = await getWalletAddresses(
          wallet!,
          network!,
          addressCount
        )
        newAddresses = parseAccountAddressesDetails({
          ...account,
          addresses: newAddresses
        })
        updateAccount({ ...account, addresses: newAddresses })
        return
      }

      let newAddresses = await getWalletAddresses(wallet!, network!, minItems)
      newAddresses = parseAccountAddressesDetails({
        ...account,
        addresses: newAddresses
      })
      setAddressCount(minItems)
      updateAccount({ ...account, addresses: newAddresses })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update addresses'
      )
    } finally {
      isUpdatingAddresses.current = false
    }
  }

  useEffect(() => {
    updateDerivationPath()
  }, [change]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    updateAddresses()
  }, [account.id, account.keys[0]?.derivationPath]) // eslint-disable-line react-hooks/exhaustive-deps

  const renderItem = useCallback(
    ({ item }: { item: Address }) => (
      <TouchableOpacity
        onPress={() =>
          router.navigate(
            `/signer/bitcoin/account/${account.id}/address/${item.address}`
          )
        }
      >
        <SSHStack style={addressListStyles.row}>
          <SSText
            style={[addressListStyles.indexText, addressListStyles.columnIndex]}
          >
            {item.index}
          </SSText>
          <SSText
            type="mono"
            style={[
              addressListStyles.addressText,
              addressListStyles.columnAddress
            ]}
          >
            {formatAddress(item.address, 6)}
          </SSText>
          <SSText
            style={[
              addressListStyles.columnLabel,
              { color: item.label ? '#fff' : '#333' }
            ]}
          >
            {trimLabel(item.label)}
          </SSText>
          <SSText
            style={[
              addressListStyles.columnSats,
              { color: item.summary.balance === 0 ? '#333' : '#fff' }
            ]}
          >
            <SSStyledSatText amount={item.summary.balance} textSize="xs" />
          </SSText>
          <SSText
            style={[
              addressListStyles.columnTxs,
              { color: item.summary.transactions === 0 ? '#333' : '#fff' }
            ]}
          >
            {item.summary.transactions}
          </SSText>
          <SSText
            style={[
              addressListStyles.columnUtxos,
              { color: item.summary.utxos === 0 ? '#333' : '#fff' }
            ]}
          >
            {item.summary.utxos}
          </SSText>
        </SSHStack>
      </TouchableOpacity>
    ),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  )

  return (
    <SSMainLayout style={addressListStyles.container}>
      <SSHStack justifyBetween style={addressListStyles.header}>
        <SSHStack>
          <SSIconButton onPress={refreshAddresses}>
            <SSIconRefresh height={18} width={22} />
          </SSIconButton>
          <SSIconButton onPress={() => handleOnExpand(!expand)}>
            {expand ? (
              <SSIconCollapse height={15} width={15} />
            ) : (
              <SSIconExpand height={15} width={15} />
            )}
          </SSIconButton>
          <SSIconButton
            onPress={() =>
              setAddressView(addressView === 'table' ? 'list' : 'table')
            }
          >
            {addressView === 'table' ? (
              <SSIconList height={15} width={15} />
            ) : (
              <SSIconTable height={15} width={15} />
            )}
          </SSIconButton>
        </SSHStack>
        {!isMultiAddressWatchOnly && (
          <SSHStack gap="sm">
            <SSText color="muted" uppercase>
              {t('receive.path')}
            </SSText>
            <SSText>{addressPath}</SSText>
          </SSHStack>
        )}
        <SSHStack gap="sm" style={{ width: 40, justifyContent: 'flex-end' }}>
          <SSSortDirectionToggle
            onDirectionChanged={() => setSortDirection()}
          />
        </SSHStack>
      </SSHStack>
      {!isMultiAddressWatchOnly && (
        <SSHStack
          gap="md"
          justifyBetween
          style={addressListStyles.receiveChangeContainer}
        >
          {[t('accounts.receive'), t('accounts.change')].map((type, index) => (
            <SSHStack key={type} style={{ flex: 1, justifyContent: 'center' }}>
              <SSButton
                style={{
                  borderColor: change === (index === 1) ? '#fff' : '#333'
                }}
                uppercase
                onPress={() => setChange(index === 1)}
                label={type}
                variant="outline"
              />
            </SSHStack>
          ))}
        </SSHStack>
      )}
      {addressView === 'table' && (
        <SSAddressTable
          addresses={account?.addresses.filter(
            (address) =>
              isMultiAddressWatchOnly ||
              (change
                ? address.keychain === 'internal'
                : address.keychain === 'external')
          )}
          renderItem={renderItem}
          isMultiAddressWatchOnly={isMultiAddressWatchOnly}
          isLoadingAddresses={isLoadingAddresses}
          onLoadMore={loadMoreAddresses}
        />
      )}
      {addressView === 'list' && (
        <SSAddressList
          addresses={account?.addresses.filter(
            (address) =>
              isMultiAddressWatchOnly ||
              (change
                ? address.keychain === 'internal'
                : address.keychain === 'external')
          )}
          accountId={account.id}
          isMultiAddressWatchOnly={isMultiAddressWatchOnly}
          isLoadingAddresses={isLoadingAddresses}
          onLoadMore={loadMoreAddresses}
        />
      )}
      {isMultiAddressWatchOnly && (
        <SSButton
          variant="outline"
          uppercase
          style={{ marginTop: 10 }}
          label={t('address.list.btn.manage')}
          onPress={() =>
            router.navigate(
              `/signer/bitcoin/account/${account.id}/settings/manageAddresses`
            )
          }
        />
      )}
    </SSMainLayout>
  )
}

type SpendableOutputsProps = {
  account: Account
  handleOnRefresh: () => Promise<void>
  handleOnExpand: (state: boolean) => Promise<void>
  expand: boolean
  setSortDirection: Dispatch<React.SetStateAction<Direction>>
  refreshing: boolean
  sortUtxos: (utxos: Utxo[]) => Utxo[]
}

function SpendableOutputs({
  account,
  handleOnRefresh,
  setSortDirection,
  handleOnExpand,
  expand,
  refreshing,
  sortUtxos
}: SpendableOutputsProps) {
  const router = useRouter()
  const { width, height } = useWindowDimensions()

  const [view, setView] = useState('list')

  const halfHeight = height / 2
  const horizontalPadding = 48
  const GRAPH_HEIGHT = halfHeight
  const GRAPH_WIDTH = width - horizontalPadding

  const totalBalance = useMemo(() => {
    return account.utxos.reduce((sum, u) => sum + u.value, 0)
  }, [account.utxos])

  return (
    <SSMainLayout style={{ paddingTop: 0 }}>
      <SSHStack justifyBetween style={{ paddingVertical: 16 }}>
        <SSHStack>
          <SSIconButton onPress={() => {}}>
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
        <SSText color="muted">{t('account.parentAccountActivity')}</SSText>
        <SSHStack>
          {view === 'list' && (
            <SSIconButton onPress={() => setView('bubbles')}>
              <SSIconBubbles height={16} width={16} />
            </SSIconButton>
          )}
          {view === 'bubbles' && (
            <SSIconButton onPress={() => setView('list')}>
              <SSIconList height={16} width={16} />
            </SSIconButton>
          )}
          <SSSortDirectionToggle
            onDirectionChanged={(direction) => setSortDirection(direction)}
          />
        </SSHStack>
      </SSHStack>
      {view === 'list' && (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleOnRefresh}
              colors={[Colors.gray[950]]}
              progressBackgroundColor={Colors.white}
            />
          }
        >
          <SSVStack style={{ marginBottom: 16 }}>
            {sortUtxos([...account.utxos]).map((utxo) => {
              const idx = account.addresses.findIndex(
                (a) =>
                  (a.address || '').trim() === (utxo.addressTo || '').trim()
              )
              const addressEntry = idx >= 0 ? account.addresses[idx] : null
              const addressIndex =
                addressEntry !== null ? addressEntry.index ?? idx : undefined
              return (
                <SSVStack gap="xs" key={getUtxoOutpoint(utxo)}>
                  <SSUtxoCard
                    utxo={utxo}
                    totalBalance={totalBalance}
                    addressIndex={addressIndex}
                  />
                </SSVStack>
              )
            })}
          </SSVStack>
        </ScrollView>
      )}
      <View style={{ flex: 1 }}>
        {view === 'bubbles' && (
          <SSBubbleChart
            utxos={[...account.utxos]}
            canvasSize={{ width: GRAPH_WIDTH, height: GRAPH_HEIGHT }}
            inputs={[]}
            onPress={({ txid, vout }: Utxo) =>
              router.navigate(
                `/signer/bitcoin/account/${account.id}/transaction/${txid}/utxo/${vout}`
              )
            }
          />
        )}
      </View>
    </SSMainLayout>
  )
}

function SatsInMempool({
  account,
  blockchainHeight
}: {
  account: Account
  blockchainHeight: number
}) {
  const [btcPrice, fiatCurrency] = usePriceStore(
    useShallow((state) => [state.btcPrice, state.fiatCurrency])
  )

  const mempoolTransactions = useMemo(
    () => account.transactions.filter((tx) => !tx.blockHeight),
    [account.transactions]
  )

  if (mempoolTransactions.length === 0) {
    return (
      <SSMainLayout>
        <SSVStack style={{ flex: 1, alignItems: 'center', paddingTop: 50 }}>
          <SSText color="muted">{t('accounts.noSatsOnMempool')}</SSText>
        </SSVStack>
      </SSMainLayout>
    )
  }

  return (
    <SSMainLayout>
      <FlashList
        data={mempoolTransactions}
        keyExtractor={(item) => item.id}
        estimatedItemSize={160}
        renderItem={({ item }) => (
          <SSVStack gap="sm" style={{ paddingBottom: 16 }}>
            <SSTransactionCard
              transaction={item}
              blockHeight={blockchainHeight}
              btcPrice={btcPrice}
              fiatCurrency={fiatCurrency}
              expand={false}
              link={`/signer/bitcoin/account/${account.id}/transaction/${item.id}`}
            />
            <SSHStack gap="sm">
              <SSButton
                label={t('bitcoin.rbf')}
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => toast.info(t('common.comingSoon'))}
              />
              <SSButton
                label={t('bitcoin.accelerate')}
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => toast.info(t('common.comingSoon'))}
              />
            </SSHStack>
            <SSSeparator />
          </SSVStack>
        )}
      />
    </SSMainLayout>
  )
}

export default function AccountView() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()
  const { width } = useWindowDimensions()

  const [updateAccount, account, syncStatus, tasksDone, totalTasks] =
    useAccountsStore(
      useShallow((state) => [
        state.updateAccount,
        state.accounts.find((a) => a.id === id),
        state.accounts.find((a) => a.id === id)?.syncStatus,
        state.accounts.find((a) => a.id === id)?.syncProgress?.tasksDone,
        state.accounts.find((a) => a.id === id)?.syncProgress?.totalTasks
      ])
    )

  const hasUnreadMessages = useMemo(
    () => account?.nostr?.dms?.some((dm) => dm.read === false) ?? false,
    [account?.nostr?.dms]
  )

  const wallet = useGetAccountWallet(id!)
  const watchOnlyWalletAddress = useGetAccountAddress(id!)

  const isMultiAddressWatchOnly = useMemo(() => {
    return (
      account &&
      account.keys.length > 1 &&
      account.keys[0].creationType === 'importAddress'
    )
  }, [account])

  const [currencyUnit, useZeroPadding, privacyMode, togglePrivacyMode] =
    useSettingsStore(
      useShallow((state) => [
        state.currencyUnit,
        state.useZeroPadding,
        state.privacyMode,
        state.togglePrivacyMode
      ])
    )

  const [fiatCurrency, satsToFiat, fetchPrices, btcPrice] = usePriceStore(
    useShallow((state) => [
      state.fiatCurrency,
      state.satsToFiat,
      state.fetchPrices,
      state.btcPrice
    ])
  )
  const [getBlockchainHeight, mempoolUrl, connectionMode, autoConnectDelay] =
    useBlockchainStore(
      useShallow((state) => [
        state.getBlockchainHeight,
        state.configsMempool['bitcoin'],
        state.configs[state.selectedNetwork].config.connectionMode,
        state.configs[state.selectedNetwork].config.timeDiffBeforeAutoSync
      ])
    )
  const { syncAccountWithWallet } = useSyncAccountWithWallet()
  const { syncAccountWithAddress } = useSyncAccountWithAddress()
  const { fetchOnce, startSync, stopSync } = useNostrSync()

  const [refreshing, setRefreshing] = useState(false)
  const [expand, setExpand] = useState(false)
  const [change, setChange] = useState(false)
  const [sortDirectionTransactions, setSortDirectionTransactions] =
    useState<Direction>('desc')
  const [sortDirectionUtxos, setSortDirectionUtxos] =
    useState<Direction>('desc')
  const [sortDirectionDerivedAddresses, setSortDirectionDerivedAddresses] =
    useState<Direction>('desc')
  const [blockchainHeight, setBlockchainHeight] = useState<number>(0)

  const tabs = [
    { key: 'totalTransactions' },
    { key: 'derivedAddresses' },
    { key: 'spendableOutputs' },
    { key: 'satsInMempool' }
  ]
  const [tabIndex, setTabIndex] = useState(0)
  const animationValue = useRef(new Animated.Value(0)).current

  const [connectionState, , isPrivateConnection, connectionParts] =
    useVerifyConnection()
  const {
    blockHeight: networkBlockHeight,
    nextBlockFee,
    blockHeightSource
  } = useNetworkInfo()

  const bitcoinContentHandler = useBitcoinContentHandler({
    accountId: id!,
    account: account!
  })

  const contentHandler = useContentHandler({
    context: 'bitcoin',
    onContentScanned: bitcoinContentHandler.handleContentScanned,
    onSend: bitcoinContentHandler.handleSend,
    onReceive: bitcoinContentHandler.handleReceive
  })

  const { closeCameraModal, closeNFCModal, closePasteModal } = contentHandler
  useFocusEffect(
    useCallback(() => {
      return () => {
        closeCameraModal()
        closeNFCModal()
        closePasteModal()
      }
    }, [closeCameraModal, closeNFCModal, closePasteModal])
  )

  useEffect(() => {
    // do not auto-fetch wallet upon the following conditions:
    // - variables have not been initalized
    // - connection mode is manual
    // - wallet was recently synced already
    if (!wallet || !account || connectionMode !== 'auto') return

    const { lastSyncedAt } = account
    const now = time.now()
    if (
      lastSyncedAt &&
      now > time.minutesAfter(lastSyncedAt, autoConnectDelay)
    ) {
      return
    }

    handleOnRefresh()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const hasNostrReady = Boolean(
    account?.nostr?.autoSync &&
      account?.nostr?.relays?.length &&
      account?.nostr?.deviceNsec &&
      account?.nostr?.deviceNpub
  )

  // Keep the Nostr subscription open for the entire account session.
  // index.tsx stays mounted (not just focused) while navigating deeper into
  // the account stack, so useEffect cleanup only fires on true account exit.
  useEffect(() => {
    if (hasNostrReady && account) {
      startSync(account)
    }

    return () => {
      if (id) stopSync(id)
    }
  }, [id, account, hasNostrReady, startSync, stopSync])

  // Memoize headerRight so React Navigation doesn't receive a new function
  // reference on every DM update, which would interrupt in-progress tap gestures.
  const headerRight = useCallback(
    () => (
      <SSHStack gap="sm">
        {account?.nostr?.autoSync && (
          <SSIconButton
            onPress={() =>
              router.navigate(
                `/signer/bitcoin/account/${id}/settings/nostr/devicesGroupChat`
              )
            }
          >
            <View style={addressListStyles.unreadBadgeWrapper}>
              <SSIconChatBubble height={15} width={15} />
              {hasUnreadMessages && (
                <View
                  pointerEvents="none"
                  style={addressListStyles.unreadBadgeDot}
                />
              )}
            </View>
          </SSIconButton>
        )}
        <SSIconButton onPress={togglePrivacyMode}>
          {privacyMode ? (
            <SSIconEyeOff height={18} width={18} />
          ) : (
            <SSIconEyeOn height={18} width={18} />
          )}
        </SSIconButton>
        <SSIconButton
          style={{ marginRight: 8 }}
          onPress={() =>
            router.navigate(`/signer/bitcoin/account/${id}/settings`)
          }
        >
          <SSIconKeys height={18} width={18} />
        </SSIconButton>
      </SSHStack>
    ),
    [
      account?.nostr?.autoSync,
      hasUnreadMessages,
      id,
      privacyMode,
      router,
      togglePrivacyMode
    ] // eslint-disable-line react-hooks/exhaustive-deps
  )

  if (!account) return <Redirect href="/" />

  const balanceTextSize =
    account.summary.balance > 1_000_000_000
      ? ('4xl' as const)
      : ('6xl' as const)

  const renderScene = ({
    route
  }: SceneRendererProps & { route: { key: string } }) => {
    switch (route.key) {
      case 'totalTransactions':
        return (
          <TotalTransactions
            account={account}
            handleOnRefresh={handleOnRefresh}
            handleOnExpand={handleOnExpand}
            expand={expand}
            setSortDirection={setSortDirectionTransactions}
            refreshing={refreshing}
            sortDirection={sortDirectionTransactions}
            blockchainHeight={blockchainHeight}
          />
        )
      case 'derivedAddresses':
        return (
          <DerivedAddresses
            account={account}
            handleOnExpand={handleOnExpand}
            setChange={setChange}
            expand={expand}
            change={change}
            setSortDirection={setSortDirectionDerivedAddresses}
            sortDirection={sortDirectionDerivedAddresses}
          />
        )
      case 'spendableOutputs':
        return (
          <SpendableOutputs
            account={account}
            handleOnRefresh={handleOnRefresh}
            handleOnExpand={handleOnExpand}
            expand={expand}
            setSortDirection={setSortDirectionUtxos}
            refreshing={refreshing}
            sortUtxos={sortUtxos}
          />
        )
      case 'satsInMempool':
        return (
          <SatsInMempool
            account={account}
            blockchainHeight={blockchainHeight}
          />
        )
      default:
        return null
    }
  }

  function animateTransition(expandState: boolean) {
    Animated.timing(animationValue, {
      toValue: expandState ? 1 : 0,
      duration: 300,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false
    }).start()
  }

  function sortUtxos(utxos: Utxo[]) {
    return utxos.sort((utxo1, utxo2) =>
      sortDirectionUtxos === 'asc'
        ? compareTimestamp(utxo1.timestamp, utxo2.timestamp)
        : compareTimestamp(utxo2.timestamp, utxo1.timestamp)
    )
  }

  async function refreshBlockchainHeight() {
    const height = await getBlockchainHeight()
    setBlockchainHeight(height)
  }

  async function refreshAccount() {
    if (!account) return

    const isImportAddress = account.keys[0].creationType === 'importAddress'

    if (isImportAddress && !watchOnlyWalletAddress) return
    if (!isImportAddress && !wallet) return

    try {
      const updatedAccount = !isImportAddress
        ? await syncAccountWithWallet(account, wallet!)
        : await syncAccountWithAddress(account)
      updateAccount(updatedAccount)
    } catch (error) {
      toast.error((error as Error).message)
    }
  }

  function refreshAccountLabels() {
    if (!account) return
    // Fire-and-forget - don't block refresh completion for Nostr sync
    if (account.nostr?.autoSync) {
      fetchOnce(account)
    }
  }

  async function handleOnRefresh() {
    setRefreshing(true)
    await fetchPrices(mempoolUrl)
    await refreshBlockchainHeight()
    await refreshAccount()
    // Fire-and-forget - don't block refresh completion for Nostr sync
    refreshAccountLabels()
    setRefreshing(false)
  }

  async function handleOnExpand(state: boolean) {
    setExpand(state)
    animateTransition(state)
  }

  if (!account) return <Redirect href="/" />

  // TODO: Handle tab indicator | https://reactnavigation.org/docs/tab-view/#renderindicator
  const renderTab = () => {
    const isImportAddress = account.keys[0].creationType === 'importAddress'
    const tabWidth =
      isImportAddress && account.keys.length === 1 ? '33.33%' : '25%'

    return (
      <>
        {!expand && (
          <SSHStack
            gap="none"
            style={{ paddingVertical: 8, paddingHorizontal: '5%' }}
          >
            <SSActionButton
              style={{ width: tabWidth }}
              onPress={() => setTabIndex(0)}
            >
              <SSVStack gap="none">
                <SSText center size="lg">
                  {account.summary.numberOfTransactions}
                </SSText>
                <SSText center color="muted" style={{ lineHeight: 12 }}>
                  {t('accounts.totalTransactions')}
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
            {(!isImportAddress || account.keys.length > 1) && (
              <SSActionButton
                style={{ width: tabWidth }}
                onPress={() => setTabIndex(1)}
              >
                <SSVStack gap="none">
                  <SSText center size="lg">
                    {account.summary.numberOfAddresses}
                  </SSText>
                  <SSText center color="muted" style={{ lineHeight: 12 }}>
                    {isMultiAddressWatchOnly
                      ? t('accounts.watchedAddresses')
                      : t('accounts.derivedAddresses')}
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
            )}
            <SSActionButton
              style={{ width: tabWidth }}
              onPress={() => setTabIndex(2)}
            >
              <SSVStack gap="none">
                <SSText center size="lg">
                  {account.summary.numberOfUtxos}
                </SSText>
                <SSText center color="muted" style={{ lineHeight: 12 }}>
                  {t('accounts.spendableOutputs')}
                </SSText>
                {tabIndex === 2 && (
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
              onPress={() => setTabIndex(3)}
            >
              <SSVStack gap="none">
                <SSText center size="lg">
                  {account.summary.satsInMempool}
                </SSText>
                <SSText center color="muted" style={{ lineHeight: 12 }}>
                  {t('accounts.satsInMempool')}
                </SSText>
                {tabIndex === 3 && (
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
        )}
      </>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSHStack gap="sm">
              <SSText uppercase>{account.name}</SSText>
              {account.policyType === 'watchonly' && (
                <SSIconEyeOn stroke="#fff" height={16} width={16} />
              )}
            </SSHStack>
          ),
          headerBackground: () => (
            <View
              style={{
                height: '100%',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: Colors.gray[950]
              }}
            />
          ),
          headerRight
        }}
      />
      <SSVStack gap="none" style={{ alignItems: 'center' }}>
        <TouchableOpacity
          onPress={() => router.navigate('/settings/network/server')}
        >
          <SSHStack style={{ justifyContent: 'center', gap: 0 }}>
            {connectionState ? (
              isPrivateConnection ? (
                <SSIconYellowIndicator height={24} width={24} />
              ) : (
                <SSIconGreenIndicator height={24} width={24} />
              )
            ) : (
              <SSIconBlackIndicator height={24} width={24} />
            )}
            <SSHStack gap="xs" style={{ alignItems: 'center' }}>
              <SSText
                size="xxs"
                uppercase
                style={{
                  color: connectionState
                    ? Colors.gray['200']
                    : Colors.gray['450']
                }}
              >
                {`${connectionParts.network} - ${connectionParts.name}`}
              </SSText>
              <SSText
                size="xxs"
                uppercase
                style={{
                  color: Colors.gray['500']
                }}
              >
                {connectionParts.url}
                {connectionParts.mode ? ` [${connectionParts.mode}]` : ''}
              </SSText>
            </SSHStack>
          </SSHStack>
        </TouchableOpacity>
        <SSBlockFeePriceRow
          blockHeight={networkBlockHeight}
          btcPrice={btcPrice}
          fiatCurrency={fiatCurrency}
          nextBlockFee={nextBlockFee}
          blockHeightSource={blockHeightSource}
        />
      </SSVStack>
      {!expand && (
        <Animated.View style={{ paddingTop: 20 }}>
          <SSVStack itemsCenter gap="none">
            <SSVStack itemsCenter gap="none" style={{ paddingBottom: 12 }}>
              <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                <SSText
                  size={balanceTextSize}
                  color="white"
                  weight="ultralight"
                  style={{
                    lineHeight: Sizes.text.fontSize[balanceTextSize]
                  }}
                >
                  {privacyMode ? (
                    '••••'
                  ) : (
                    <SSStyledSatText
                      amount={account?.summary.balance || 0}
                      decimals={0}
                      useZeroPadding={useZeroPadding}
                      currency={currencyUnit}
                      textSize={balanceTextSize}
                      weight="ultralight"
                      letterSpacing={-1}
                    />
                  )}
                </SSText>
                <SSText size="xl" color="muted">
                  {currencyUnit === 'btc'
                    ? t('bitcoin.btc')
                    : t('bitcoin.sats')}
                </SSText>
              </SSHStack>
              <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                <SSText color="muted">
                  {!btcPrice || btcPrice <= 0
                    ? '--'
                    : privacyMode
                      ? '••••'
                      : formatNumber(
                          satsToFiat(account.summary.balance || 0),
                          2
                        )}
                </SSText>
                <SSText size="xs" style={{ color: Colors.gray[500] }}>
                  {fiatCurrency}
                </SSText>
              </SSHStack>
            </SSVStack>
            <SSVStack gap="none" style={{ paddingHorizontal: 16 }}>
              {account.keys[0].creationType !== 'importAddress' && (
                <SSButtonActionsGroup
                  context="bitcoin"
                  nfcAvailable={contentHandler.nfcAvailable}
                  onSend={contentHandler.handleSend}
                  onPaste={contentHandler.handlePaste}
                  onCamera={contentHandler.handleCamera}
                  onNFC={contentHandler.handleNFC}
                  onReceive={contentHandler.handleReceive}
                />
              )}
              {account.keys[0].creationType === 'importAddress' &&
                account.keys.length === 1 && (
                  <SSVStack gap="xs">
                    <SSText center color="muted" size="xs">
                      {t('receive.address').toUpperCase()}
                    </SSText>
                    <SSAddressDisplay
                      variant="outline"
                      type="sans-serif"
                      style={{ lineHeight: 14 }}
                      address={watchOnlyWalletAddress || ''}
                    />
                  </SSVStack>
                )}
            </SSVStack>
          </SSVStack>
        </Animated.View>
      )}
      {account.keys[0].creationType === 'importAddress' &&
        syncStatus === 'syncing' &&
        tasksDone !== undefined &&
        totalTasks !== undefined &&
        totalTasks > 0 && (
          <View style={{ marginTop: 10, marginBottom: -10 }}>
            <SSHStack gap="sm" style={{ justifyContent: 'center' }}>
              <SSLoader size={24} />
              <SSText center>
                {t('account.syncProgress', { tasksDone, totalTasks })}
              </SSText>
            </SSHStack>
          </View>
        )}
      <TabView
        swipeEnabled={false}
        navigationState={{ index: tabIndex, routes: tabs }}
        renderScene={renderScene}
        renderTabBar={renderTab}
        onIndexChange={setTabIndex}
        initialLayout={{ width }}
      />
      <SSCameraModal
        visible={contentHandler.cameraModalVisible}
        onClose={contentHandler.closeCameraModal}
        onContentScanned={contentHandler.handleContentScanned}
        context="bitcoin"
        title="Scan Bitcoin Content"
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
        context="bitcoin"
      />
    </>
  )
}

const styles = StyleSheet.create({
  listWithLoader: {
    flex: 1
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 16,
    backgroundColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0
  }
})

const addressListStyles = StyleSheet.create({
  container: {
    paddingTop: 10,
    paddingBottom: 10
  },
  header: {
    paddingVertical: 4
  },
  headerText: {
    color: '#777',
    textTransform: 'uppercase'
  },
  columnAddress: {
    width: '25%'
  },
  columnLabel: {
    width: '15%'
  },
  columnSats: {
    flexWrap: 'nowrap',
    width: '18%',
    textAlign: 'center'
  },
  columnTxs: {
    width: '10%',
    textAlign: 'center'
  },
  columnUtxos: {
    width: '10%',
    textAlign: 'center'
  },
  columnIndex: {
    width: '5%',
    textAlign: 'center'
  },
  row: {
    paddingVertical: 12,
    width: ADDRESS_TABLE_WIDTH,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderColor: '#333',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  indexText: {
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center'
  },
  addressText: {
    color: '#fff',
    flexWrap: 'nowrap'
  },
  headerRow: {
    paddingBottom: 10,
    paddingTop: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderColor: '#333',
    backgroundColor: '#111',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: ADDRESS_TABLE_WIDTH
  },
  receiveChangeContainer: {
    display: 'flex',
    width: '100%',
    marginTop: 10
  },
  unreadBadgeWrapper: {
    position: 'relative'
  },
  unreadBadgeDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.error
  }
})
