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
  const accountsContext = useAccountsContext();
  const txnBuilderContext = useTransactionBuilderContext();

  const { currentAccount } = accountsContext;
  const { utxos } = currentAccount;
  const getUtxoKey = txnBuilderContext.getOutpoint;

  useEffect(() => {
    navUtils.setHeaderTitle(currentAccount.name, navigation);
  }, []);

  return (
    <View style={styles.container}>
      <SelectedUtxosHeader toggleScreenAction="bubbles" navigation={navigation} />
      <View style={styles.utxos}>
        { utxos.map(utxo =>
          <UtxoItem key={getUtxoKey(utxo)} utxo={utxo}></UtxoItem>
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
