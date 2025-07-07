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
  ActivityIndicator,
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
  SSIconCamera,
  SSIconChartSettings,
  SSIconCollapse,
  SSIconExpand,
  SSIconEyeOn,
  SSIconGreenIndicator,
  SSIconHistoryChart,
  SSIconKeys,
  SSIconList,
  SSIconMenu,
  SSIconRefresh,
  SSIconYellowIndicator
} from '@/components/icons'
import SSActionButton from '@/components/SSActionButton'
import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSBalanceChangeBar from '@/components/SSBalanceChangeBar'
import SSBubbleChart from '@/components/SSBubbleChart'
import SSButton from '@/components/SSButton'
import SSHistoryChart from '@/components/SSHistoryChart'
import SSIconButton from '@/components/SSIconButton'
import SSSeparator from '@/components/SSSeparator'
import SSSortDirectionToggle from '@/components/SSSortDirectionToggle'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import SSTransactionCard from '@/components/SSTransactionCard'
import SSUtxoCard from '@/components/SSUtxoCard'
import useGetAccountAddress from '@/hooks/useGetAccountAddress'
import useGetAccountWallet from '@/hooks/useGetAccountWallet'
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
import { Colors } from '@/styles'
import { type Direction } from '@/types/logic/sort'
import { type Account } from '@/types/models/Account'
import { type Address } from '@/types/models/Address'
import { type Utxo } from '@/types/models/Utxo'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { formatAddress, formatNumber } from '@/utils/format'
import { parseAccountAddressesDetails } from '@/utils/parse'
import { compareTimestamp, sortTransactions } from '@/utils/sort'
import { getUtxoOutpoint } from '@/utils/utxo'

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
          <FlashList
            data={sortedTransactions.slice().reverse()}
            renderItem={({ item, index }) => (
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
                  link={`/account/${account.id}/transaction/${item.id}`}
                />
              </SSVStack>
            )}
            estimatedItemSize={120}
            ListEmptyComponent={
              <SSVStack>
                <SSText>No transactions</SSText>
              </SSVStack>
            }
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleOnRefresh}
                colors={[Colors.gray[950]]}
                progressBackgroundColor={Colors.white}
              />
            }
          />
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
const ADDRESS_LIST_WIDTH = SCREEN_WIDTH * 1.1

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

  const [addressPath, setAddressPath] = useState('')
  const [loadingAddresses, setLoadingAddresses] = useState(false)
  const [addressCount, setAddressCount] = useState(
    Math.max(1, Math.ceil(account.addresses.length / perPage)) * perPage
  )
  const [addresses, setAddresses] = useState([...account.addresses])
  const [_hasLoadMoreAddresses, setHasLoadMoreAddresses] = useState(false)
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
    setAddresses([...account.addresses])
    setAddressCount(account.addresses.length)
  }

  async function refreshAddresses() {
    if (isMultiAddressWatchOnly) {
      loadExactAccountAddresses()
      return
    }

    let addresses = await getWalletAddresses(wallet!, network!, addressCount)
    addresses = parseAccountAddressesDetails({ ...account, addresses })
    setAddresses(addresses.slice(0, addressCount))
    updateAccount({ ...account, addresses })
  }

  async function loadMoreAddresses() {
    if (isMultiAddressWatchOnly) {
      loadExactAccountAddresses()
      return
    }

    setHasLoadMoreAddresses(true)
    const newAddressCount =
      addresses.length < addressCount ? addressCount : addressCount + perPage
    setAddressCount(newAddressCount)
    setLoadingAddresses(true)

    let addrList = await getWalletAddresses(wallet!, network!, newAddressCount)
    addrList = parseAccountAddressesDetails({
      ...account,
      addresses: addrList
    })
    setAddresses(addrList)
    setLoadingAddresses(false)
    updateAccount({ ...account, addresses: addrList })
  }

  async function updateAddresses() {
    if (!wallet) return

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
      setAddresses(newAddresses)
      return
    }

    let newAddresses = await getWalletAddresses(wallet!, network!, minItems)
    newAddresses = parseAccountAddressesDetails({
      ...account,
      addresses: newAddresses
    })
    setAddressCount(minItems)
    setAddresses(newAddresses)
    updateAccount({ ...account, addresses: newAddresses })
  }

  useEffect(() => {
    updateDerivationPath()
  }, [change]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    updateAddresses()
  }, [account]) // eslint-disable-line react-hooks/exhaustive-deps

  const renderItem = useCallback(
    ({ item }: { item: Address }) => (
      <TouchableOpacity
        onPress={() =>
          router.navigate(`/account/${account.id}/address/${item.address}`)
        }
      >
        <SSHStack style={addressListStyles.row}>
          {!isMultiAddressWatchOnly && (
            <SSText
              style={[
                addressListStyles.indexText,
                addressListStyles.columnIndex
              ]}
            >
              {item.index}
            </SSText>
          )}
          <SSText
            style={[
              addressListStyles.addressText,
              addressListStyles.columnAddress
            ]}
          >
            {formatAddress(item.address, 4)}
          </SSText>
          <SSText
            style={[
              addressListStyles.columnLabel,
              { color: item.label ? '#fff' : '#333' }
            ]}
          >
            {item.label || t('transaction.noLabel')}
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
              addressListStyles.columnSats,
              { color: item.summary.balance === 0 ? '#333' : '#fff' }
            ]}
          >
            {item.summary.balance}
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
              <SSIconExpand height={15} width={16} />
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
      <ScrollView style={{ marginTop: 10 }} horizontal>
        <SSVStack gap="none" style={{ width: ADDRESS_LIST_WIDTH }}>
          <SSHStack style={addressListStyles.headerRow}>
            {!isMultiAddressWatchOnly && (
              <SSText
                style={[
                  addressListStyles.headerText,
                  addressListStyles.columnIndex
                ]}
              >
                {t('address.list.table.index')}
              </SSText>
            )}
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
              style={[
                addressListStyles.headerText,
                addressListStyles.columnTxs
              ]}
            >
              {t('address.list.table.tx')}
            </SSText>
            <SSText
              style={[
                addressListStyles.headerText,
                addressListStyles.columnSats
              ]}
            >
              {t('address.list.table.balance')}
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
            data={addresses?.filter(
              (address) =>
                isMultiAddressWatchOnly ||
                (change
                  ? address.keychain === 'internal'
                  : address.keychain === 'external')
            )}
            renderItem={renderItem}
            estimatedItemSize={150}
            keyExtractor={(item) => {
              return `${item.index || ''}:${item.address}:${item.keychain || ''}`
            }}
            removeClippedSubviews
          />
        </SSVStack>
      </ScrollView>
      {!isMultiAddressWatchOnly && (
        <SSButton
          variant="outline"
          uppercase
          style={{ marginTop: 10 }}
          label={t('address.list.table.loadMore')}
          disabled={loadingAddresses}
          onPress={loadMoreAddresses}
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
            {sortUtxos([...account.utxos]).map((utxo) => (
              <SSVStack gap="xs" key={getUtxoOutpoint(utxo)}>
                <SSSeparator color="grayDark" />
                <SSUtxoCard utxo={utxo} />
              </SSVStack>
            ))}
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
                `/account/${account.id}/transaction/${txid}/utxo/${vout}`
              )
            }
          />
        )}
      </View>
    </SSMainLayout>
  )
}

function SatsInMempool() {
  return (
    <SSMainLayout>
      <SSText>Being built...</SSText>
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

  const wallet = useGetAccountWallet(id!)
  const watchOnlyWalletAddress = useGetAccountAddress(id!)

  const isMultiAddressWatchOnly = useMemo(() => {
    return (
      account &&
      account.keys.length > 1 &&
      account.keys[0].creationType === 'importAddress'
    )
  }, [account])

  const useZeroPadding = useSettingsStore((state) => state.useZeroPadding)

  const [fiatCurrency, satsToFiat, fetchPrices] = usePriceStore(
    useShallow((state) => [
      state.fiatCurrency,
      state.satsToFiat,
      state.fetchPrices
    ])
  )
  const [getBlockchainHeight, mempoolUrl] = useBlockchainStore(
    useShallow((state) => [
      state.getBlockchainHeight,
      state.configsMempool['bitcoin']
    ])
  )
  const clearTransaction = useTransactionBuilderStore(
    (state) => state.clearTransaction
  )
  const { syncAccountWithWallet } = useSyncAccountWithWallet()
  const { syncAccountWithAddress } = useSyncAccountWithAddress()
  const { nostrSyncSubscriptions } = useNostrSync()

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
  const gradientHeight = animationValue.interpolate({
    inputRange: [0, 1],
    outputRange: [isMultiAddressWatchOnly ? 100 : 190, 0]
  })

  const [connectionState, connectionString, isPrivateConnection] =
    useVerifyConnection()

  useEffect(() => {
    if (wallet) handleOnRefresh()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!account) return <Redirect href="/" />

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
        return <SatsInMempool />
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

  async function refreshAccountLabels() {
    if (!account) return
    if (account.nostr.autoSync) {
      await nostrSyncSubscriptions(account)
    }
  }

  async function handleOnRefresh() {
    setRefreshing(true)
    await fetchPrices(mempoolUrl)
    await refreshBlockchainHeight()
    await refreshAccount()
    await refreshAccountLabels()
    setRefreshing(false)
  }

  async function handleOnExpand(state: boolean) {
    setExpand(state)
    animateTransition(state)
  }

  function navigateToSignAndSend() {
    clearTransaction()
    router.navigate(`/account/${id}/signAndSend/selectUtxoList`)
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
          headerRight: () => (
            <SSIconButton
              style={{
                paddingTop: 6,
                width: 30,
                height: 30,
                alignItems: 'center'
              }}
              onPress={() => router.navigate(`/account/${id}/settings`)}
            >
              <SSIconKeys height={18} width={18} />
            </SSIconButton>
          )
        }}
      />
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
          <SSText
            size="xxs"
            uppercase
            style={{
              color: connectionState ? Colors.gray['200'] : Colors.gray['450']
            }}
          >
            {connectionString}
          </SSText>
        </SSHStack>
      </TouchableOpacity>
      {!expand && (
        <Animated.View style={{ height: gradientHeight }}>
          <SSVStack itemsCenter gap="none">
            <SSVStack itemsCenter gap="none" style={{ paddingBottom: 12 }}>
              <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                <SSStyledSatText
                  amount={account?.summary.balance || 0}
                  decimals={0}
                  useZeroPadding={useZeroPadding}
                  textSize={
                    account?.summary.balance > 1_000_000_000 ? '4xl' : '6xl'
                  }
                  weight="ultralight"
                  letterSpacing={-1}
                />
                <SSText size="xl" color="muted">
                  {t('bitcoin.sats').toLowerCase()}
                </SSText>
              </SSHStack>
              <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                <SSText color="muted">
                  {formatNumber(satsToFiat(account.summary.balance || 0), 2)}
                </SSText>
                <SSText size="xs" style={{ color: Colors.gray[500] }}>
                  {fiatCurrency}
                </SSText>
              </SSHStack>
            </SSVStack>
            <SSVStack gap="none">
              <SSHStack
                justifyEvenly
                gap="xxs"
                style={{ paddingHorizontal: '5%' }}
              >
                {account.policyType !== 'watchonly' && (
                  <>
                    <SSActionButton
                      onPress={() => navigateToSignAndSend()}
                      style={{
                        ...styles.actionButton,
                        width: '40%'
                      }}
                    >
                      <SSText uppercase>{t('account.signAndSend')}</SSText>
                    </SSActionButton>
                    <SSActionButton
                      onPress={() => router.navigate(`/account/${id}/camera`)}
                      style={{
                        ...styles.actionButton,
                        width: '20%'
                      }}
                    >
                      <SSIconCamera height={13} width={18} />
                    </SSActionButton>
                    <SSActionButton
                      onPress={() => router.navigate(`/account/${id}/receive`)}
                      style={{
                        ...styles.actionButton,
                        width: '40%'
                      }}
                    >
                      <SSText uppercase>{t('account.receive')}</SSText>
                    </SSActionButton>
                  </>
                )}
                {account.keys[0].creationType === 'importExtendedPub' && (
                  <SSActionButton
                    onPress={() => router.navigate(`/account/${id}/receive`)}
                    style={{
                      ...styles.actionButton,
                      width: '100%'
                    }}
                  >
                    <SSText uppercase>{t('account.receive')}</SSText>
                  </SSActionButton>
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
              </SSHStack>
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
              <ActivityIndicator size={16} color="#fff" />
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
    </>
  )
}

const styles = StyleSheet.create({
  actionButton: {
    backgroundColor: Colors.gray[925],
    marginLeft: 2,
    borderTopWidth: 1,
    borderTopColor: '#242424',
    borderRadius: 3
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
  columnAddress: { width: '20%' },
  columnLabel: { width: '15%' },
  columnSats: { width: '10%', textAlign: 'center' },
  columnTxs: { width: '10%', textAlign: 'center' },
  columnUtxos: { width: '10%', textAlign: 'center' },
  columnIndex: { width: '10%', textAlign: 'center' },
  row: {
    paddingVertical: 12,
    width: ADDRESS_LIST_WIDTH,
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
    width: ADDRESS_LIST_WIDTH
  },
  receiveChangeContainer: {
    display: 'flex',
    width: '100%',
    marginTop: 10
  }
})
