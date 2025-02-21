import { Descriptor } from 'bdk-rn'
import { type Network } from 'bdk-rn/lib/lib/enums'
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router'
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
  Easing,
  RefreshControl,
  ScrollView,
  useWindowDimensions,
  View
} from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { type SceneRendererProps, TabView } from 'react-native-tab-view'
import { useShallow } from 'zustand/react/shallow'

import { getWalletFromMnemonic } from '@/api/bdk'
import ElectrumClient from '@/api/electrum'
import {
  SSIconBubbles,
  SSIconCamera,
  SSIconChartSettings,
  SSIconCollapse,
  SSIconExpand,
  SSIconEyeOn,
  SSIconHistoryChart,
  SSIconKeys,
  SSIconList,
  SSIconMenu,
  SSIconRefresh
} from '@/components/icons'
import SSActionButton from '@/components/SSActionButton'
import SSBalanceChangeBar from '@/components/SSBalanceChangeBar'
import SSBubbleChart from '@/components/SSBubbleChart'
import SSChildAccountList from '@/components/SSChildAccountList'
import SSHistoryChart from '@/components/SSHistoryChart'
import SSIconButton from '@/components/SSIconButton'
import SSSeparator from '@/components/SSSeparator'
import SSSortDirectionToggle from '@/components/SSSortDirectionToggle'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import SSTransactionCard from '@/components/SSTransactionCard'
import SSUtxoCard from '@/components/SSUtxoCard'
import useGetWalletAddress from '@/hooks/useGetWalletAddress'
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
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { formatNumber } from '@/utils/format'
import { compareTimestamp } from '@/utils/sort'
import { getUtxoOutpoint } from '@/utils/utxo'

type TotalTransactionsProps = {
  account: Account
  handleOnRefresh: () => Promise<void>
  handleOnExpand: (state: boolean) => Promise<void>
  expand: boolean
  setSortDirection: Dispatch<React.SetStateAction<Direction>>
  refreshing: boolean
  sortTransactions: (transactions: Transaction[]) => Transaction[]
  blockchainHeight: number
}

function TotalTransactions({
  account,
  handleOnRefresh,
  handleOnExpand,
  expand,
  setSortDirection,
  refreshing,
  blockchainHeight
}: TotalTransactionsProps) {
  const router = useRouter()

  const [btcPrice, fiatCurrency, fetchPrices] = usePriceStore(
    useShallow((state) => [
      state.btcPrice,
      state.fiatCurrency,
      state.fetchPrices
    ])
  )

  fetchPrices()

  const sortedTransactions = useMemo(() => {
    return [...account.transactions].sort((transaction1, transaction2) =>
      compareTimestamp(transaction1.timestamp, transaction2.timestamp)
    )
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
      {showHistoryChart ? (
        <View style={{ flex: 1, zIndex: -1 }}>
          <SSHistoryChart
            transactions={sortedTransactions}
            utxos={account.utxos}
          />
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleOnRefresh}
              colors={[Colors.gray[900]]}
              progressBackgroundColor={Colors.white}
            />
          }
        >
          <SSVStack
            style={{ marginBottom: expand ? 8 : 16 }}
            gap={expand ? 'sm' : 'md'}
          >
            {sortedTransactions
              .slice()
              .reverse()
              .map((transaction, index) => {
                return (
                  <SSVStack gap="none" key={transaction.id}>
                    <SSBalanceChangeBar
                      transaction={transaction}
                      balance={transactionBalances[index]}
                      maxBalance={maxBalance}
                    />
                    <SSTransactionCard
                      btcPrice={btcPrice}
                      fiatCurrency={fiatCurrency}
                      transaction={transaction}
                      expand={expand}
                      walletBalance={transactionBalances[index]}
                      blockHeight={blockchainHeight}
                      link={`/account/${account.name}/transaction/${transaction.id}`}
                    />
                  </SSVStack>
                )
              })}
          </SSVStack>
        </ScrollView>
      )}
    </SSMainLayout>
  )
}

type ChildAccountsProps = {
  account: Account
  decryptSeed: Function
  setSortDirection: Function
  sortDirection: Direction
  handleOnExpand: (state: boolean) => Promise<void>
  expand: boolean
  setChange: Function
  change: boolean
}

function ChildAccounts({
  account,
  decryptSeed,
  handleOnExpand,
  setChange,
  change,
  expand,
  setSortDirection
}: ChildAccountsProps) {
  const getWalletAddress = useGetWalletAddress(account!)
  const [childAccounts, setChildAccounts] = useState<any[]>([])
  const { id } = useLocalSearchParams()
  const networkString = useBlockchainStore((state) => state.network)
  const [addressPath, setAddressPath] = useState('')

  const electrumRef = useRef<ElectrumClient | null>(null)

  const isMounted = useRef(false)

  useEffect(() => {
    if (!electrumRef.current) {
      electrumRef.current = new ElectrumClient({
        host: 'mempool.space',
        port: 60602,
        protocol: 'ssl'
      })
    }

    return () => {
      electrumRef.current?.close()
    }
  }, [])

  const fetchWithTimeout = <T,>(
    promise: Promise<T>,
    timeout = 5000
  ): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('getAddressInfo timeout')), timeout)
      ) as Promise<T>
    ])
  }

  const fetchAddresses = useCallback(async () => {
    if (!account || !account.externalDescriptor || !account.internalDescriptor)
      return

    if (!electrumRef.current) return

    try {
      await electrumRef.current.init()

      const result = await getWalletAddress()
      if (!result) return

      setAddressPath(`${account.derivationPath}/0/${result.index}`)

      const seed = await decryptSeed(id!)
      if (!seed || !account.scriptVersion) return

      const walletPrivate = await getWalletFromMnemonic(
        seed.replace(/,/g, ' '),
        account.scriptVersion,
        account.passphrase,
        networkString as Network
      )

      const newAddresses: {
        index: number
        address: string
        label: string
        unspendSats: number
        txs: number
      }[] = []

      for (let i = 0; i < account.summary.numberOfAddresses; i++) {
        const derivedAddress = await walletPrivate.wallet.getAddress(i)
        const derivedAddressResult = await derivedAddress.address.asString()

        try {
          const addressInfo = await fetchWithTimeout(
            electrumRef.current.getAddressInfo(derivedAddressResult)
          ).catch(() => ({
            utxos: [],
            transactions: []
          }))

          const sum = addressInfo.utxos.reduce(
            (acc, utxo) => acc + utxo.value,
            0
          )

          newAddresses.push({
            index: i,
            address: derivedAddressResult,
            label: '',
            unspendSats: sum,
            txs: addressInfo.transactions?.length ?? 0
          })
        } catch {
          newAddresses.push({
            index: i,
            address: derivedAddressResult,
            label: '',
            unspendSats: 0,
            txs: 0
          })
        }
      }

      setChildAccounts((prevAccounts) => {
        const existingAddresses = new Set(
          prevAccounts.map((acc) => acc.address)
        )
        return [
          ...prevAccounts,
          ...newAddresses.filter((acc) => !existingAddresses.has(acc.address))
        ]
      })
    } catch {
    } finally {
      if (electrumRef.current) {
        try {
          electrumRef.current.close()
        } catch {}
      }
    }
  }, [account, decryptSeed, networkString, getWalletAddress, id])

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true
      fetchAddresses()
    }
  }, [fetchAddresses])

  return (
    <SSMainLayout style={{ paddingTop: 20 }}>
      <SSHStack justifyBetween style={{ paddingVertical: 4 }}>
        <SSHStack>
          <SSIconButton onPress={fetchAddresses}>
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
          <SSText color="muted" uppercase>
            {t('receive.path')}
          </SSText>
          <SSText>{addressPath}</SSText>
        </SSHStack>
        <SSHStack gap="sm" style={{ width: 40, justifyContent: 'flex-end' }}>
          <SSSortDirectionToggle
            onDirectionChanged={() => setSortDirection()}
          />
        </SSHStack>
      </SSHStack>

      <SSHStack
        gap="md"
        justifyBetween
        style={{ display: 'flex', width: '100%', marginTop: 10 }}
      >
        {[t('childAccount.receive'), t('childAccount.change')].map(
          (type, index) => (
            <SSHStack key={type} style={{ flex: 1, justifyContent: 'center' }}>
              <SSText
                style={{
                  textAlign: 'center',
                  paddingVertical: 20,
                  borderWidth: 1,
                  borderColor: change === (index === 1) ? '#fff' : '#333',
                  width: '100%'
                }}
                uppercase
                onPress={() => setChange(index === 1)}
              >
                {type}
              </SSText>
            </SSHStack>
          )
        )}
      </SSHStack>

      <SSHStack
        style={{
          paddingVertical: 18,
          paddingHorizontal: 4,
          borderBottomWidth: 1,
          borderColor: '#333',
          backgroundColor: '#111',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        {[
          t('childAccount.index'),
          t('childAccount.address'),
          t('childAccount.label'),
          t('childAccount.unspendSats'),
          t('childAccount.txs')
        ].map((title) => (
          <SSText
            key={title}
            style={{ textAlign: 'center', color: '#777' }}
            uppercase
          >
            {title}
          </SSText>
        ))}
      </SSHStack>

      <SSChildAccountList childAccounts={childAccounts} />
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
              colors={[Colors.gray[900]]}
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
      <GestureHandlerRootView style={{ flex: 1 }}>
        {view === 'bubbles' && (
          <SSBubbleChart
            utxos={[...account.utxos]}
            canvasSize={{ width: GRAPH_WIDTH, height: GRAPH_HEIGHT }}
            inputs={[]}
            onPress={({ txid, vout }: Utxo) =>
              router.navigate(
                `/account/${account.name}/transaction/${txid}/utxo/${vout}`
              )
            }
          />
        )}
      </GestureHandlerRootView>
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

  const [
    account,
    loadWalletFromDescriptor,
    syncWallet,
    updateAccount,
    decryptSeed
  ] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((account) => account.name === id),
      state.loadWalletFromDescriptor,
      state.syncWallet,
      state.updateAccount,
      state.decryptSeed
    ])
  )

  const useZeroPadding = useSettingsStore((state) => state.useZeroPadding)
  const [fiatCurrency, satsToFiat] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat])
  )
  const [network, getBlockchainHeight] = useBlockchainStore(
    useShallow((state) => [state.network, state.getBlockchainHeight])
  )
  const clearTransaction = useTransactionBuilderStore(
    (state) => state.clearTransaction
  )

  const [refreshing, setRefreshing] = useState(false)
  const [expand, setExpand] = useState(false)
  const [change, setChange] = useState(false)
  const [sortDirectionTransactions, setSortDirectionTransactions] =
    useState<Direction>('desc')
  const [sortDirectionUtxos, setSortDirectionUtxos] =
    useState<Direction>('desc')
  const [sortDirectionChildAccounts, setSortDirectionChildAccounts] =
    useState<Direction>('desc')
  const [blockchainHeight, setBlockchainHeight] = useState<number>(0)

  const tabs = [
    { key: 'totalTransactions' },
    { key: 'childAccounts' },
    { key: 'spendableOutputs' },
    { key: 'satsInMempool' }
  ]
  const [tabIndex, setTabIndex] = useState(0)
  const animationValue = useRef(new Animated.Value(0)).current
  const gradientHeight = animationValue.interpolate({
    inputRange: [0, 1],
    outputRange: [190, 0]
  })

  useEffect(() => {
    ;(async () => {
      try {
        if (account) await refresh()
      } catch (_err) {
        //
      }
    })()

    return () => {}
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
            sortTransactions={sortTransactions}
            blockchainHeight={blockchainHeight}
          />
        )
      case 'childAccounts':
        return (
          <ChildAccounts
            account={account}
            handleOnExpand={handleOnExpand}
            setChange={setChange}
            expand={expand}
            change={change}
            decryptSeed={decryptSeed}
            setSortDirection={setSortDirectionChildAccounts}
            sortDirection={sortDirectionChildAccounts}
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

  function sortTransactions(transactions: Transaction[]) {
    return transactions.sort((transaction1, transaction2) =>
      sortDirectionTransactions === 'asc'
        ? compareTimestamp(transaction1.timestamp, transaction2.timestamp)
        : compareTimestamp(transaction2.timestamp, transaction1.timestamp)
    )
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
    if (!account || !account.externalDescriptor || !account.internalDescriptor)
      return

    const [externalDescriptor, internalDescriptor] = await Promise.all([
      new Descriptor().create(account.externalDescriptor, network as Network),
      new Descriptor().create(account.internalDescriptor, network as Network)
    ])

    const wallet = await loadWalletFromDescriptor(
      externalDescriptor,
      internalDescriptor
    )

    const syncedAccount = await syncWallet(wallet, account)
    await updateAccount(syncedAccount)
  }

  async function refresh() {
    await refreshBlockchainHeight()
    await refreshAccount()
  }

  async function handleOnRefresh() {
    setRefreshing(true)
    await refresh()
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

  const renderTab = () => {
    // TODO: Handle tab indicator | https://reactnavigation.org/docs/tab-view/#renderindicator

    return (
      <>
        {!expand && (
          <SSHStack
            gap="none"
            style={{ paddingVertical: 8, paddingHorizontal: '5%' }}
          >
            <SSActionButton
              style={{ width: '25%' }}
              onPress={() => setTabIndex(0)}
            >
              <SSVStack gap="none">
                <SSText center size="lg">
                  {account.summary.numberOfTransactions}
                </SSText>
                <SSText center color="muted" style={{ lineHeight: 12 }}>
                  {t('accounts.totalTransactions.0')}
                  {'\n'}
                  {t('accounts.totalTransactions.1')}
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
              style={{ width: '25%' }}
              onPress={() => setTabIndex(1)}
            >
              <SSVStack gap="none">
                <SSText center size="lg">
                  {account.summary.numberOfAddresses}
                </SSText>
                <SSText center color="muted" style={{ lineHeight: 12 }}>
                  {t('accounts.childAccounts.0')}
                  {'\n'}
                  {t('accounts.childAccounts.1')}
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
            <SSActionButton
              style={{ width: '25%' }}
              onPress={() => setTabIndex(2)}
            >
              <SSVStack gap="none">
                <SSText center size="lg">
                  {account.summary.numberOfUtxos}
                </SSText>
                <SSText center color="muted" style={{ lineHeight: 12 }}>
                  {t('accounts.spendableOutputs.0')}
                  {'\n'}
                  {t('accounts.spendableOutputs.1')}
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
              style={{ width: '25%' }}
              onPress={() => setTabIndex(3)}
            >
              <SSVStack gap="none">
                <SSText center size="lg">
                  {account.summary.satsInMempool}
                </SSText>
                <SSText center color="muted" style={{ lineHeight: 12 }}>
                  {t('accounts.satsInMempool.0')}
                  {'\n'}
                  {t('accounts.satsInMempool.1')}
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
              <SSText uppercase>{id}</SSText>
              {account.watchOnly && (
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
              onPress={() => router.navigate(`/account/${id}/settings`)}
            >
              <SSIconKeys height={18} width={18} />
            </SSIconButton>
          )
        }}
      />
      <Animated.View style={{ height: gradientHeight }}>
        <SSVStack itemsCenter gap="none">
          <SSVStack itemsCenter gap="none" style={{ paddingBottom: 12 }}>
            <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
              <SSText size="7xl" color="white">
                <SSStyledSatText
                  amount={account?.summary.balance || 0}
                  decimals={0}
                  useZeroPadding={useZeroPadding}
                  textSize="7xl"
                  weight="ultralight"
                  letterSpacing={-1}
                />
              </SSText>
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
              gap="none"
              style={{ paddingHorizontal: '5%' }}
            >
              {!account.watchOnly && (
                <>
                  <SSActionButton
                    onPress={() => navigateToSignAndSend()}
                    style={{
                      width: '40%',
                      backgroundColor: Colors.gray[925],
                      marginRight: 2,
                      borderTopWidth: 1,
                      borderTopColor: '#242424',
                      borderRadius: 3
                    }}
                  >
                    <SSText uppercase>{t('account.signAndSend')}</SSText>
                  </SSActionButton>
                  <SSActionButton
                    onPress={() => router.navigate(`/account/${id}/camera`)}
                    style={{
                      width: '20%',
                      backgroundColor: Colors.gray[925],
                      borderTopWidth: 1,
                      borderTopColor: '#242424',
                      borderRadius: 3
                    }}
                  >
                    <SSIconCamera height={13} width={18} />
                  </SSActionButton>
                </>
              )}
              <SSActionButton
                onPress={() => router.navigate(`/account/${id}/receive`)}
                style={{
                  width: account.watchOnly ? '100%' : '40%',
                  backgroundColor: Colors.gray[925],
                  marginLeft: 2,
                  borderTopWidth: 1,
                  borderTopColor: '#242424',
                  borderRadius: 3
                }}
              >
                <SSText uppercase>{t('account.receive')}</SSText>
              </SSActionButton>
            </SSHStack>
          </SSVStack>
        </SSVStack>
      </Animated.View>
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
