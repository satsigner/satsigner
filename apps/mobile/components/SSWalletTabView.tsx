import { useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
  View
} from 'react-native'
import { type SceneRendererProps, TabView } from 'react-native-tab-view'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSActionButton from '@/components/SSActionButton'
import DerivedAddresses from '@/components/SSDerivedAddresses'
import SSSatsInMempool from '@/components/SSSatsInMempool'
import SpendableOutputs from '@/components/SSSpendableOutputs'
import SSText from '@/components/SSText'
import TotalTransactions from '@/components/SSTotalTransactions'
import useGetAccountAddress from '@/hooks/useGetAccountAddress'
import useGetAccountWallet from '@/hooks/useGetAccountWallet'
import useNostrSync from '@/hooks/useNostrSync'
import useSyncAccountWithAddress from '@/hooks/useSyncAccountWithAddress'
import useSyncAccountWithWallet from '@/hooks/useSyncAccountWithWallet'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { Colors } from '@/styles'
import { type Direction } from '@/types/logic/sort'
import { type Utxo } from '@/types/models/Utxo'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { compareTimestamp } from '@/utils/sort'

function SSWalletTabView() {
  const { id } = useLocalSearchParams<AccountSearchParams>()
  const { width } = useWindowDimensions()

  const [updateAccount, account] = useAccountsStore(
    useShallow((state) => [
      state.updateAccount,
      state.accounts.find((a) => a.id === id)
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

  const [fetchPrices] = usePriceStore(
    useShallow((state) => [state.fetchPrices])
  )
  const [getBlockchainHeight, mempoolUrl] = useBlockchainStore(
    useShallow((state) => [
      state.getBlockchainHeight,
      state.configsMempool['bitcoin']
    ])
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

  useEffect(() => {
    if (wallet) handleOnRefresh()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!account) return null

  const renderScene = ({
    route
  }: SceneRendererProps & { route: { key: string } }) => {
    switch (route.key) {
      case 'totalTransactions':
        return (
          <TotalTransactions
            transactions={account.transactions}
            utxos={account.utxos}
            accountId={account.id}
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
        return <SSSatsInMempool />
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

  if (!account) return null

  const renderTab = () => {
    const isImportAddress = account.keys[0].creationType === 'importAddress'
    const tabWidth =
      isImportAddress && account.keys.length === 1 ? '33.33%' : '25%'

    if (!expand) return null

    return (
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
            {tabIndex === 0 && <View style={styles.tabButtonOutline} />}
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
              {tabIndex === 1 && <View style={styles.tabButtonOutline} />}
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
            {tabIndex === 2 && <View style={styles.tabButtonOutline} />}
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
            {tabIndex === 3 && <View style={styles.tabButtonOutline} />}
          </SSVStack>
        </SSActionButton>
      </SSHStack>
    )
  }

  return (
    <TabView
      swipeEnabled={false}
      navigationState={{ index: tabIndex, routes: tabs }}
      renderScene={renderScene}
      renderTabBar={renderTab}
      onIndexChange={setTabIndex}
      initialLayout={{ width }}
    />
  )
}

const styles = StyleSheet.create({
  tabButtonOutline: {
    position: 'absolute',
    width: '100%',
    height: 2,
    bottom: -12,
    alignSelf: 'center',
    backgroundColor: Colors.white
  }
})

export default SSWalletTabView
