import { StyleSheet, View, TouchableOpacity } from "react-native";

import { NavigationProp } from "@react-navigation/native";

import { useAccountsContext } from "./AccountsContext";
import { useTransactionBuilderContext } from "./TransactionBuilderContext";
import { AppText } from "../shared/AppText";
import { Sats } from "./Sats";
import { Colors, Typography } from "../../styles";
import { Utxo } from "../../models/Utxo";
import BubblesIcon from '../../assets/images/bubbles.svg';
import ListIcon from '../../assets/images/list.svg';

interface Props {
  toggleScreenAction: 'bubbles' | 'list',
  navigation: NavigationProp<any>
}

export default function SelectedUtxosHeader({
  toggleScreenAction = 'bubbles',
  navigation
}: Props) {
  const transactionBuilderContext = useTransactionBuilderContext();
  const selectedUtxos = transactionBuilderContext.getInputs();
  
  const { currentAccount: { utxos } } = useAccountsContext();
  
  const utxosValue = (utxos: Utxo[]): number =>
    utxos.reduce((acc, utxo) => acc + utxo.value, 0);

  const totalValue = utxosValue(utxos);
  const selectedValue = utxosValue(selectedUtxos);

  const toggleScreen = () => {
    const screenName = toggleScreenAction === 'bubbles' ?
      'AccountUtxoBubbles' :
      'AccountUtxoList';
    navigation.navigate(screenName);
  };

  return (
    <View>
      <View style={styles.topRow}>
        <View style={styles.leftColumn}>
          <AppText style={styles.groupAction}>Group</AppText>
        </View>
        <View style={styles.centerColumn}>
          <AppText style={styles.callToAction}>Select spendable outputs</AppText>
          <AppText style={styles.selectedCount}>{selectedUtxos.length} of {utxos.length} selected</AppText>
          <View style={styles.totalContainer}>
            <AppText style={styles.totalLabel}>Total</AppText>
            <Sats sats={totalValue} satsStyle={styles.totalSats} satsLabelStyle={styles.totalSatsLabel} usdStyle={styles.totalUsd} usdLabelStyle={styles.totalUsdLabel} />
          </View>
        </View>
        <View style={styles.rightColumn}>
          <TouchableOpacity
            activeOpacity={0.65}
            onPress={toggleScreen}
            style={styles.toggleScreenAction}
          >
            { toggleScreenAction === 'bubbles' && <BubblesIcon /> }
            { toggleScreenAction === 'list' && <ListIcon /> }
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.bottomRow}>
        <Sats sats={selectedValue} satsStyle={styles.selectedSats} satsLabelStyle={styles.selectedSatsLabel} usdStyle={styles.selectedUsd} usdLabelStyle={styles.selectedUsdLabel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row'
  },
  leftColumn: {
    flex: 1,
    paddingLeft: 20
  },
  groupAction: {
    ...Typography.fontFamily.sfProDisplayRegular,
    ...Typography.fontSize.x4,
    color: Colors.grey130
  },
  centerColumn: {
    justifyContent: 'flex-start',
    alignItems: 'center'
  },
  rightColumn: {
    flex: 1,
    justifyContent: 'flex-end',
    flexDirection: 'row',
  },
  toggleScreenAction: {
    paddingHorizontal: 20
  },
  callToAction: {
    ...Typography.fontSize.x6
  },
  selectedCount: {
    marginTop: 12,
    ...Typography.fontSize.x6
  },
  totalContainer: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'baseline'
  },
  totalLabel: {
    ...Typography.textHighlight.x1,
    color: Colors.grey94,
    marginRight: 5
  },
  totalSats: {
    ...Typography.textHighlight.x1,
    color: Colors.grey208
  },
  totalSatsLabel: {
    ...Typography.textHighlight.x1,
    color: Colors.grey80,
    marginRight: 3
  },
  totalUsd: {
    ...Typography.textHighlight.x1,
    color: Colors.grey208
  },
  totalUsdLabel: {
    ...Typography.textHighlight.x1,
    color: Colors.grey74,
    marginRight: 1
  },
  bottomRow: {
    alignItems: 'center',
    marginTop: 0
  },
  selectedSats: {
    ...Typography.fontFamily.sfProTextUltraLight,
    fontSize: 50,
    marginLeft: 40,
  },
  selectedSatsLabel: {
    fontSize: 21,
    marginLeft: 0
  },
  selectedUsd: {
    fontSize: 13,
    marginTop: -3
  },
  selectedUsdLabel: {
    fontSize: 10,
    marginTop: -3
  }
});
