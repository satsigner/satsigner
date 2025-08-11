import { useRef, useState } from 'react'
import {
  Animated,
  type DimensionValue,
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
import type {
  Account,
  AccountAddress,
  AccountTransaction
} from '@/types/models/Account'
import { type Utxo } from '@/types/models/Utxo'
import { compareTimestamp } from '@/utils/sort'

type TabItem = 'transactions' | 'utxos' | 'addresses' | 'mempool'

export type SSWalletTabViewProps = {
  transactions: AccountTransaction[]
  addresses: AccountAddress[]
  utxos: Utxo[]
  tabsEnabled?: TabItem[]
  summary: Account['summary']
}

function SSWalletTabView({
  transactions,
  utxos,
  summary,
  tabsEnabled = ['transactions', 'utxos', 'addresses', 'mempool']
}: SSWalletTabViewProps) {
  const { width } = useWindowDimensions()

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
            handleOnExpand={handleOnExpand}
            expand={expand}
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

  function ButtonOutline() {
    return <View style={styles.tabButtonOutline} />
  }

  const renderTab = () => {
    const tabWidth = `${100 / tabsEnabled.length}%` as DimensionValue
    const actionButtonStyle = {
      width: tabWidth
    }

    if (!expand) return null

    return (
      <SSHStack
        gap="none"
        style={{ paddingVertical: 8, paddingHorizontal: '5%' }}
      >
        {tabsEnabled.includes('transactions') && (
          <SSActionButton
            style={actionButtonStyle}
            onPress={() => setTabIndex(0)}
          >
            <SSVStack gap="none">
              <SSText center size="lg">
                {summary.numberOfTransactions}
              </SSText>
              <SSText center color="muted" style={{ lineHeight: 12 }}>
                {t('accounts.totalTransactions')}
              </SSText>
              {tabIndex === 0 && <ButtonOutline />}
            </SSVStack>
          </SSActionButton>
        )}
        {tabsEnabled.includes('addresses') && (
          <SSActionButton
            style={actionButtonStyle}
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
              {tabIndex === 1 && <ButtonOutline />}
            </SSVStack>
          </SSActionButton>
        )}
        {tabsEnabled.includes('utxos') && (
          <SSActionButton
            style={actionButtonStyle}
            onPress={() => setTabIndex(2)}
          >
            <SSVStack gap="none">
              <SSText center size="lg">
                {summary.numberOfUtxos}
              </SSText>
              <SSText center color="muted" style={{ lineHeight: 12 }}>
                {t('accounts.spendableOutputs')}
              </SSText>
              {tabIndex === 2 && <ButtonOutline />}
            </SSVStack>
          </SSActionButton>
        )}
        {tabsEnabled.includes('mempool') && (
          <SSActionButton
            style={actionButtonStyle}
            onPress={() => setTabIndex(3)}
          >
            <SSVStack gap="none">
              <SSText center size="lg">
                {summary.satsInMempool}
              </SSText>
              <SSText center color="muted" style={{ lineHeight: 12 }}>
                {t('accounts.satsInMempool')}
              </SSText>
              {tabIndex === 3 && <ButtonOutline />}
            </SSVStack>
          </SSActionButton>
        )}
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
