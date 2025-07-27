import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import { type Dispatch, useMemo, useState } from 'react'
import { RefreshControl, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import {
  SSIconChartSettings,
  SSIconCollapse,
  SSIconExpand,
  SSIconHistoryChart,
  SSIconMenu,
  SSIconRefresh
} from '@/components/icons'
import SSBalanceChangeBar from '@/components/SSBalanceChangeBar'
import SSHistoryChart from '@/components/SSHistoryChart'
import SSTransactionCard from '@/components/SSTransactionCard'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { Colors } from '@/styles'
import { type Direction } from '@/types/logic/sort'
import { type Account } from '@/types/models/Account'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { sortTransactions } from '@/utils/sort'

import SSIconButton from './SSIconButton'
import SSSortDirectionToggle from './SSSortDirectionToggle'
import SSText from './SSText'

type TotalTransactionsProps = {
  transactions: Transaction[]
  utxos: Utxo[]
  // TODO: allow the transaction to belong to distinct accounts
  accountId: Account['id']
  handleOnRefresh: () => Promise<void>
  handleOnExpand: (state: boolean) => Promise<void>
  expand: boolean
  setSortDirection: Dispatch<React.SetStateAction<Direction>>
  refreshing: boolean
  sortDirection: Direction
  blockchainHeight: number
}

function TotalTransactions({
  transactions,
  utxos,
  accountId,
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
    return sortTransactions([...transactions], sortDirection)
  }, [transactions, sortDirection])

  const chartTransactions = useMemo(() => {
    return sortTransactions([...transactions], 'desc')
  }, [transactions])

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
      {/* TODO: show it elsewhere because the total transaction list should be
       /* decoupled from the history chart.
        */}
      {showHistoryChart && sortedTransactions.length > 0 ? (
        <View style={{ flex: 1, zIndex: -1 }}>
          <SSHistoryChart transactions={chartTransactions} utxos={utxos} />
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
                  link={`/account/${accountId}/transaction/${item.id}`}
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

export default TotalTransactions
