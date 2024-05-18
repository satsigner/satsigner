import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Colors } from "../../../styles";
import { SortDirection } from "../../../enums/SortDirection";
import SortDirectionToggle from "../../../components/shared/SortDirectionToggle";
import { useTransactionBuilderContext } from "../../../components/accounts/TransactionBuilderContext";

import { SortField } from "../enums/SortField";
import { SelectAllAction } from "./SelectAllAction";

interface Props {
  utxos: Utxo[];
  onSortDirectionChanged: (field: SortField, direction: SortDirection) => void;
}

export function ActionBar({
  utxos,
  onSortDirectionChanged
}: Props) {
  const txnBuilderContext = useTransactionBuilderContext();
  const [sortField, setSortField] = useState(SortField.Amount);

  const selectAll = useCallback(() => {
    utxos.forEach(
      input => txnBuilderContext.addInput(input)
    );
  }, [txnBuilderContext]);

  const totalValue = utxos.reduce((acc, utxo) => acc + utxo.value, 0);

  const onDirectionChangedForField = (field: SortField) => {
    return (direction: SortDirection) => {
      setSortField(field);
      onSortDirectionChanged(field, direction);
    };
  }

  return (
    <View style={styles.container}>
      <SelectAllAction onSelectAll={selectAll} totalValue={totalValue} />

      <View style={styles.sorts}>
        <SortDirectionToggle
          showArrow={sortField === SortField.Date}
          label="Date"
          style={[styles.sortDirectionToggle, styles.firstSortDirectionToggle]}
          onDirectionChanged={onDirectionChangedForField(SortField.Date)}
        />
        <SortDirectionToggle
          showArrow={sortField === SortField.Amount}
          label="Amount"
          style={styles.sortDirectionToggle}
          onDirectionChanged={onDirectionChangedForField(SortField.Amount)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 46,
    marginTop: 12,
    backgroundColor: Colors.background,
    borderColor: Colors.grey44,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 15
  },
  sorts: {
    flexDirection: 'row',
    marginTop: 2
  },
  firstSortDirectionToggle: {
    marginRight: 16
  },
  sortDirectionToggle: {
    paddingVertical: 12
  }
});
