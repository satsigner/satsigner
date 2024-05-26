import { StyleSheet, TouchableOpacity, View } from "react-native";

import formatNumber from "../../../utils/formatNumber";
import { AppText } from "../../../components/shared/AppText";
import { Colors, Typography } from "../../../styles";

interface Props {
  onSelectAll: () => void,
  totalValue: number
}

export function SelectAllAction({
  onSelectAll,
  totalValue
}: Props) {
  return (
    <TouchableOpacity
      activeOpacity={0.65}
      style={styles.selectAction}
      onPress={onSelectAll}
    >
      <View style={styles.textContainer}>
        <AppText style={styles.selectActionText}>Select All {formatNumber(totalValue)}</AppText>
        <AppText style={[styles.selectActionText, styles.selectActionTextLower]}> sats</AppText>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  textContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.grey208
  },
  selectAction: {
  },
  selectActionText: {
    fontSize: 13,
    color: Colors.grey208,
    ...Typography.capitalization.uppercase,
    letterSpacing: null
  },
  selectActionTextLower: {
    ...Typography.capitalization.lowercase
  }
});