import { FlashList } from '@shopify/flash-list'
import { useMemo } from 'react'
import { RefreshControl } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSBalanceChangeBar from '@/components/SSBalanceChangeBar'
import SSTransactionCard from '@/components/SSTransactionCard'
import SSVStack from '@/layouts/SSVStack'
import { usePriceStore } from '@/store/price'
import { Colors } from '@/styles'
import { type AccountTransaction } from '@/types/models/Account'

import SSText from './SSText'

export type SSTransactionListProps = {
  transactions: AccountTransaction[]
  expand: boolean
  blockchainHeight: number
  onRefresh: () => Promise<void>
  refreshing: boolean
}

function SSTransactionList({
  transactions,
  onRefresh,
  expand,
  refreshing,
  blockchainHeight
}: SSTransactionListProps) {
  const [btcPrice, fiatCurrency] = usePriceStore(
    useShallow((state) => [state.btcPrice, state.fiatCurrency])
  )

  const transactionBalances = useMemo(() => {
    let balance = 0
    const balances = transactions.map((tx) => {
      const received = tx.received || 0
      const sent = tx.sent || 0
      balance = balance + received - sent
      return balance
    })

    return balances.reverse()
  }, [transactions])

  const maxBalance = useMemo(() => {
    if (transactionBalances.length === 0) return 0
    return Math.max(...transactionBalances)
  }, [transactionBalances])

  return (
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
        data={transactions.slice().reverse()}
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
              link={`/account/${item.accountId}/transaction/${item.id}`}
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
            onRefresh={onRefresh}
            colors={[Colors.gray[950]]}
            progressBackgroundColor={Colors.white}
          />
        }
      />
    </SSVStack>
  )
}

export default SSTransactionList
