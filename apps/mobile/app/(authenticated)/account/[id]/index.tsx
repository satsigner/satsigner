import { Descriptor } from 'bdk-rn'
import { Network } from 'bdk-rn/lib/lib/enums'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { type Dispatch, useEffect, useState } from 'react'
import {
  RefreshControl,
  ScrollView,
  useWindowDimensions,
  View
} from 'react-native'
import { SceneRendererProps, TabView } from 'react-native-tab-view'
import { useShallow } from 'zustand/react/shallow'

import SSActionButton from '@/components/SSActionButton'
import SSBackgroundGradient from '@/components/SSBackgroundGradient'
import SSIconButton from '@/components/SSIconButton'
import SSSeparator from '@/components/SSSeparator'
import SSSortDirectionToggle from '@/components/SSSortDirectionToggle'
import SSText from '@/components/SSText'
import SSTransactionCard from '@/components/SSTransactionCard'
import SSUtxoCard from '@/components/SSUtxoCard'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { Colors } from '@/styles'
import { type Direction } from '@/types/logic/sort'
import { type Account } from '@/types/models/Account'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { formatNumber } from '@/utils/format'
import { compareTimestamp } from '@/utils/sort'

type TotalTransactionsProps = {
  account: Account
  handleOnRefresh: () => Promise<void>
  setSortDirection: Dispatch<React.SetStateAction<Direction>>
  refreshing: boolean
  sortTransactions: (transactions: Transaction[]) => Transaction[]
  blockchainHeight: number
}

function TotalTransactions({
  account,
  handleOnRefresh,
  setSortDirection,
  refreshing,
  sortTransactions,
  blockchainHeight
}: TotalTransactionsProps) {
  const router = useRouter()

  return (
    <SSMainLayout style={{ paddingTop: 0 }}>
      <SSHStack justifyBetween style={{ paddingVertical: 16 }}>
        <SSIconButton onPress={() => handleOnRefresh()}>
          <Image
            style={{ width: 18, height: 22 }}
            source={require('@/assets/icons/refresh.svg')}
          />
        </SSIconButton>
        <SSText color="muted">{i18n.t('account.parentAccountActivity')}</SSText>
        <SSSortDirectionToggle
          onDirectionChanged={(direction) => setSortDirection(direction)}
        />
      </SSHStack>
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
          {sortTransactions([...account.transactions]).map((transaction) => (
            <SSVStack gap="xs" key={transaction.id}>
              <SSSeparator color="grayDark" />
              <SSTransactionCard
                transaction={transaction}
                blockHeight={blockchainHeight}
                onPress={() => {
                  router.navigate('/transaction/N')
                }}
              />
            </SSVStack>
          ))}
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

function ChildAccounts() {
  return (
    <SSMainLayout>
      <SSText>Being built...</SSText>
    </SSMainLayout>
  )
}

type SpendableOutputsProps = {
  account: Account
  handleOnRefresh: () => Promise<void>
  setSortDirection: Dispatch<React.SetStateAction<Direction>>
  refreshing: boolean
  sortUtxos: (utxos: Utxo[]) => Utxo[]
}

function SpendableOutputs({
  account,
  handleOnRefresh,
  setSortDirection,
  refreshing,
  sortUtxos
}: SpendableOutputsProps) {
  return (
    <SSMainLayout style={{ paddingTop: 0 }}>
      <SSHStack justifyBetween style={{ paddingVertical: 16 }}>
        <SSIconButton onPress={() => {}}>
          <Image
            style={{ width: 18, height: 22 }}
            source={require('@/assets/icons/refresh.svg')}
          />
        </SSIconButton>
        <SSText color="muted">{i18n.t('account.parentAccountActivity')}</SSText>
        <SSSortDirectionToggle
          onDirectionChanged={(direction) => setSortDirection(direction)}
        />
      </SSHStack>
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
            <SSVStack gap="xs" key={utxo.txid}>
              <SSSeparator color="grayDark" />
              <SSUtxoCard utxo={utxo} />
            </SSVStack>
          ))}
        </SSVStack>
      </ScrollView>
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
    getCurrentAccount,
    loadWalletFromDescriptor,
    syncWallet,
    updateAccount
  ] = useAccountsStore(
    useShallow((state) => [
      state.getCurrentAccount,
      state.loadWalletFromDescriptor,
      state.syncWallet,
      state.updateAccount
    ])
  )
  const [fiatCurrency, satsToFiat] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat])
  )
  const [network, getBlockchainHeight] = useBlockchainStore(
    useShallow((state) => [state.network, state.getBlockchainHeight])
  )
  const clearTransaction = useTransactionBuilderStore(
    (state) => state.clearTransaction
  )

  const [account, setAccount] = useState(getCurrentAccount(id)!) // Make use of non-null assertion operator for now
  const [refreshing, setRefreshing] = useState(false)
  const [sortDirectionTransactions, setSortDirectionTransactions] =
    useState<Direction>('desc')
  const [sortDirectionUtxos, setSortDirectionUtxos] =
    useState<Direction>('desc')
  const [blockchainHeight, setBlockchainHeight] = useState<number>(0)

  const tabs = [
    { key: 'totalTransactions' },
    { key: 'childAccounts' },
    { key: 'spendableOutputs' },
    { key: 'satsInMempool' }
  ]
  const [tabIndex, setTabIndex] = useState(0)
  const renderScene = ({
    route
  }: SceneRendererProps & { route: { key: string } }) => {
    switch (route.key) {
      case 'totalTransactions':
        return (
          <TotalTransactions
            account={account}
            handleOnRefresh={handleOnRefresh}
            setSortDirection={setSortDirectionTransactions}
            refreshing={refreshing}
            sortTransactions={sortTransactions}
            blockchainHeight={blockchainHeight}
          />
        )
      case 'childAccounts':
        return <ChildAccounts />
      case 'spendableOutputs':
        return (
          <SpendableOutputs
            account={account}
            handleOnRefresh={handleOnRefresh}
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

  useEffect(() => {
    ;(async () => {
      try {
        await refresh()
      } catch (_err) {
        //
      }
    })()

    return () => {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    setAccount(syncedAccount)
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

  function navigateToSignAndSend() {
    clearTransaction()
    router.navigate(`/account/${id}/signAndSend/selectUtxoList`)
  }

  const renderTab = () => {
    // TODO: Handle tab indicator | https://reactnavigation.org/docs/tab-view/#renderindicator

    return (
      <SSBackgroundGradient orientation="horizontal">
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
                {i18n.t('accountList.totalTransactions.0')}
                {'\n'}
                {i18n.t('accountList.totalTransactions.1')}
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
                {i18n.t('accountList.childAccounts.0')}
                {'\n'}
                {i18n.t('accountList.childAccounts.1')}
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
                {i18n.t('accountList.spendableOutputs.0')}
                {'\n'}
                {i18n.t('accountList.spendableOutputs.1')}
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
                {i18n.t('accountList.satsInMempool.0')}
                {'\n'}
                {i18n.t('accountList.satsInMempool.1')}
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
      </SSBackgroundGradient>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{id}</SSText>,
          headerBackground: () => (
            <LinearGradient
              style={{
                height: '100%',
                justifyContent: 'center',
                alignItems: 'center'
              }}
              colors={[Colors.gray[900], Colors.gray[800]]}
              start={{ x: 0.86, y: 1.0 }}
              end={{ x: 0.14, y: 1 }}
            />
          )
        }}
      />
      <SSBackgroundGradient orientation="horizontal">
        <SSVStack itemsCenter gap="none">
          <SSVStack itemsCenter gap="none" style={{ paddingBottom: 12 }}>
            <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
              <SSText size="7xl" color="white" weight="ultralight">
                {formatNumber(account.summary.balance || 0)}
              </SSText>
              <SSText size="xl" color="muted">
                {i18n.t('bitcoin.sats').toLowerCase()}
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
            <SSSeparator
              color="gradient"
              colors={[Colors.gray[600], Colors.gray[850]]}
            />
            <SSHStack
              justifyEvenly
              gap="none"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
            >
              <SSActionButton
                onPress={() => navigateToSignAndSend()}
                style={{
                  width: '40%',
                  borderRightWidth: 1,
                  borderRightColor: Colors.gray[600]
                }}
              >
                <SSText uppercase>{i18n.t('account.signAndSend')}</SSText>
              </SSActionButton>
              <SSActionButton
                onPress={() => router.navigate(`/account/${id}/camera`)}
                style={{ width: '20%' }}
              >
                <Image
                  style={{ width: 18, height: 13 }}
                  source={require('@/assets/icons/camera.svg')}
                />
              </SSActionButton>
              <SSActionButton
                onPress={() => router.navigate(`/account/${id}/newInvoice`)}
                style={{
                  width: '40%',
                  borderLeftWidth: 1,
                  borderLeftColor: Colors.gray[600]
                }}
              >
                <SSText uppercase>{i18n.t('account.newInvoice')}</SSText>
              </SSActionButton>
            </SSHStack>
            <SSSeparator
              color="gradient"
              colors={[Colors.gray[600], Colors.gray[850]]}
            />
          </SSVStack>
        </SSVStack>
      </SSBackgroundGradient>
      <TabView
        navigationState={{ index: tabIndex, routes: tabs }}
        renderScene={renderScene}
        renderTabBar={renderTab}
        onIndexChange={setTabIndex}
        initialLayout={{ width }}
      />
    </>
  )
}
