import { Descriptor } from 'bdk-rn'
import { Network } from 'bdk-rn/lib/lib/enums'
import { Image } from 'expo-image'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { RefreshControl, ScrollView, View } from 'react-native'

import SSActionButton from '@/components/SSActionButton'
import SSBackgroundGradient from '@/components/SSBackgroundGradient'
import SSIconButton from '@/components/SSIconButton'
import SSSeparator from '@/components/SSSeparator'
import SSSortDirectionToggle from '@/components/SSSortDirectionToggle'
import SSText from '@/components/SSText'
import SSTransactionCard from '@/components/SSTransactionCard'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { Colors } from '@/styles'
import { type Direction } from '@/types/logic/sort'
import { type Transaction } from '@/types/models/Transaction'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { formatNumber } from '@/utils/format'
import { compareTimestamp } from '@/utils/sort'

export default function Account() {
  const accountStore = useAccountStore()
  const priceStore = usePriceStore()
  const blockchainStore = useBlockchainStore()
  const transactionBuilderStore = useTransactionBuilderStore()
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const [refreshing, setRefreshing] = useState(false)
  const [sortDirection, setSortDirection] = useState<Direction>('desc')
  const [blockchainHeight, setBlockchainHeight] = useState<number>(0)

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
      sortDirection === 'asc'
        ? compareTimestamp(transaction1.timestamp, transaction2.timestamp)
        : compareTimestamp(transaction2.timestamp, transaction1.timestamp)
    )
  }

  async function refreshBlockchainHeight() {
    const height = await blockchainStore.getBlockchainHeight()
    setBlockchainHeight(height)
  }

  async function refreshAccount() {
    // TODO: refactor
    if (
      !accountStore.currentAccount.externalDescriptor ||
      !accountStore.currentAccount.internalDescriptor
    )
      return

    const externalDescriptor = await new Descriptor().create(
      accountStore.currentAccount.externalDescriptor,
      blockchainStore.network as Network
    )
    const internalDescriptor = await new Descriptor().create(
      accountStore.currentAccount.internalDescriptor,
      blockchainStore.network as Network
    )

    const wallet = await accountStore.loadWalletFromDescriptor(
      externalDescriptor,
      internalDescriptor
    )

    await accountStore.syncWallet(wallet)
    const account = await accountStore.getPopulatedAccount(
      wallet,
      accountStore.currentAccount
    )

    await accountStore.updateAccount(account)
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
    transactionBuilderStore.clearTransaction()
    router.navigate(`/accountList/account/${id}/signAndSend/selectUtxoList`)
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{accountStore.currentAccount.name}</SSText>
          )
        }}
      />
      <SSBackgroundGradient orientation="horizontal">
        <SSVStack itemsCenter gap="none">
          <SSVStack itemsCenter gap="none" style={{ paddingVertical: 12 }}>
            <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
              <SSText size="7xl" color="white" weight="ultralight">
                {formatNumber(accountStore.currentAccount.summary.balance)}
              </SSText>
              <SSText size="xl" color="muted">
                {i18n.t('bitcoin.sats').toLowerCase()}
              </SSText>
            </SSHStack>
            <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
              <SSText color="muted">
                {formatNumber(
                  priceStore.satsToFiat(
                    accountStore.currentAccount.summary.balance
                  ),
                  2
                )}
              </SSText>
              <SSText size="xs" style={{ color: Colors.gray[500] }}>
                {priceStore.fiatCurrency}
              </SSText>
            </SSHStack>
          </SSVStack>
          <SSVStack gap="none">
            <SSSeparator color="gradient" />
            <SSHStack justifyEvenly gap="none">
              <SSActionButton
                onPress={() => navigateToSignAndSend()}
                style={{
                  width: '40%',
                  borderRightWidth: 1,
                  borderRightColor: Colors.gray[700]
                }}
              >
                <SSText uppercase>{i18n.t('account.signAndSend')}</SSText>
              </SSActionButton>
              <SSActionButton onPress={() => {}} style={{ width: '20%' }}>
                <Image
                  style={{ width: 18, height: 13 }}
                  source={require('@/assets/icons/camera.svg')}
                />
              </SSActionButton>
              <SSActionButton
                onPress={() => {}}
                style={{
                  width: '40%',
                  borderLeftWidth: 1,
                  borderLeftColor: Colors.gray[700]
                }}
              >
                <SSText uppercase>{i18n.t('account.newInvoice')}</SSText>
              </SSActionButton>
            </SSHStack>
            <SSSeparator color="gradient" />
          </SSVStack>
          <SSHStack style={{ paddingVertical: 12 }}>
            <SSVStack gap="none">
              <SSText center size="lg">
                {accountStore.currentAccount.summary.numberOfTransactions}
              </SSText>
              <SSText center color="muted" style={{ lineHeight: 12 }}>
                {i18n.t('accountList.totalTransactions.0')}
                {'\n'}
                {i18n.t('accountList.totalTransactions.1')}
              </SSText>
              <View
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: 2,
                  bottom: -12,
                  backgroundColor: Colors.white
                }}
              />
              {/* Temp selected tab underline */}
            </SSVStack>
            <SSVStack gap="none">
              <SSText center size="lg">
                {accountStore.currentAccount.summary.numberOfAddresses}
              </SSText>
              <SSText center color="muted" style={{ lineHeight: 12 }}>
                {i18n.t('accountList.childAccounts.0')}
                {'\n'}
                {i18n.t('accountList.childAccounts.1')}
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText center size="lg">
                {accountStore.currentAccount.summary.numberOfUtxos}
              </SSText>
              <SSText center color="muted" style={{ lineHeight: 12 }}>
                {i18n.t('accountList.spendableOutputs.0')}
                {'\n'}
                {i18n.t('accountList.spendableOutputs.1')}
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText center size="lg">
                {accountStore.currentAccount.summary.satsInMempool}
              </SSText>
              <SSText center color="muted" style={{ lineHeight: 12 }}>
                {i18n.t('accountList.satsInMempool.0')}
                {'\n'}
                {i18n.t('accountList.satsInMempool.1')}
              </SSText>
            </SSVStack>
          </SSHStack>
        </SSVStack>
      </SSBackgroundGradient>
      <SSMainLayout style={{ paddingTop: 0 }}>
        <SSHStack justifyBetween style={{ paddingVertical: 16 }}>
          <SSIconButton onPress={() => handleOnRefresh()}>
            <Image
              style={{ width: 18, height: 22 }}
              source={require('@/assets/icons/refresh.svg')}
            />
          </SSIconButton>
          <SSText color="muted">
            {i18n.t('account.parentAccountActivity')}
          </SSText>
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
            {sortTransactions([
              ...accountStore.currentAccount.transactions
            ]).map((transaction) => (
              <SSVStack gap="xs" key={transaction.id}>
                <SSSeparator
                  key={`separator-${transaction.id}`}
                  color="grayDark"
                />
                <SSTransactionCard
                  key={transaction.id}
                  transaction={transaction}
                  blockHeight={blockchainHeight}
                />
              </SSVStack>
            ))}
          </SSVStack>
        </ScrollView>
      </SSMainLayout>
    </>
  )
}
