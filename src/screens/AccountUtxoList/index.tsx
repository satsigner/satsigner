import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

import { NavigationProp } from "@react-navigation/native";

import { Layout } from "../../styles";
import { useAccountsContext } from "../../components/accounts/AccountsContext";
import { useTransactionBuilderContext } from "../../components/accounts/TransactionBuilderContext";
import navUtils from "../../utils/NavUtils";

import SelectedUtxosHeader from "../../components/accounts/SelectedUtxosHeader";

import UtxoItem from "./components/UtxoItem";

interface Props {
  navigation: NavigationProp<any>;
}

export default function AccountUtxoListScreen({
  navigation
}: Props) {
  const { currentAccount, currentAccount: { utxos } } = useAccountsContext();
  const txnBuilderContext = useTransactionBuilderContext();

  const getUtxoKey = txnBuilderContext.getOutpoint;

  useEffect(() => {
    navUtils.setHeaderTitle(currentAccount.name, navigation);
  }, []);

  const largestValue = Math.max(...utxos.map(utxo => utxo.value));

  return (
    <View style={styles.container}>
      <SelectedUtxosHeader toggleScreenAction="bubbles" navigation={navigation} />
      <View style={styles.utxos}>
        { utxos.map(utxo =>
          <UtxoItem key={getUtxoKey(utxo)} utxo={utxo} largestValue={largestValue}></UtxoItem>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({  
  container: {
    ...Layout.container.base,
    ...Layout.container.topPaddedThin
  },
  utxos: {
    marginTop: 25
  }
});
