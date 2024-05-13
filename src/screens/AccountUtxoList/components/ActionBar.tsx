import { StyleSheet, View } from "react-native";

import { Colors } from "../../../styles";

import { SelectAllAction } from "./SelectAllAction";

interface Props {
  totalValue: number;
  onSelectAll: () => void;
}

export function ActionBar({
  totalValue,
  onSelectAll
}: Props) {
  return (
    <View style={styles.container}>
      <SelectAllAction onSelectAll={onSelectAll} totalValue={totalValue} />
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
    width: '100%'
  }
});