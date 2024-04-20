import { StyleSheet, View } from "react-native";

import { useAccountsContext } from "./AccountsContext";
import { useTransactionBuilderContext } from "./TransactionBuilderContext";
import { AppText } from "../shared/AppText";
import { Sats } from "./Sats";
import { Colors, Typography } from "../../styles";
import { Utxo } from "../../models/Utxo";

export default function SelectedUtxosHeader() {
  const transactionBuilderContext = useTransactionBuilderContext();
  const selectedUtxos = transactionBuilderContext.getInputs();
  
  const accountsContext = useAccountsContext();
  const { currentAccount } = accountsContext;
  const { utxos } = currentAccount;
  
  const utxosValue = (utxos: Utxo[]): number =>
    utxos.reduce((acc, utxo) => acc + utxo.value, 0);

  const totalValue = utxosValue(utxos);
  const selectedValue = utxosValue(selectedUtxos);

  return (
    <View>
      <View style={styles.centerColumn}>
        <AppText style={styles.callToAction}>Select spendable outputs</AppText>
        <AppText style={styles.selectedCount}>{selectedUtxos.length} of {utxos.length} selected</AppText>
        <View style={styles.totalContainer}>
          <AppText style={styles.totalLabel}>Total</AppText>
          <Sats sats={totalValue} satsStyle={styles.totalSats} satsLabelStyle={styles.totalSatsLabel} usdStyle={styles.totalUsd} usdLabelStyle={styles.totalUsdLabel} />
        </View>
        <View style={styles.selectedContainer}>
          <Sats sats={selectedValue} satsStyle={styles.selectedSats} satsLabelStyle={styles.selectedSatsLabel} usdStyle={styles.selectedUsd} usdLabelStyle={styles.selectedUsdLabel} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerColumn: {
    justifyContent: 'flex-start',
    alignItems: 'center'
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
  selectedContainer: {
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
