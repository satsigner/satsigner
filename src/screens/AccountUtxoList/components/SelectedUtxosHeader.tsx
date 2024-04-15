import { StyleSheet, View } from "react-native";

import { AppText } from "../../../components/shared/AppText";
import { useAccountsContext } from "../../../components/accounts/AccountsContext";
import { useTransactionBuilderContext } from "../../../components/accounts/TransactionBuilderContext";
import { Sats } from "../../../components/accounts/Sats";
import { Utxo } from "../../../models/Utxo";

interface Props {

}

export default function SelectedUtxosHeader({

}: Props) {
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
      <AppText>{selectedUtxos.length} of {utxos.length} selected</AppText>
      <View style={styles.values}>
        <AppText>Total</AppText>
        <Sats sats={totalValue} />
      </View>
      <View style={styles.values}>
        <AppText>Selected</AppText>
        <Sats sats={selectedValue} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  values: {
    marginVertical: 20
  }
});