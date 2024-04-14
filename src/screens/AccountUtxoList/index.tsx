import { StyleSheet, View } from "react-native";

import { NavigationProp } from "@react-navigation/native";

import { Layout } from "../../styles";
import { useAccountsContext } from "../../components/accounts/AccountsContext";
import { Utxo } from "../../models/Utxo";

import UtxoItem from "./components/UtxoItem";

interface Props {
  navigation: NavigationProp<any>;
}

export default function AccountUtxoListScreen({
  navigation
}: Props) {
  const accountsContext = useAccountsContext();
  const { utxos } = accountsContext.currentAccount;

  const outpoint = (u: Utxo) => `${u.txid}:${u.vout}`;

  return (
    <View style={styles.container}>
      { utxos.map(utxo =>
        <UtxoItem key={outpoint(utxo)} utxo={utxo}></UtxoItem>
      )}
    </View>    
  );
}

const styles = StyleSheet.create({  
  container: {
    ...Layout.container.base
  }
});
