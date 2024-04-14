import { StyleSheet, TouchableOpacity, View } from "react-native";

import { AppText } from "../../../components/shared/AppText";
import RefreshIcon from '../../../assets/images/refresh.svg';
import { Colors, Typography } from "../../../styles";
import { SortDirection } from "../../../enums/SortDirection";

import SortDirectionToggle from "./SortDirectionToggle";

interface Props {
  refreshing: boolean;
  onRefresh: () => void;
  onSortDirectionChanged: (direction: SortDirection) => void;
}

export default function TransactionListHeader({
  refreshing,
  onRefresh,
  onSortDirectionChanged
}: Props) {
  return (
    <View style={styles.transactionsHeaderContainer}>
      <View style={styles.transactionsHeader}>
        <TouchableOpacity
          style={styles.action}
          activeOpacity={0.7}
          onPress={onRefresh}
        >
          <RefreshIcon width={18} height={18} />                
        </TouchableOpacity>
        { refreshing ?
          <AppText style={[styles.transactionsHeaderText, styles.transactionsHeaderTextRefreshing]}>Updating Parent Account Activity...</AppText> :
          <AppText style={styles.transactionsHeaderText}>Parent Account Activity</AppText>
        }
        <SortDirectionToggle
          style={styles.action}
          onDirectionChanged={onSortDirectionChanged}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  transactionsHeaderContainer: {
    width: '90%',
    marginHorizontal: '5%',
    height: 61,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: -16,
    width: '100%'
  },
  transactionsHeaderText: {
    color: Colors.grey130,
    marginTop: 0,
    ...Typography.fontSize.x4
  },
  transactionsHeaderTextRefreshing: {
    color: Colors.white
  },
  action: {
    paddingVertical: 12
  }
});