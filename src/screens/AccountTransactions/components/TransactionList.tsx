import { RefreshControl, ScrollView, StyleSheet } from "react-native";

import { Transaction } from "../../../models/Transaction";
import { SortDirection } from "../../../enums/SortDirection";
import { Colors } from "../../../styles";

import TransactionItem from "./TransactionItem";

interface Props {
  blockchainHeight: number;
  transactions: Transaction[];
  sortDirection: SortDirection;
  refreshing: boolean;
  onRefresh: () => void;
}

export default function TransactionList({
  blockchainHeight,
  transactions,
  sortDirection,
  refreshing,
  onRefresh
}: Props) {

  function sortTransactions(transactions: Transaction[]): Transaction[] {
    return transactions?.sort(
      sortDirection === SortDirection.Ascending ?
        compareTransactionsAsc :
        compareTransactionsDesc
    );
  }

  function compareTransactionsAsc(txn1: Transaction, txn2: Transaction) {
    const t1 = new Date(txn1.timestamp as Date);
    const t2 = new Date(txn2.timestamp as Date);
    return (t1?.getTime() || 0) - (t2?.getTime() || 0);
  }

  function compareTransactionsDesc(txn1: Transaction, txn2: Transaction) {
    const t1 = new Date(txn1.timestamp as Date);
    const t2 = new Date(txn2.timestamp as Date);
    return (t2?.getTime() || 0) - (t1?.getTime() || 0);
  }

  return (
    <ScrollView style={styles.transactions}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[Colors.white]}
          tintColor={Colors.white}
        />
      }
    >
      { sortTransactions(transactions).map(txn =>
        <TransactionItem
          key={txn.txid}
          transaction={txn}
          blockchainHeight={blockchainHeight}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  transactions: {
    marginHorizontal: '5%',
    height: '100%'
  }
});