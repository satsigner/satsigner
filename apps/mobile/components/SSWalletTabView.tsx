import { useRef, useState } from 'react'
import {
  Animated,
  DimensionValue,
  Easing,
  StyleSheet,
  useWindowDimensions,
  View
} from 'react-native'
import { type SceneRendererProps, TabView } from 'react-native-tab-view'

import SSActionButton from '@/components/SSActionButton'
import DerivedAddresses from '@/components/SSDerivedAddresses'
import SSSatsInMempool from '@/components/SSSatsInMempool'
import SpendableOutputs from '@/components/SSSpendableOutputs'
import SSText from '@/components/SSText'
import TotalTransactions from '@/components/SSTotalTransactions'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { type Direction } from '@/types/logic/sort'
import { type Utxo } from '@/types/models/Utxo'
import { compareTimestamp } from '@/utils/sort'
import { type SSTransactionListItem } from '@/components/SSTransactionList'
import { type SSAddressListItem } from './SSAddressList'
import { Account } from '@/types/models/Account'

type TabItem = 'transactions' | 'utxos' | 'addresses' | 'mempool'

export type SSWalletTabViewProps = {
  transactions: SSTransactionListItem[]
  addresses: SSAddressListItem[]
  utxos: Utxo[]
  tabsEnabled?: TabItem[]
  summary: Account['summary']
}

function SSWalletTabView({
  transactions,
  addresses,
  utxos,
  summary,
  tabsEnabled = ['transactions', 'utxos', 'addresses', 'mempool']
}: SSWalletTabViewProps) {
  const { width } = useWindowDimensions()

  const [refreshing, setRefreshing] = useState(false)
  const [expand, setExpand] = useState(false)
  const [change, setChange] = useState(false)
  const [sortDirectionTransactions, setSortDirectionTransactions] =
    useState<Direction>('desc')
  const [sortDirectionUtxos, setSortDirectionUtxos] =
    useState<Direction>('desc')
  const [sortDirectionDerivedAddresses, setSortDirectionDerivedAddresses] =
    useState<Direction>('desc')

  const tabs = [
    { key: 'totalTransactions' },
    { key: 'derivedAddresses' },
    { key: 'spendableOutputs' },
    { key: 'satsInMempool' }
  ]
  const [tabIndex, setTabIndex] = useState(0)
  const animationValue = useRef(new Animated.Value(0)).current


  const renderScene = ({
    route
  }: SceneRendererProps & { route: { key: string } }) => {
    switch (route.key) {
      case 'totalTransactions':
        return (
          <TotalTransactions
            transactions={transactions}
            utxos={utxos}
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

  async function handleOnExpand(state: boolean) {
    setExpand(state)
    animateTransition(state)
  }

  const renderTab = () => {
    const tabWidth = `${100 / tabsEnabled.length}%` as DimensionValue

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
              {summary.numberOfTransactions}
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
                {summary.numberOfAddresses}
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
              {summary.numberOfUtxos}
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
              {summary.satsInMempool}
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
