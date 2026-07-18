import { FlashList } from '@shopify/flash-list'
import { router } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSExplorerCapabilityBanner from '@/components/SSExplorerCapabilityBanner'
import SSLoader from '@/components/SSLoader'
import SSText from '@/components/SSText'
import SSTransactionCard from '@/components/SSTransactionCard'
import { useExplorerAddressTxDetails } from '@/hooks/useExplorerAddressTxDetails'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { Colors, Layout } from '@/styles'
import type { Transaction } from '@/types/models/Transaction'

const tn = _tn('explorer.address')

const LOADER_SIZE = 48
const TXID_LIST_HEIGHT = 220

type TxRowProps = {
  txid: string
}

function navigateToExplorerTx(txid: string) {
  router.push(`/explorer/transaction/${txid}`)
}

function TxRow({ txid }: TxRowProps) {
  function openTx() {
    navigateToExplorerTx(txid)
  }

  return (
    <Pressable onPress={openTx} style={styles.listItem}>
      <SSText type="mono" size="xs">
        {txid}
      </SSText>
    </Pressable>
  )
}

function renderTx({ item }: { item: string }) {
  return <TxRow txid={item} />
}

function txKey(txid: string) {
  return txid
}

type SSExplorerAddressTransactionsProps = {
  address: string
  txids: string[]
  preferMempool?: boolean
}

function SSExplorerAddressTransactions({
  address,
  txids,
  preferMempool = false
}: SSExplorerAddressTransactionsProps) {
  const blockchainHeight = useBlockchainStore(
    (state) => state.lastKnownBlockHeight
  )
  const [fiatCurrency, btcPrice] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.btcPrice])
  )

  const {
    data: transactions,
    isError,
    isFetching,
    loadDetails,
    loadDetailsFromMempool,
    requested,
    useMempool
  } = useExplorerAddressTxDetails({
    address,
    preferMempool,
    txids
  })

  const showCards = requested && !isError && (transactions?.length ?? 0) > 0
  const showEmptyDetails =
    requested && !isFetching && !isError && (transactions?.length ?? 0) === 0

  return (
    <SSVStack gap="sm" style={styles.section}>
      <SSText size="lg">{tn('transactions')}</SSText>

      {txids.length === 0 ? (
        <SSText color="muted" size="sm">
          {tn('noTransactions')}
        </SSText>
      ) : null}

      {txids.length > 0 && !showCards && !isFetching ? (
        <SSButton
          label={tn('loadTxDetails')}
          variant="outline"
          onPress={loadDetails}
        />
      ) : null}

      {isFetching && !showCards ? (
        <View style={styles.loading}>
          <SSLoader size={LOADER_SIZE} />
        </View>
      ) : null}

      {isError && requested && !isFetching ? (
        <SSVStack gap="sm">
          <SSText color="muted" size="sm" center>
            {tn('loadTxDetailsError')}
          </SSText>
          {!useMempool ? (
            <SSExplorerCapabilityBanner
              why={tn('loadTxDetailsWhy')}
              fix={tn('loadTxDetailsFix')}
              onLoad={loadDetailsFromMempool}
              loading={isFetching}
            />
          ) : (
            <SSButton
              label={t('transaction.historyDiagram.retry')}
              variant="outline"
              onPress={loadDetailsFromMempool}
            />
          )}
        </SSVStack>
      ) : null}

      {showEmptyDetails ? (
        <SSText color="muted" size="sm">
          {tn('noTransactions')}
        </SSText>
      ) : null}

      {showCards && transactions ? (
        <SSVStack gap="none">
          {transactions.map((transaction: Transaction, index: number) => (
            <SSTransactionCard
              key={transaction.id}
              transaction={transaction}
              blockHeight={blockchainHeight}
              fiatCurrency={fiatCurrency}
              btcPrice={btcPrice}
              link={`/explorer/transaction/${transaction.id}`}
              expand
              style={{
                borderColor: Colors.gray[700],
                borderTopWidth: index > 0 ? 1 : 0,
                paddingBottom: 8,
                paddingHorizontal: 0
              }}
            />
          ))}
        </SSVStack>
      ) : null}

      {!requested && txids.length > 0 && !isFetching ? (
        <SSVStack style={styles.listBox}>
          <FlashList data={txids} keyExtractor={txKey} renderItem={renderTx} />
        </SSVStack>
      ) : null}
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  listBox: {
    height: TXID_LIST_HEIGHT
  },
  listItem: {
    borderTopColor: Colors.gray[800],
    borderTopWidth: 1,
    gap: 4,
    paddingVertical: 10
  },
  loading: {
    alignItems: 'center',
    paddingVertical: Layout.vStack.gap.md
  },
  section: {
    paddingTop: 24
  }
})

export default SSExplorerAddressTransactions
