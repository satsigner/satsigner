import { StyleSheet, View } from "react-native";

import { Colors } from "../../../styles";

import { SelectAllAction } from "./SelectAllAction";
import { SortDirection } from "../../../enums/SortDirection";
import SortDirectionToggle from "../../../components/shared/SortDirectionToggle";
import { SortField } from "../enums/SortField";
import { useState } from "react";

interface Props {
  totalValue: number;
  onSelectAll: () => void;
  onSortDirectionChanged: (field: SortField, direction: SortDirection) => void;
}

export function ActionBar({
  totalValue,
  onSelectAll,
  onSortDirectionChanged
}: Props) {
  const [sortField, setSortField] = useState(SortField.Amount);

  return (
    <View style={styles.container}>
      <SelectAllAction onSelectAll={onSelectAll} totalValue={totalValue} />

      <View style={styles.sorts}>
        <SortDirectionToggle
          showArrow={sortField === SortField.Date}
          label="Date"
          style={[styles.sortDirectionToggle, styles.firstSortDirectionToggle]}
          onDirectionChanged={(direction: SortDirection) => {
            setSortField(SortField.Date);
            onSortDirectionChanged(SortField.Date, direction);
          }}
        />
        <SortDirectionToggle
          showArrow={sortField === SortField.Amount}
          label="Amount"
          style={styles.sortDirectionToggle}
          onDirectionChanged={(direction: SortDirection) => {
            setSortField(SortField.Amount);
            onSortDirectionChanged(SortField.Amount, direction);
          }}
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
