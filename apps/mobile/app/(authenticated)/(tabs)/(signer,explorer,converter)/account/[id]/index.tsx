import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native'
import { type SceneRendererProps, TabView } from 'react-native-tab-view'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import {
  SSIconBlackIndicator,
  SSIconCamera,
  SSIconEyeOn,
  SSIconGreenIndicator,
  SSIconKeys,
  SSIconYellowIndicator
} from '@/components/icons'
import SSActionButton from '@/components/SSActionButton'
import SSAddressDisplay from '@/components/SSAddressDisplay'
import DerivedAddresses from '@/components/SSDerivedAddresses'
import SSIconButton from '@/components/SSIconButton'
import SSSatsInMempool from '@/components/SSSatsInMempool'
import SpendableOutputs from '@/components/SSSpendableOutputs'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import TotalTransactions from '@/components/SSTotalTransactions'
import useGetAccountAddress from '@/hooks/useGetAccountAddress'
import useGetAccountWallet from '@/hooks/useGetAccountWallet'
import useNostrSync from '@/hooks/useNostrSync'
import useSyncAccountWithAddress from '@/hooks/useSyncAccountWithAddress'
import useSyncAccountWithWallet from '@/hooks/useSyncAccountWithWallet'
import useVerifyConnection from '@/hooks/useVerifyConnection'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { Colors } from '@/styles'
import { type Direction } from '@/types/logic/sort'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { formatNumber } from '@/utils/format'

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
  const [sortDirectionTransactions, setSortDirectionTransactions] =
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
            expand={expand}
          />
        )
      case 'spendableOutputs':
        return (
          <SpendableOutputs
            account={account}
            handleOnRefresh={handleOnRefresh}
            handleOnExpand={handleOnExpand}
            expand={expand}
            refreshing={refreshing}
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
