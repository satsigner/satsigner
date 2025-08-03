import { FlashList } from '@shopify/flash-list'
import { useMemo } from 'react'
import { RefreshControl } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSBalanceChangeBar from '@/components/SSBalanceChangeBar'
import SSTransactionCard from '@/components/SSTransactionCard'
import SSVStack from '@/layouts/SSVStack'
import { usePriceStore } from '@/store/price'
import { Colors } from '@/styles'
import { type Account } from '@/types/models/Account'
import { type Transaction } from '@/types/models/Transaction'

import SSText from './SSText'

export type SSTransactionListItem = {
  accountId: Account['id']
} & Transaction

export type SSTransactionListProps = {
  transactions: SSTransactionListItem[]
  expand: boolean
  blockchainHeight: number
  // TODO: move out this props to the parent, refreshing should not be handled here
  handleOnRefresh: () => Promise<void>
  refreshing: boolean
}

function SSTransactionList({
  transactions,
  handleOnRefresh,
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
            onRefresh={handleOnRefresh}
            colors={[Colors.gray[950]]}
            progressBackgroundColor={Colors.white}
          />
        }
      />
    </SSVStack>
  )
}

export default SSTransactionList
